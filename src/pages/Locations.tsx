import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/contexts/PropertyContext';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Edit, Trash2, Loader2, Building, Hotel, Briefcase } from 'lucide-react';

type LocationType = 'kamar' | 'fasilitas_umum' | 'office' | 'warehouse';

interface Location {
  id: string;
  name: string;
  type: LocationType;
  created_at: string;
}

const locationTypeLabels: Record<LocationType, { label: string; icon: any }> = {
  kamar: { label: 'Kamar', icon: Hotel },
  fasilitas_umum: { label: 'Fasilitas Umum', icon: Building },
  office: { label: 'Office', icon: Briefcase },
  warehouse: { label: 'Gudang', icon: Building },
};

const Locations = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty } = useProperty();
  const { role } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'kamar' as LocationType });
  const [submitting, setSubmitting] = useState(false);

  const canManage = role === 'superadmin' || role === 'hotel_manager';

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) setSelectedProperty(property);
  }, [propertyId, properties]);

  const fetchLocations = async () => {
    if (!propertyId) return;
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('property_id', propertyId)
      .order('type')
      .order('name');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setLocations(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, [propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setSubmitting(true);

    if (editingLocation) {
      const { error } = await supabase
        .from('locations')
        .update({ name: formData.name, type: formData.type })
        .eq('id', editingLocation.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Lokasi berhasil diupdate' });
        fetchLocations();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('locations')
        .insert({ property_id: propertyId, name: formData.name, type: formData.type });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Lokasi berhasil ditambahkan' });
        fetchLocations();
        setDialogOpen(false);
      }
    }

    setSubmitting(false);
    setFormData({ name: '', type: 'kamar' });
    setEditingLocation(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus lokasi ini?')) return;
    
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Lokasi dihapus' });
      fetchLocations();
    }
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setFormData({ name: location.name, type: location.type });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingLocation(null);
    setFormData({ name: '', type: 'kamar' });
    setDialogOpen(true);
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

  const groupedLocations = locations.reduce((acc, loc) => {
    if (!acc[loc.type]) acc[loc.type] = [];
    acc[loc.type].push(loc);
    return acc;
  }, {} as Record<LocationType, Location[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lokasi</h1>
            <p className="text-muted-foreground mt-1">
              Kelola lokasi dalam property ini
            </p>
          </div>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Lokasi
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Lokasi</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: Kamar 101"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipe</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(v) => setFormData({ ...formData, type: v as LocationType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kamar">Kamar</SelectItem>
                        <SelectItem value="fasilitas_umum">Fasilitas Umum</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="warehouse">Gudang</SelectItem>
                      </SelectContent>
                    </Select>
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

        {locations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum ada lokasi</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Tambahkan lokasi untuk mulai mengelola aset
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {(Object.keys(locationTypeLabels) as LocationType[]).map(type => {
              const locs = groupedLocations[type] || [];
              if (locs.length === 0) return null;
              const TypeIcon = locationTypeLabels[type].icon;
              
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{locationTypeLabels[type].label}</h2>
                    <Badge variant="secondary">{locs.length}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {locs.map(location => (
                      <Card key={location.id} className="group hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <TypeIcon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{location.name}</span>
                          </div>
                          {canManage && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditDialog(location)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDelete(location.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Locations;
