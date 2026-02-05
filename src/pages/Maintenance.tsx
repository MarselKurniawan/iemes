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
import { Plus, Wrench, Edit, Trash2, Loader2, Eye, X, Search, Filter, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { ImageGalleryInput } from '@/components/ui/image-gallery';
import { generateMaintenanceDetailPdf } from '@/lib/maintenance-pdf';

type MaintenanceType = 'renovasi_lokasi' | 'perbaikan_aset';
type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

interface MaintenanceItem {
  id: string;
  code: string;
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
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  assets?: { name: string } | null;
  locations?: { name: string } | null;
}

interface Asset {
  id: string;
  name: string;
  is_movable: boolean;
  location_id: string | null;
}

type LocationTag = 'all' | 'aset_bergerak' | 'lokasi';

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

const approvalLabels: Record<ApprovalStatus, { label: string; class: string }> = {
  pending_approval: { label: 'Menunggu Approval', class: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Disetujui', class: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Ditolak', class: 'bg-red-100 text-red-700' },
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
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
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
  const [filterApproval, setFilterApproval] = useState<string>('all');

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
    location_tag: '' as LocationTag | '',
  });

  const canManage = role === 'superadmin' || role === 'hotel_manager' || role === 'supervisor';
  const canDelete = role === 'superadmin' || role === 'hotel_manager' || role === 'supervisor';
  const canApprove = role === 'superadmin' || role === 'supervisor';
  const isStaff = role === 'staff';
  const canCreate = role !== 'staff' || role === 'staff'; // All roles can create, but staff requests need approval

  // Filter assets based on location tag selection
  const filteredAssetsByTag = assets.filter(asset => {
    if (!formData.location_tag) return true;
    if (formData.location_tag === 'aset_bergerak') return asset.is_movable;
    if (formData.location_tag === 'lokasi') return !asset.is_movable && asset.location_id === formData.location_id;
    return true;
  });

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesDateFrom = !filterDateFrom || item.start_date >= filterDateFrom;
    const matchesDateTo = !filterDateTo || item.start_date <= filterDateTo;
    const matchesApproval = filterApproval === 'all' || item.approval_status === filterApproval;
    return matchesSearch && matchesType && matchesStatus && matchesDateFrom && matchesDateTo && matchesApproval;
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
      supabase.from('assets').select('id, name, is_movable, location_id').eq('property_id', propertyId),
      supabase.from('locations').select('id, name').eq('property_id', propertyId),
    ]);

    if (maintenanceRes.error) {
      toast({ title: 'Error', description: maintenanceRes.error.message, variant: 'destructive' });
    } else {
      setItems((maintenanceRes.data || []) as MaintenanceItem[]);
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
      location_tag: '',
    });
    setEditingItem(null);
    setEvidenceFiles([]);
  };

  // Upload photo with WebP (file sudah diconvert oleh ImageGalleryInput)
  const uploadEvidence = async (file: File): Promise<string | null> => {
    setUploading(true);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
    const filePath = `${propertyId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('evidence')
      .upload(filePath, file, {
        contentType: 'image/webp',
      });

    setUploading(false);

    if (uploadError) {
      toast({ title: 'Error Upload', description: uploadError.message, variant: 'destructive' });
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
    return publicUrl;
  };

  // Storage URL for direct access
  const storageUrl = `https://wzabyfciqcuecmslyjwc.supabase.co/storage/v1/object/public/evidence/${propertyId}/`;

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
      approval_status: 'pending_approval',
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
      // code is auto-generated by database trigger
      const { error } = await supabase.from('maintenance').insert(payload as any);

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
    // Determine location_tag based on asset's is_movable property
    const assetData = assets.find(a => a.id === item.asset_id);
    const locationTag = assetData 
      ? (assetData.is_movable ? 'aset_bergerak' : 'lokasi') 
      : '';
    
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
      location_tag: locationTag as LocationTag | '',
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

  const handleApprove = async (item: MaintenanceItem) => {
    if (!user) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('maintenance')
      .update({
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Maintenance request disetujui' });
      fetchData();
    }
    setSubmitting(false);
  };

  const openRejectDialog = (item: MaintenanceItem) => {
    setSelectedItem(item);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedItem || !user) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('maintenance')
      .update({
        approval_status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason || null,
      })
      .eq('id', selectedItem.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Maintenance request ditolak' });
      fetchData();
      setRejectDialogOpen(false);
    }
    setSubmitting(false);
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
          {/* All roles can create maintenance requests */}
          {canCreate && (
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
                  <>
                    <div className="space-y-2">
                      <Label>Tag Lokasi Aset *</Label>
                      <Select
                        value={formData.location_tag}
                        onValueChange={(v) => setFormData({ ...formData, location_tag: v as LocationTag, asset_id: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenis lokasi aset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aset_bergerak">Aset Bergerak</SelectItem>
                          <SelectItem value="lokasi">Lokasi Tetap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.location_tag === 'lokasi' && (
                      <div className="space-y-2">
                        <Label>Pilih Lokasi *</Label>
                        <Select
                          value={formData.location_id}
                          onValueChange={(v) => setFormData({ ...formData, location_id: v, asset_id: '' })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih lokasi dulu" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(formData.location_tag === 'aset_bergerak' || (formData.location_tag === 'lokasi' && formData.location_id)) && (
                      <div className="space-y-2">
                        <Label>Aset *</Label>
                        <Select
                          value={formData.asset_id}
                          onValueChange={(v) => setFormData({ ...formData, asset_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih aset" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredAssetsByTag.length > 0 ? (
                              filteredAssetsByTag.map(asset => (
                                <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada aset</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
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
                  <ImageGalleryInput
                    images={evidenceFiles}
                    onImagesChange={setEvidenceFiles}
                    onUpload={uploadEvidence}
                    uploading={uploading}
                    showStorageLink={true}
                    storageUrl={storageUrl}
                  />
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
              <Select value={filterApproval} onValueChange={setFilterApproval}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Approval</SelectItem>
                  {Object.entries(approvalLabels).map(([val, { label }]) => (
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
                    <TableHead className="w-36">Kode</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Biaya</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-36">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {item.code}
                        </code>
                      </TableCell>
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
                        <Badge className={approvalLabels[item.approval_status]?.class || 'bg-gray-100 text-gray-700'}>
                          {approvalLabels[item.approval_status]?.label || item.approval_status}
                        </Badge>
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
                          {canApprove && item.approval_status === 'pending_approval' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleApprove(item)}
                                disabled={submitting}
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openRejectDialog(item)}
                                disabled={submitting}
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {item.approval_status === 'approved' && (
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
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
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      generateMaintenanceDetailPdf({
                        code: selectedItem.code,
                        title: selectedItem.title,
                        type: selectedItem.type,
                        status: selectedItem.status,
                        approval_status: selectedItem.approval_status,
                        target: selectedItem.type === 'perbaikan_aset'
                          ? selectedItem.assets?.name || '-'
                          : selectedItem.locations?.name || '-',
                        description: selectedItem.description,
                        start_date: selectedItem.start_date,
                        end_date: selectedItem.end_date,
                        total_cost: selectedItem.total_cost,
                        rejection_reason: selectedItem.rejection_reason,
                        approved_at: selectedItem.approved_at,
                      });
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Print PDF
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {selectedItem.code}
                  </code>
                  <span className="text-muted-foreground">•</span>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Approval</Label>
                    <Badge className={approvalLabels[selectedItem.approval_status]?.class || 'bg-gray-100 text-gray-700'}>
                      {approvalLabels[selectedItem.approval_status]?.label || selectedItem.approval_status}
                    </Badge>
                  </div>
                  {selectedItem.approved_at && (
                    <div>
                      <Label className="text-muted-foreground">Tanggal Approval</Label>
                      <p>{new Date(selectedItem.approved_at).toLocaleDateString('id-ID')}</p>
                    </div>
                  )}
                </div>
                {selectedItem.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <Label className="text-red-700">Alasan Penolakan</Label>
                    <p className="text-red-600">{selectedItem.rejection_reason}</p>
                  </div>
                )}
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
                <ImageGalleryInput
                  images={evidenceFiles}
                  onImagesChange={setEvidenceFiles}
                  onUpload={uploadEvidence}
                  uploading={uploading}
                  showStorageLink={true}
                  storageUrl={storageUrl}
                />
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

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tolak Maintenance Request</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedItem.title}</p>
                  <p className="text-sm text-muted-foreground">{typeLabels[selectedItem.type]}</p>
                </div>
                <div className="space-y-2">
                  <Label>Alasan Penolakan</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Berikan alasan penolakan..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setRejectDialogOpen(false)} className="flex-1">
                    Batal
                  </Button>
                  <Button 
                    onClick={handleReject} 
                    disabled={submitting} 
                    variant="destructive"
                    className="flex-1"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tolak Request'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Maintenance;
