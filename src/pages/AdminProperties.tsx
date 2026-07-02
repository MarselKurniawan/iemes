import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, Edit, Trash2, Loader2, Search, MapPin, ImagePlus, X } from 'lucide-react';
import { uploadToExternalStorage } from '@/lib/external-storage';
import { convertToWebP } from '@/lib/image-utils';

interface Property {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  image_url: string | null;
}

const gradients = [
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-sky-500 via-cyan-500 to-teal-500',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-emerald-500 via-green-500 to-lime-500',
  'from-fuchsia-500 via-pink-500 to-red-500',
  'from-blue-600 via-indigo-500 to-violet-500',
];

const AdminProperties = () => {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', description: '', image_url: '' });
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProperties = async () => {
    const { data, error } = await supabase.from('properties').select('*').order('name');
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setProperties((data as Property[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [properties, query]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const webp = await convertToWebP(file, 0.85);
      const url = await uploadToExternalStorage(webp, editingProperty?.id || 'properties');
      if (!url) throw new Error('Upload gagal');
      setFormData((f) => ({ ...f, image_url: url }));
      toast({ title: 'Berhasil', description: 'Gambar diupload' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Upload gagal', variant: 'destructive' });
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: formData.name,
      address: formData.address || null,
      description: formData.description || null,
      image_url: formData.image_url || null,
    };

    if (editingProperty) {
      const { error } = await supabase.from('properties').update(payload).eq('id', editingProperty.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else {
        toast({ title: 'Berhasil', description: 'Property diupdate' });
        fetchProperties();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase.from('properties').insert(payload);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else {
        toast({ title: 'Berhasil', description: 'Property ditambahkan' });
        fetchProperties();
        setDialogOpen(false);
      }
    }
    setSubmitting(false);
    setFormData({ name: '', address: '', description: '', image_url: '' });
    setEditingProperty(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Berhasil', description: 'Property dihapus' });
      fetchProperties();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEdit = (p: Property) => {
    setEditingProperty(p);
    setFormData({
      name: p.name,
      address: p.address || '',
      description: p.description || '',
      image_url: p.image_url || '',
    });
    setDialogOpen(true);
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Kelola Property</h1>
            <p className="text-muted-foreground mt-2">Tambah dan kelola property dengan mudah</p>
          </div>
          <div className="flex items-center gap-3 md:justify-end w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari Property..."
                className="pl-9 rounded-full bg-muted/50 border-transparent focus-visible:bg-background"
              />
            </div>
            <Dialog
              open={dialogOpen}
              onOpenChange={(o) => {
                setDialogOpen(o);
                if (!o) {
                  setEditingProperty(null);
                  setFormData({ name: '', address: '', description: '', image_url: '' });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="rounded-full shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Property
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProperty ? 'Edit Property' : 'Tambah Property'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Gambar Property</Label>
                    {formData.image_url ? (
                      <div className="relative rounded-xl overflow-hidden border">
                        <img
                          src={formData.image_url}
                          alt="Preview"
                          className="w-full h-40 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData((f) => ({ ...f, image_url: '' }))}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-sm">Mengupload...</span>
                          </>
                        ) : (
                          <>
                            <ImagePlus className="h-6 w-6" />
                            <span className="text-sm">Klik untuk upload gambar</span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nama *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alamat</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1"
                    >
                      Batal
                    </Button>
                    <Button type="submit" disabled={submitting || uploadingImage} className="flex-1">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Property" value={properties.length} highlight />
          <StatCard label="Ditampilkan" value={filtered.length} />
          <StatCard label="Dengan Alamat" value={properties.filter((p) => !!p.address).length} />
          <StatCard label="Dengan Gambar" value={properties.filter((p) => !!p.image_url).length} />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {properties.length === 0 ? 'Belum ada property' : 'Tidak ada hasil'}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {properties.length === 0
                  ? 'Tambahkan property pertama Anda'
                  : `Tidak ditemukan property untuk "${query}"`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, idx) => {
              const gradient = gradients[idx % gradients.length];
              const initials = p.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase();
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className={`relative h-40 ${p.image_url ? 'bg-muted' : `bg-gradient-to-br ${gradient}`}`}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_60%)]" />
                    )}
                    <Badge className="absolute top-3 right-3 bg-emerald-500/90 hover:bg-emerald-500 text-white border-0 rounded-full text-[10px] px-2 py-0.5">
                      Active
                    </Badge>
                    <div className="absolute -bottom-6 left-4 h-14 w-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-lg border-4 border-card">
                      {initials || <Building2 className="h-5 w-5" />}
                    </div>
                  </div>
                  <div className="p-4 pt-8">
                    <h3 className="font-semibold text-lg leading-tight">{p.name}</h3>
                    {p.address ? (
                      <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1 line-clamp-2 min-h-[32px]">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{p.address}</span>
                      </p>
                    ) : p.description ? (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-[32px]">
                        {p.description}
                      </p>
                    ) : (
                      <div className="min-h-[32px] mt-2" />
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(p)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Edit className="h-4 w-4 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(p)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Property</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus property <strong>{deleteTarget?.name}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Menghapus...
                  </>
                ) : (
                  'Hapus'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

const StatCard = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) => (
  <div
    className={
      'rounded-2xl border p-4 flex flex-col justify-between min-h-[92px] ' +
      (highlight ? 'bg-primary text-primary-foreground border-primary' : 'bg-card')
    }
  >
    <p className={'text-xs font-medium ' + (highlight ? 'opacity-80' : 'text-muted-foreground')}>
      {label}
    </p>
    <p className="text-3xl font-bold leading-none mt-2">{value}</p>
  </div>
);

export default AdminProperties;
