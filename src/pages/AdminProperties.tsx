import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, Edit, Trash2, Loader2, MapPin } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
}

const AdminProperties = () => {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', description: '' });

  const fetchProperties = async () => {
    const { data, error } = await supabase.from('properties').select('*').order('name');
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setProperties(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProperties(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name: formData.name, address: formData.address || null, description: formData.description || null };

    if (editingProperty) {
      const { error } = await supabase.from('properties').update(payload).eq('id', editingProperty.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Berhasil', description: 'Property diupdate' }); fetchProperties(); setDialogOpen(false); }
    } else {
      const { error } = await supabase.from('properties').insert(payload);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Berhasil', description: 'Property ditambahkan' }); fetchProperties(); setDialogOpen(false); }
    }
    setSubmitting(false);
    setFormData({ name: '', address: '', description: '' });
    setEditingProperty(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus property ini?')) return;
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Berhasil', description: 'Property dihapus' }); fetchProperties(); }
  };

  const openEdit = (p: Property) => {
    setEditingProperty(p);
    setFormData({ name: p.name, address: p.address || '', description: p.description || '' });
    setDialogOpen(true);
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Kelola Property</h1><p className="text-muted-foreground mt-1">Tambah dan kelola property</p></div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingProperty(null); setFormData({ name: '', address: '', description: '' }); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Tambah Property</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingProperty ? 'Edit Property' : 'Tambah Property'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Nama *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Alamat</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                <div className="space-y-2"><Label>Deskripsi</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                <div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button><Button type="submit" disabled={submitting} className="flex-1">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Card key={p.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <CardTitle className="mt-2">{p.name}</CardTitle>
                {p.address && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{p.address}</p>}
              </CardHeader>
              {p.description && <CardContent className="pt-0"><p className="text-sm text-muted-foreground">{p.description}</p></CardContent>}
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminProperties;
