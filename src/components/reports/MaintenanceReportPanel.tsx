import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileText, Loader2, ChevronDown, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  maintenanceStatusLabels,
  typeLabels,
  approvalStatusLabels,
  type MaintenanceStatus,
  type MaintenanceType,
  type ApprovalStatus,
} from './reportLabels';

type MaintenanceRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  approval_status: string;
  start_date: string;
  end_date: string | null;
  total_cost: number | null;
  description: string | null;
  evidence_urls: string[] | null;
  rejection_reason: string | null;
  assets?: { name: string } | null;
  locations?: { name: string } | null;
  properties?: { name: string } | null;
};

function clampForIlike(v: string) {
  return v.replace(/%/g, '').replace(/_/g, '').trim();
}

export default function MaintenanceReportPanel(props: {
  propertyId?: string;
  selectedPropertyName?: string;
  isSuperadmin: boolean;
}) {
  const { toast } = useToast();
  const { propertyId, selectedPropertyName, isSuperadmin } = props;

  const [exportLoading, setExportLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [maintLocationFilter, setMaintLocationFilter] = useState('all');
  const [maintAssetFilter, setMaintAssetFilter] = useState('all');
  const [maintTypeFilter, setMaintTypeFilter] = useState('all');
  const [maintStatusFilter, setMaintStatusFilter] = useState('all');
  const [maintPropertyFilter, setMaintPropertyFilter] = useState<'current' | 'all'>('current');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [titleSearch, setTitleSearch] = useState('');

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visibleIds = useMemo(() => rows.map(r => r.id), [rows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      const merged = new Set([...selectedIds, ...visibleIds]);
      setSelectedIds(Array.from(merged));
    } else {
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
    }
  };

  const buildBaseQuery = () => {
    let query = supabase.from('maintenance').select('*, assets(name), locations(name), properties(name)');

    if (maintPropertyFilter === 'current' && propertyId) {
      query = query.eq('property_id', propertyId);
    }

    if (maintLocationFilter !== 'all') query = query.eq('location_id', maintLocationFilter);
    if (maintAssetFilter !== 'all') query = query.eq('asset_id', maintAssetFilter);
    if (maintTypeFilter !== 'all') query = query.eq('type', maintTypeFilter as any);
    if (maintStatusFilter !== 'all') query = query.eq('status', maintStatusFilter as any);
    if (dateFrom) query = query.gte('start_date', dateFrom);
    if (dateTo) query = query.lte('start_date', dateTo);

    const q = clampForIlike(titleSearch);
    if (q) query = query.ilike('title', `%${q}%`);

    return query;
  };

  const fetchDropdownData = async () => {
    const targetPropertyId = maintPropertyFilter === 'all' ? null : propertyId;

    if (targetPropertyId) {
      const [locRes, assetRes] = await Promise.all([
        supabase.from('locations').select('id, name').eq('property_id', targetPropertyId),
        supabase.from('assets').select('id, name').eq('property_id', targetPropertyId),
      ]);
      setLocations(locRes.data || []);
      setAssets(assetRes.data || []);
    } else if (isSuperadmin && maintPropertyFilter === 'all') {
      const [locRes, assetRes] = await Promise.all([
        supabase.from('locations').select('id, name'),
        supabase.from('assets').select('id, name'),
      ]);
      setLocations(locRes.data || []);
      setAssets(assetRes.data || []);
    } else {
      setLocations([]);
      setAssets([]);
    }
  };

  const fetchPreview = async () => {
    setPreviewLoading(true);
    const { data, error } = await buildBaseQuery().order('start_date', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setPreviewLoading(false);
      return;
    }
    setRows((data as MaintenanceRow[]) || []);
    setPreviewLoading(false);
  };

  useEffect(() => {
    if (propertyId || isSuperadmin) {
      fetchDropdownData();
      fetchPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    propertyId,
    isSuperadmin,
    maintPropertyFilter,
    maintLocationFilter,
    maintAssetFilter,
    maintTypeFilter,
    maintStatusFilter,
    dateFrom,
    dateTo,
    titleSearch,
  ]);

  const exportMaintenance = async (format: 'excel' | 'pdf') => {
    setExportLoading(true);

    let query = buildBaseQuery();
    if (selectedIds.length > 0) query = query.in('id', selectedIds);

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setExportLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({ title: 'Info', description: 'Tidak ada data maintenance untuk di-export', variant: 'default' });
      setExportLoading(false);
      return;
    }

    const rowsOut = (data as MaintenanceRow[]).map(m => {
      const typ = m.type as MaintenanceType;
      const stat = m.status as MaintenanceStatus;
      const appr = m.approval_status as ApprovalStatus;
      return {
        Property: m.properties?.name || '-',
        Kode: m.code,
        Judul: m.title,
        Tipe: typeLabels[typ] || m.type,
        Target: m.assets?.name || m.locations?.name || '-',
        'Tanggal Mulai': m.start_date,
        'Tanggal Selesai': m.end_date || '-',
        'Total Biaya': m.total_cost || 0,
        Approval: approvalStatusLabels[appr] || m.approval_status,
        Status: maintenanceStatusLabels[stat] || m.status,
        Deskripsi: m.description || '-',
        Evidence: m.evidence_urls?.join(', ') || '-',
      };
    });

    const fileName = maintPropertyFilter === 'all'
      ? 'maintenance_all_properties'
      : `maintenance_${selectedPropertyName || 'report'}`;

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rowsOut);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text(
        `Laporan Maintenance${maintPropertyFilter === 'all' ? ' - Semua Property' : ` - ${selectedPropertyName || ''}`}`,
        14,
        15,
      );
      const headers = Object.keys(rowsOut[0]);
      const bodyData = rowsOut.map(r => Object.values(r));
      autoTable(doc, { head: [headers], body: bodyData, startY: 25, styles: { fontSize: 7 } });
      doc.save(`${fileName}.pdf`);
    }

    toast({
      title: 'Berhasil',
      description: selectedIds.length > 0 ? 'Laporan (terpilih) berhasil di-export' : 'Laporan berhasil di-export',
    });
    setExportLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Laporan Maintenance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Data
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {isSuperadmin && (
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={maintPropertyFilter} onValueChange={(v) => setMaintPropertyFilter(v as any)}>
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

              <div className="space-y-2 md:col-span-2">
                <Label>Cari Judul Maintenance</Label>
                <Input value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} placeholder="Contoh: perbaikan AC, renovasi lobby, ..." />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={() => exportMaintenance('excel')} disabled={exportLoading}>
            {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export Excel{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
          <Button variant="outline" onClick={() => exportMaintenance('pdf')} disabled={exportLoading}>
            <FileText className="h-4 w-4 mr-2" />Export PDF{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
          <div className="text-sm text-muted-foreground">
            {selectedIds.length > 0 ? 'Hanya baris yang dicentang akan di-export.' : 'Jika tidak ada yang dicentang, export semua hasil filter.'}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(v) => toggleSelectAllVisible(Boolean(v))}
                    aria-label="Pilih semua yang tampil"
                  />
                </TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Property</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="py-8 text-center text-muted-foreground">Tidak ada data.</div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(r => {
                  const checked = selectedIds.includes(r.id);
                  const typ = r.type as MaintenanceType;
                  const stat = r.status as MaintenanceStatus;
                  const appr = r.approval_status as ApprovalStatus;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = Boolean(v);
                            setSelectedIds(next ? [...selectedIds, r.id] : selectedIds.filter(id => id !== r.id));
                          }}
                          aria-label={`Pilih ${r.title}`}
                        />
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{r.code}</code>
                      </TableCell>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{typeLabels[typ] || r.type}</TableCell>
                      <TableCell>{r.assets?.name || r.locations?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">Mulai</div>
                        <div>{r.start_date}</div>
                        {r.end_date && (
                          <>
                            <div className="mt-1 text-xs text-muted-foreground">Selesai</div>
                            <div>{r.end_date}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell>{approvalStatusLabels[appr] || r.approval_status}</TableCell>
                      <TableCell>{maintenanceStatusLabels[stat] || r.status}</TableCell>
                      <TableCell>{r.properties?.name || '-'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
