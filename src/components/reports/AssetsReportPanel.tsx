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
  categoryLabels,
  conditionLabels,
  statusLabels,
  type AssetCategory,
  type AssetCondition,
  type AssetStatus,
} from './reportLabels';

type AssetRow = {
  id: string;
  name: string;
  category: string | null;
  condition: string | null;
  status: string | null;
  is_movable: boolean | null;
  brand: string | null;
  series: string | null;
  purchase_price: number | null;
  properties?: { name: string } | null;
  locations?: { name: string } | null;
};

function clampForIlike(v: string) {
  return v.replace(/%/g, '').replace(/_/g, '').trim();
}

export default function AssetsReportPanel(props: {
  propertyId?: string;
  selectedPropertyName?: string;
  isSuperadmin: boolean;
}) {
  const { toast } = useToast();
  const { propertyId, selectedPropertyName, isSuperadmin } = props;

  const [exportLoading, setExportLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [assetLocationFilter, setAssetLocationFilter] = useState('all');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('all');
  const [assetConditionFilter, setAssetConditionFilter] = useState('all');
  const [assetStatusFilter, setAssetStatusFilter] = useState('all');
  const [assetPropertyFilter, setAssetPropertyFilter] = useState<'current' | 'all'>('current');
  const [assetSearch, setAssetSearch] = useState('');

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<AssetRow[]>([]);
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
    let query = supabase.from('assets').select('*, locations(name), properties(name)');

    if (assetPropertyFilter === 'current' && propertyId) {
      query = query.eq('property_id', propertyId);
    }

    if (assetLocationFilter !== 'all') query = query.eq('location_id', assetLocationFilter);
    if (assetCategoryFilter !== 'all') query = query.eq('category', assetCategoryFilter as any);
    if (assetConditionFilter !== 'all') query = query.eq('condition', assetConditionFilter as any);
    if (assetStatusFilter !== 'all') query = query.eq('status', assetStatusFilter as any);

    const q = clampForIlike(assetSearch);
    if (q) query = query.ilike('name', `%${q}%`);

    return query;
  };

  const fetchDropdownData = async () => {
    const targetPropertyId = assetPropertyFilter === 'all' ? null : propertyId;

    if (targetPropertyId) {
      const locRes = await supabase.from('locations').select('id, name').eq('property_id', targetPropertyId);
      setLocations(locRes.data || []);
    } else if (isSuperadmin && assetPropertyFilter === 'all') {
      const locRes = await supabase.from('locations').select('id, name');
      setLocations(locRes.data || []);
    } else {
      setLocations([]);
    }
  };

  const fetchPreview = async () => {
    setPreviewLoading(true);
    const { data, error } = await buildBaseQuery().order('name');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setPreviewLoading(false);
      return;
    }
    setRows((data as AssetRow[]) || []);
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
    assetPropertyFilter,
    assetLocationFilter,
    assetCategoryFilter,
    assetConditionFilter,
    assetStatusFilter,
    assetSearch,
  ]);

  const exportAssets = async (format: 'excel' | 'pdf') => {
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
      toast({ title: 'Info', description: 'Tidak ada data aset untuk di-export', variant: 'default' });
      setExportLoading(false);
      return;
    }

    const rowsOut = (data as AssetRow[]).map(a => {
      const cat = a.category as AssetCategory;
      const cond = a.condition as AssetCondition;
      const stat = a.status as AssetStatus;
      return {
        Property: a.properties?.name || '-',
        Nama: a.name,
        Kategori: categoryLabels[cat] || a.category || '-',
        Lokasi: a.locations?.name || (a.is_movable ? 'Bergerak' : '-'),
        Merek: a.brand || '-',
        Seri: a.series || '-',
        'Harga Beli': a.purchase_price || 0,
        Kondisi: conditionLabels[cond] || a.condition || '-',
        Status: statusLabels[stat] || a.status || '-',
      };
    });

    const fileName = assetPropertyFilter === 'all'
      ? 'assets_all_properties'
      : `assets_${selectedPropertyName || 'report'}`;

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rowsOut);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Assets');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text(
        `Laporan Aset${assetPropertyFilter === 'all' ? ' - Semua Property' : ` - ${selectedPropertyName || ''}`}`,
        14,
        15,
      );
      const headers = Object.keys(rowsOut[0]);
      const bodyData = rowsOut.map(r => Object.values(r));
      autoTable(doc, { head: [headers], body: bodyData, startY: 25, styles: { fontSize: 8 } });
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
        <CardTitle>Export Laporan Aset</CardTitle>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {isSuperadmin && (
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={assetPropertyFilter} onValueChange={(v) => setAssetPropertyFilter(v as any)}>
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

              <div className="space-y-2">
                <Label>Cari Nama Aset</Label>
                <Input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Contoh: AC, TV, ..." />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={() => exportAssets('excel')} disabled={exportLoading}>
            {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export Excel{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
          <Button variant="outline" onClick={() => exportAssets('pdf')} disabled={exportLoading}>
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
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Kondisi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Property</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="py-8 text-center text-muted-foreground">Tidak ada data.</div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(r => {
                  const checked = selectedIds.includes(r.id);
                  const cat = r.category as AssetCategory;
                  const cond = r.condition as AssetCondition;
                  const stat = r.status as AssetStatus;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = Boolean(v);
                            setSelectedIds(next ? [...selectedIds, r.id] : selectedIds.filter(id => id !== r.id));
                          }}
                          aria-label={`Pilih ${r.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{categoryLabels[cat] || r.category || '-'}</TableCell>
                      <TableCell>{r.locations?.name || (r.is_movable ? 'Bergerak' : '-')}</TableCell>
                      <TableCell>{conditionLabels[cond] || r.condition || '-'}</TableCell>
                      <TableCell>{statusLabels[stat] || r.status || '-'}</TableCell>
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
