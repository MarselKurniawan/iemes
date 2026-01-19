import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/contexts/PropertyContext';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type AssetCategory = 'peralatan_kamar' | 'peralatan_dapur' | 'mesin_laundry_housekeeping' | 'kendaraan_operasional' | 'peralatan_kantor_it' | 'peralatan_rekreasi_leisure' | 'infrastruktur';
type AssetCondition = 'baik' | 'cukup' | 'perlu_perbaikan' | 'rusak';
type AssetStatus = 'aktif' | 'dalam_perbaikan' | 'tidak_aktif' | 'dihapuskan';
type MaintenanceType = 'renovasi_lokasi' | 'perbaikan_aset';
type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

const categoryLabels: Record<AssetCategory, string> = {
  peralatan_kamar: 'Peralatan Kamar',
  peralatan_dapur: 'Peralatan Dapur',
  mesin_laundry_housekeeping: 'Mesin Laundry & Housekeeping',
  kendaraan_operasional: 'Kendaraan Operasional',
  peralatan_kantor_it: 'Peralatan Kantor & IT',
  peralatan_rekreasi_leisure: 'Peralatan Rekreasi & Leisure',
  infrastruktur: 'Infrastruktur',
};

const conditionLabels: Record<AssetCondition, string> = {
  baik: 'Baik',
  cukup: 'Cukup',
  perlu_perbaikan: 'Perlu Perbaikan',
  rusak: 'Rusak',
};

const statusLabels: Record<AssetStatus, string> = {
  aktif: 'Aktif',
  dalam_perbaikan: 'Dalam Perbaikan',
  tidak_aktif: 'Tidak Aktif',
  dihapuskan: 'Dihapuskan',
};

const typeLabels: Record<MaintenanceType, string> = {
  renovasi_lokasi: 'Renovasi Lokasi',
  perbaikan_aset: 'Perbaikan Aset',
};

