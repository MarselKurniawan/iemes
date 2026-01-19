import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/contexts/PropertyContext';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, Edit, Trash2, Loader2, AlertTriangle, Search, Filter } from 'lucide-react';

type AssetCategory = 'peralatan_kamar' | 'peralatan_dapur' | 'mesin_laundry_housekeeping' | 'kendaraan_operasional' | 'peralatan_kantor_it' | 'peralatan_rekreasi_leisure' | 'infrastruktur' | 'elektronik' | 'perabot';
type AssetCondition = 'baik' | 'cukup' | 'perlu_perbaikan' | 'rusak';
type AssetStatus = 'aktif' | 'dalam_perbaikan' | 'tidak_aktif' | 'dihapuskan';

interface Asset {
  id: string;
  name: string;
  is_movable: boolean;
  location_id: string | null;
  category: AssetCategory;
  brand: string | null;
  series: string | null;
  purchase_price: number | null;
  condition: AssetCondition;
  status: AssetStatus;
  next_maintenance_date: string | null;
  locations?: { name: string } | null;
}

interface Location {
  id: string;
  name: string;
  type: string;
}

const categoryLabels: Record<AssetCategory, string> = {
  peralatan_kamar: 'Peralatan Kamar',
  peralatan_dapur: 'Peralatan Dapur',
  mesin_laundry_housekeeping: 'Mesin Laundry & Housekeeping',
  kendaraan_operasional: 'Kendaraan Operasional',
  peralatan_kantor_it: 'Peralatan Kantor & IT',
  peralatan_rekreasi_leisure: 'Peralatan Rekreasi & Leisure',
  infrastruktur: 'Infrastruktur',
  elektronik: 'Elektronik',
  perabot: 'Perabot',
};

const conditionLabels: Record<AssetCondition, { label: string; class: string }> = {
  baik: { label: 'Baik', class: 'bg-green-100 text-green-700' },
  cukup: { label: 'Cukup', class: 'bg-blue-100 text-blue-700' },
  perlu_perbaikan: { label: 'Perlu Perbaikan', class: 'bg-amber-100 text-amber-700' },
  rusak: { label: 'Rusak', class: 'bg-red-100 text-red-700' },
};

const statusLabels: Record<AssetStatus, { label: string; class: string }> = {
  aktif: { label: 'Aktif', class: 'bg-green-100 text-green-700' },
  dalam_perbaikan: { label: 'Dalam Perbaikan', class: 'bg-blue-100 text-blue-700' },
  tidak_aktif: { label: 'Tidak Aktif', class: 'bg-gray-100 text-gray-700' },
  dihapuskan: { label: 'Dihapuskan', class: 'bg-red-100 text-red-700' },
};

