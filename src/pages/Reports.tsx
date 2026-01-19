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
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty, selectedProperty } = useProperty();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) setSelectedProperty(property);
  }, [propertyId, properties]);

  useEffect(() => {
    if (propertyId) {
      supabase.from('locations').select('id, name').eq('property_id', propertyId).then(({ data }) => {
        setLocations(data || []);
      });
    }
  }, [propertyId]);

  const exportAssets = async (format: 'excel' | 'pdf') => {
    if (!propertyId) return;
    setLoading(true);

    let query = supabase.from('assets').select('*, locations(name)').eq('property_id', propertyId);
    if (locationFilter !== 'all') query = query.eq('location_id', locationFilter);

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

    const rows = data.map(a => ({
      Nama: a.name,
      Kategori: a.category,
      Lokasi: a.locations?.name || (a.is_movable ? 'Bergerak' : '-'),
      Merek: a.brand || '-',
      Seri: a.series || '-',
      'Harga Beli': a.purchase_price || 0,
      Kondisi: a.condition,
      Status: a.status,
    }));

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Assets');
      XLSX.writeFile(wb, `assets_${selectedProperty?.name || 'report'}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text(`Laporan Aset - ${selectedProperty?.name || ''}`, 14, 15);
      const headers = Object.keys(rows[0]);
      const bodyData = rows.map(r => Object.values(r));
      autoTable(doc, { head: [headers], body: bodyData, startY: 25 });
      doc.save(`assets_${selectedProperty?.name || 'report'}.pdf`);
    }

    toast({ title: 'Berhasil', description: 'Laporan berhasil di-export' });
    setLoading(false);
  };

  const exportMaintenance = async (format: 'excel' | 'pdf') => {
    if (!propertyId) return;
    setLoading(true);

    let query = supabase.from('maintenance').select('*, assets(name), locations(name)').eq('property_id', propertyId);
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

    const rows = data.map(m => ({
      Judul: m.title,
      Tipe: m.type,
      Target: m.assets?.name || m.locations?.name || '-',
      'Tanggal Mulai': m.start_date,
      'Tanggal Selesai': m.end_date || '-',
      'Total Biaya': m.total_cost,
      Status: m.status,
      Deskripsi: m.description || '-',
    }));

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance');
      XLSX.writeFile(wb, `maintenance_${selectedProperty?.name || 'report'}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text(`Laporan Maintenance - ${selectedProperty?.name || ''}`, 14, 15);
      const headers = Object.keys(rows[0]);
      const bodyData = rows.map(r => Object.values(r));
      autoTable(doc, { head: [headers], body: bodyData, startY: 25 });
      doc.save(`maintenance_${selectedProperty?.name || 'report'}.pdf`);
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
                <div className="space-y-2">
                  <Label>Filter Lokasi</Label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Lokasi</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
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
                <div className="flex gap-4">
                  <div className="space-y-2">
                    <Label>Dari Tanggal</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sampai Tanggal</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3">
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