const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  pending: 'Pending',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const Reports = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty, selectedProperty } = useProperty();
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Asset filters
  const [assetLocationFilter, setAssetLocationFilter] = useState('all');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('all');
  const [assetConditionFilter, setAssetConditionFilter] = useState('all');
  const [assetStatusFilter, setAssetStatusFilter] = useState('all');
  const [assetPropertyFilter, setAssetPropertyFilter] = useState('current');
  
  // Maintenance filters
  const [maintLocationFilter, setMaintLocationFilter] = useState('all');
  const [maintAssetFilter, setMaintAssetFilter] = useState('all');
  const [maintTypeFilter, setMaintTypeFilter] = useState('all');
  const [maintStatusFilter, setMaintStatusFilter] = useState('all');
  const [maintPropertyFilter, setMaintPropertyFilter] = useState('current');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Data for dropdowns
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([]);

  const isSuperadmin = role === 'superadmin';

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) setSelectedProperty(property);
  }, [propertyId, properties]);

  useEffect(() => {
    const fetchDropdownData = async () => {
      const targetPropertyId = assetPropertyFilter === 'all' ? null : propertyId;
      
      if (targetPropertyId) {
        const [locRes, assetRes] = await Promise.all([
          supabase.from('locations').select('id, name').eq('property_id', targetPropertyId),
          supabase.from('assets').select('id, name').eq('property_id', targetPropertyId),
        ]);
        setLocations(locRes.data || []);
        setAssets(assetRes.data || []);
      } else if (isSuperadmin && assetPropertyFilter === 'all') {
        const [locRes, assetRes] = await Promise.all([
          supabase.from('locations').select('id, name'),
          supabase.from('assets').select('id, name'),
        ]);
        setLocations(locRes.data || []);
        setAssets(assetRes.data || []);
      }
    };
    
    if (propertyId || isSuperadmin) {
      fetchDropdownData();
    }
  }, [propertyId, assetPropertyFilter, isSuperadmin]);

  const exportAssets = async (format: 'excel' | 'pdf') => {
    setLoading(true);

    let query = supabase.from('assets').select('*, locations(name), properties(name)');
    
    // Property filter
    if (assetPropertyFilter === 'current' && propertyId) {
      query = query.eq('property_id', propertyId);
    }
    
    // Other filters
    if (assetLocationFilter !== 'all') query = query.eq('location_id', assetLocationFilter);
    if (assetCategoryFilter !== 'all') query = query.eq('category', assetCategoryFilter as any);
    if (assetConditionFilter !== 'all') query = query.eq('condition', assetConditionFilter as any);
    if (assetStatusFilter !== 'all') query = query.eq('status', assetStatusFilter as any);

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({ title: 'Info', description: 'Tidak ada data aset untuk di-export', variant: 'default' });
      setLoading(false);
      return;
    }

    const rows = data.map(a => {
      const cat = a.category as keyof typeof categoryLabels;
      const cond = a.condition as keyof typeof conditionLabels;
      const stat = a.status as keyof typeof statusLabels;
      return {
        Property: a.properties?.name || '-',
        Nama: a.name,
        Kategori: categoryLabels[cat] || a.category,
        Lokasi: a.locations?.name || (a.is_movable ? 'Bergerak' : '-'),
        Merek: a.brand || '-',
        Seri: a.series || '-',
        'Harga Beli': a.purchase_price || 0,
        Kondisi: conditionLabels[cond] || a.condition,
        Status: statusLabels[stat] || a.status,
      };
    });

    const fileName = assetPropertyFilter === 'all' ? 'assets_all_properties' : `assets_${selectedProperty?.name || 'report'}`;

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Assets');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text(`Laporan Aset${assetPropertyFilter === 'all' ? ' - Semua Property' : ` - ${selectedProperty?.name || ''}`}`, 14, 15);
      const headers = Object.keys(rows[0]);
      const bodyData = rows.map(r => Object.values(r));
      autoTable(doc, { head: [headers], body: bodyData, startY: 25, styles: { fontSize: 8 } });
      doc.save(`${fileName}.pdf`);
    }

    toast({ title: 'Berhasil', description: 'Laporan berhasil di-export' });
    setLoading(false);
  };

  const exportMaintenance = async (format: 'excel' | 'pdf') => {
    setLoading(true);

    let query = supabase.from('maintenance').select('*, assets(name), locations(name), properties(name)');
    
    // Property filter
    if (maintPropertyFilter === 'current' && propertyId) {
      query = query.eq('property_id', propertyId);
    }
    
    // Other filters
    if (maintLocationFilter !== 'all') query = query.eq('location_id', maintLocationFilter);
    if (maintAssetFilter !== 'all') query = query.eq('asset_id', maintAssetFilter);
    if (maintTypeFilter !== 'all') query = query.eq('type', maintTypeFilter as any);
    if (maintStatusFilter !== 'all') query = query.eq('status', maintStatusFilter as any);
    if (dateFrom) query = query.gte('start_date', dateFrom);
    if (dateTo) query = query.lte('start_date', dateTo);

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({ title: 'Info', description: 'Tidak ada data maintenance untuk di-export', variant: 'default' });
      setLoading(false);
      return;
    }

    const rows = data.map(m => {
      const typ = m.type as keyof typeof typeLabels;
      const stat = m.status as keyof typeof maintenanceStatusLabels;
      return {
        Property: m.properties?.name || '-',
        Judul: m.title,
        Tipe: typeLabels[typ] || m.type,
        Target: m.assets?.name || m.locations?.name || '-',
        'Tanggal Mulai': m.start_date,
        'Tanggal Selesai': m.end_date || '-',
        'Total Biaya': m.total_cost,
        Status: maintenanceStatusLabels[stat] || m.status,
        Deskripsi: m.description || '-',
        Evidence: m.evidence_urls?.join(', ') || '-',
      };
    });

    const fileName = maintPropertyFilter === 'all' ? 'maintenance_all_properties' : `maintenance_${selectedProperty?.name || 'report'}`;

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text(`Laporan Maintenance${maintPropertyFilter === 'all' ? ' - Semua Property' : ` - ${selectedProperty?.name || ''}`}`, 14, 15);
      const headers = Object.keys(rows[0]);
      const bodyData = rows.map(r => Object.values(r));
      autoTable(doc, { head: [headers], body: bodyData, startY: 25, styles: { fontSize: 7 } });
      doc.save(`${fileName}.pdf`);
    }

    toast({ title: 'Berhasil', description: 'Laporan berhasil di-export' });
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Laporan</h1>
          <p className="text-muted-foreground mt-1">Export laporan aset dan maintenance</p>
        </div>

        <Tabs defaultValue="assets">
          <TabsList>
            <TabsTrigger value="assets">Laporan Aset</TabsTrigger>
            <TabsTrigger value="maintenance">Laporan Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Export Laporan Aset</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {isSuperadmin && (
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select value={assetPropertyFilter} onValueChange={setAssetPropertyFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Property Ini</SelectItem>
                          <SelectItem value="all">Semua Property</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Lokasi</Label>
                    <Select value={assetLocationFilter} onValueChange={setAssetLocationFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Lokasi</SelectItem>
                        {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select value={assetCategoryFilter} onValueChange={setAssetCategoryFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {Object.entries(categoryLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kondisi</Label>
                    <Select value={assetConditionFilter} onValueChange={setAssetConditionFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kondisi</SelectItem>
                        {Object.entries(conditionLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={assetStatusFilter} onValueChange={setAssetStatusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        {Object.entries(statusLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => exportAssets('excel')} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Export Excel
                  </Button>
                  <Button variant="outline" onClick={() => exportAssets('pdf')} disabled={loading}>
                    <FileText className="h-4 w-4 mr-2" />Export PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Export Laporan Maintenance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {isSuperadmin && (
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select value={maintPropertyFilter} onValueChange={setMaintPropertyFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Property Ini</SelectItem>
                          <SelectItem value="all">Semua Property</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Lokasi</Label>
                    <Select value={maintLocationFilter} onValueChange={setMaintLocationFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Lokasi</SelectItem>
                        {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Asset</Label>
                    <Select value={maintAssetFilter} onValueChange={setMaintAssetFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Asset</SelectItem>
                        {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipe</Label>
                    <Select value={maintTypeFilter} onValueChange={setMaintTypeFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tipe</SelectItem>
                        {Object.entries(typeLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={maintStatusFilter} onValueChange={setMaintStatusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        {Object.entries(maintenanceStatusLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dari Tanggal</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sampai Tanggal</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => exportMaintenance('excel')} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Export Excel
                  </Button>
                  <Button variant="outline" onClick={() => exportMaintenance('pdf')} disabled={loading}>
                    <FileText className="h-4 w-4 mr-2" />Export PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