const Assets = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty } = useProperty();
  const { role } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');

  const [formData, setFormData] = useState({
    name: '',
    is_movable: false,
    location_id: '',
    category: 'peralatan_kamar' as AssetCategory,
    brand: '',
    series: '',
    purchase_price: '',
    condition: 'baik' as AssetCondition,
    status: 'aktif' as AssetStatus,
  });

  const canManage = role === 'superadmin' || role === 'hotel_manager';

  // Filtered assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.brand && asset.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.series && asset.series.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || asset.category === filterCategory;
    const matchesCondition = filterCondition === 'all' || asset.condition === filterCondition;
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
    const matchesLocation = filterLocation === 'all' || 
      (filterLocation === 'movable' && asset.is_movable) ||
      (asset.location_id === filterLocation);
    return matchesSearch && matchesCategory && matchesCondition && matchesStatus && matchesLocation;
  });

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) setSelectedProperty(property);
  }, [propertyId, properties]);

  const fetchAssets = async () => {
    if (!propertyId) return;
    
    const [assetsRes, locationsRes] = await Promise.all([
      supabase
        .from('assets')
        .select('*, locations(name)')
        .eq('property_id', propertyId)
        .order('name'),
      supabase
        .from('locations')
        .select('id, name, type')
        .eq('property_id', propertyId)
        .order('name'),
    ]);

    if (assetsRes.error) {
      toast({ title: 'Error', description: assetsRes.error.message, variant: 'destructive' });
    } else {
      setAssets(assetsRes.data || []);
    }

    setLocations(locationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, [propertyId]);

  const resetForm = () => {
    setFormData({
      name: '',
      is_movable: false,
      location_id: '',
      category: 'peralatan_kamar',
      brand: '',
      series: '',
      purchase_price: '',
      condition: 'baik',
      status: 'aktif',
    });
    setEditingAsset(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setSubmitting(true);

    const payload = {
      property_id: propertyId,
      name: formData.name,
      is_movable: formData.is_movable,
      location_id: formData.is_movable ? null : (formData.location_id || null),
      category: formData.category,
      brand: formData.brand || null,
      series: formData.series || null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      condition: formData.condition,
      status: formData.status,
    };

    if (editingAsset) {
      const { error } = await supabase
        .from('assets')
        .update(payload)
        .eq('id', editingAsset.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Aset berhasil diupdate' });
        fetchAssets();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase.from('assets').insert(payload);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Aset berhasil ditambahkan' });
        fetchAssets();
        setDialogOpen(false);
      }
    }

    setSubmitting(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus aset ini?')) return;
    
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Aset dihapus' });
      fetchAssets();
    }
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      is_movable: asset.is_movable,
      location_id: asset.location_id || '',
      category: asset.category,
      brand: asset.brand || '',
      series: asset.series || '',
      purchase_price: asset.purchase_price?.toString() || '',
      condition: asset.condition,
      status: asset.status,
    });
    setDialogOpen(true);
  };

  const isMaintenanceSoon = (date: string | null) => {
    if (!date) return false;
    const nextDate = new Date(date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return nextDate <= thirtyDaysFromNow && nextDate >= new Date();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Aset</h1>
            <p className="text-muted-foreground mt-1">
              Kelola aset dalam property ini
            </p>
          </div>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Aset
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingAsset ? 'Edit Aset' : 'Tambah Aset Baru'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Aset *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: AC Split 1 PK"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_movable"
                      checked={formData.is_movable}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_movable: !!checked })}
                    />
                    <Label htmlFor="is_movable">Aset Bergerak</Label>
                  </div>

                  {!formData.is_movable && (
                    <div className="space-y-2">
                      <Label>Lokasi</Label>
                      <Select 
                        value={formData.location_id} 
                        onValueChange={(v) => setFormData({ ...formData, location_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih lokasi" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Kategori *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(v) => setFormData({ ...formData, category: v as AssetCategory })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Merek</Label>
                      <Input
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="Opsional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Seri</Label>
                      <Input
                        value={formData.series}
                        onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                        placeholder="Opsional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Harga Beli</Label>
                    <Input
                      type="number"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      placeholder="Opsional"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Kondisi *</Label>
                      <Select 
                        value={formData.condition} 
                        onValueChange={(v) => setFormData({ ...formData, condition: v as AssetCondition })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(conditionLabels).map(([val, { label }]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status *</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(v) => setFormData({ ...formData, status: v as AssetStatus })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([val, { label }]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                      Batal
                    </Button>
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search and Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari aset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {Object.entries(categoryLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCondition} onValueChange={setFilterCondition}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Kondisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kondisi</SelectItem>
                  {Object.entries(conditionLabels).map(([val, { label }]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {Object.entries(statusLabels).map(([val, { label }]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Lokasi</SelectItem>
                  <SelectItem value="movable">Bergerak</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {filteredAssets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {assets.length === 0 ? 'Belum ada aset' : 'Tidak ada aset yang cocok'}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {assets.length === 0 ? 'Tambahkan aset untuk mulai tracking' : 'Coba ubah filter pencarian'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-20">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{asset.name}</span>
                          {isMaintenanceSoon(asset.next_maintenance_date) && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        {asset.brand && (
                          <span className="text-sm text-muted-foreground">
                            {asset.brand} {asset.series && `- ${asset.series}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{categoryLabels[asset.category]}</TableCell>
                      <TableCell>
                        {asset.is_movable ? (
                          <Badge variant="outline">Bergerak</Badge>
                        ) : (
                          asset.locations?.name || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={conditionLabels[asset.condition].class}>
                          {conditionLabels[asset.condition].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[asset.status].class}>
                          {statusLabels[asset.status].label}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(asset)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Assets;
