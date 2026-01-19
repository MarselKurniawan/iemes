import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/contexts/PropertyContext';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Plus, Wrench, Edit, Trash2, Loader2, Eye, Upload, X, Image, Search, Filter } from 'lucide-react';

type MaintenanceType = 'renovasi_lokasi' | 'perbaikan_aset';
type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface MaintenanceItem {
  id: string;
  title: string;
  type: MaintenanceType;
  description: string | null;
  evidence_urls: string[] | null;
  total_cost: number;
  status: MaintenanceStatus;
  start_date: string;
  end_date: string | null;
  asset_id: string | null;
  location_id: string | null;
  assets?: { name: string } | null;
  locations?: { name: string } | null;
}

interface Asset {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

const typeLabels: Record<MaintenanceType, string> = {
  renovasi_lokasi: 'Renovasi Lokasi',
  perbaikan_aset: 'Perbaikan Aset',
};

const statusLabels: Record<MaintenanceStatus, { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'Dalam Proses', class: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Selesai', class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dibatalkan', class: 'bg-gray-100 text-gray-700' },
};

const Maintenance = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty } = useProperty();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [staffEditDialogOpen, setStaffEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null);
  const [editingItem, setEditingItem] = useState<MaintenanceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    type: 'perbaikan_aset' as MaintenanceType,
    description: '',
    total_cost: '',
    status: 'pending' as MaintenanceStatus,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    asset_id: '',
    location_id: '',
  });

  const canManage = role === 'superadmin' || role === 'hotel_manager';
  const canDelete = role === 'superadmin' || role === 'hotel_manager';
  const isStaff = role === 'staff';

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesDateFrom = !filterDateFrom || item.start_date >= filterDateFrom;
    const matchesDateTo = !filterDateTo || item.start_date <= filterDateTo;
    return matchesSearch && matchesType && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) setSelectedProperty(property);
  }, [propertyId, properties]);

  const fetchData = async () => {
    if (!propertyId) return;

    const [maintenanceRes, assetsRes, locationsRes] = await Promise.all([
      supabase
        .from('maintenance')
        .select('*, assets(name), locations(name)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false }),
      supabase.from('assets').select('id, name').eq('property_id', propertyId),
      supabase.from('locations').select('id, name').eq('property_id', propertyId),
    ]);

    if (maintenanceRes.error) {
      toast({ title: 'Error', description: maintenanceRes.error.message, variant: 'destructive' });
    } else {
      setItems(maintenanceRes.data || []);
    }

    setAssets(assetsRes.data || []);
    setLocations(locationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'perbaikan_aset',
      description: '',
      total_cost: '',
      status: 'pending',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      asset_id: '',
      location_id: '',
    });
    setEditingItem(null);
    setEvidenceFiles([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${propertyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Error Upload', description: uploadError.message, variant: 'destructive' });
      } else {
        const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
        uploadedUrls.push(publicUrl);
      }
    }

    setEvidenceFiles([...evidenceFiles, ...uploadedUrls]);
    setUploading(false);
  };

  const removeEvidence = (index: number) => {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !user) return;
    setSubmitting(true);

    const payload = {
      property_id: propertyId,
      title: formData.title,
      type: formData.type,
      description: formData.description || null,
      evidence_urls: evidenceFiles.length > 0 ? evidenceFiles : null,
      total_cost: parseFloat(formData.total_cost) || 0,
      status: formData.status,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      asset_id: formData.type === 'perbaikan_aset' ? (formData.asset_id || null) : null,
      location_id: formData.type === 'renovasi_lokasi' ? (formData.location_id || null) : null,
      created_by: user.id,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('maintenance')
        .update(payload)
        .eq('id', editingItem.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Data maintenance diupdate' });
        fetchData();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase.from('maintenance').insert(payload);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Maintenance ditambahkan' });
        fetchData();
        setDialogOpen(false);
      }
    }

    setSubmitting(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus maintenance ini?')) return;

    const { error } = await supabase.from('maintenance').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Maintenance dihapus' });
      fetchData();
    }
  };

  const openEditDialog = (item: MaintenanceItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      type: item.type,
      description: item.description || '',
      total_cost: item.total_cost.toString(),
      status: item.status,
      start_date: item.start_date,
      end_date: item.end_date || '',
      asset_id: item.asset_id || '',
      location_id: item.location_id || '',
    });
    setEvidenceFiles(item.evidence_urls || []);
    
    // Staff uses separate dialog with limited fields
    if (isStaff) {
      setStaffEditDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);

    // Staff can only update: status, start_date, end_date, evidence_urls
    const payload = {
      status: formData.status,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      evidence_urls: evidenceFiles.length > 0 ? evidenceFiles : null,
    };

    const { error } = await supabase
      .from('maintenance')
      .update(payload)
      .eq('id', editingItem.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Data maintenance diupdate' });
      fetchData();
      setStaffEditDialogOpen(false);
    }

    setSubmitting(false);
    resetForm();
  };

  const openDetailDialog = (item: MaintenanceItem) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
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
            <h1 className="text-3xl font-bold">Maintenance</h1>
            <p className="text-muted-foreground mt-1">
              Kelola maintenance dan perbaikan
            </p>
          </div>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Maintenance
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Edit Maintenance' : 'Tambah Maintenance Baru'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Judul *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Contoh: Perbaikan AC Kamar 101"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipe *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as MaintenanceType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perbaikan_aset">Perbaikan Aset</SelectItem>
                      <SelectItem value="renovasi_lokasi">Renovasi Lokasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'perbaikan_aset' && (
                  <div className="space-y-2">
                    <Label>Aset</Label>
                    <Select
                      value={formData.asset_id}
                      onValueChange={(v) => setFormData({ ...formData, asset_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih aset" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map(asset => (
                          <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.type === 'renovasi_lokasi' && (
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
                  <Label>Deskripsi</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Opsional"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Evidence</Label>
                  <div className="border-2 border-dashed rounded-lg p-4">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="evidence-upload"
                      disabled={uploading}
                    />
                    <label
                      htmlFor="evidence-upload"
                      className="flex flex-col items-center cursor-pointer"
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Klik untuk upload foto</span>
                        </>
                      )}
                    </label>
                  </div>
                  {evidenceFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {evidenceFiles.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img src={url} alt="" className="w-16 h-16 object-cover rounded" />
                          <button
                            type="button"
                            onClick={() => removeEvidence(idx)}
                            className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Total Biaya *</Label>
                    <Input
                      type="number"
                      value={formData.total_cost}
                      onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as MaintenanceStatus })}
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tanggal Mulai *</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Selesai</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
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
                placeholder="Cari maintenance..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  {Object.entries(typeLabels).map(([val, label]) => (
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
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Dari:</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Sampai:</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-36"
                />
              </div>
            </div>
          </div>
        </Card>

        {filteredItems.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {items.length === 0 ? 'Belum ada maintenance' : 'Tidak ada data yang cocok'}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {items.length === 0 ? 'Tambahkan data maintenance untuk tracking perbaikan' : 'Coba ubah filter pencarian'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judul</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Biaya</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{typeLabels[item.type]}</TableCell>
                      <TableCell>
                        {item.type === 'perbaikan_aset'
                          ? item.assets?.name || '-'
                          : item.locations?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(item.start_date).toLocaleDateString('id-ID')}
                        {item.end_date && (
                          <span className="text-muted-foreground">
                            {' → '}{new Date(item.end_date).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        Rp {item.total_cost.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[item.status].class}>
                          {statusLabels[item.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openDetailDialog(item)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detail Maintenance</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Judul</Label>
                  <p className="font-medium">{selectedItem.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Tipe</Label>
                    <p>{typeLabels[selectedItem.type]}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={statusLabels[selectedItem.status].class}>
                      {statusLabels[selectedItem.status].label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Target</Label>
                  <p>
                    {selectedItem.type === 'perbaikan_aset'
                      ? selectedItem.assets?.name || '-'
                      : selectedItem.locations?.name || '-'}
                  </p>
                </div>
                {selectedItem.description && (
                  <div>
                    <Label className="text-muted-foreground">Deskripsi</Label>
                    <p>{selectedItem.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Tanggal Mulai</Label>
                    <p>{new Date(selectedItem.start_date).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tanggal Selesai</Label>
                    <p>{selectedItem.end_date ? new Date(selectedItem.end_date).toLocaleDateString('id-ID') : '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Biaya</Label>
                  <p className="font-semibold">Rp {selectedItem.total_cost.toLocaleString('id-ID')}</p>
                </div>
                {selectedItem.evidence_urls && selectedItem.evidence_urls.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Evidence</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedItem.evidence_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" className="w-20 h-20 object-cover rounded hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Staff Edit Dialog - Limited Fields */}
        <Dialog open={staffEditDialogOpen} onOpenChange={(open) => { setStaffEditDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Status Maintenance</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              {editingItem && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{editingItem.title}</p>
                  <p className="text-sm text-muted-foreground">{typeLabels[editingItem.type]}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as MaintenanceStatus })}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tanggal Mulai *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Evidence</Label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="staff-evidence-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="staff-evidence-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Klik untuk upload foto</span>
                      </>
                    )}
                  </label>
                </div>
                {evidenceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {evidenceFiles.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => removeEvidence(idx)}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setStaffEditDialogOpen(false)} className="flex-1">
                  Batal
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Maintenance;
