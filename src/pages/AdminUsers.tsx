import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Edit, Trash2, Loader2, Building2 } from 'lucide-react';

type AppRole = 'superadmin' | 'hotel_manager' | 'staff';

interface User { id: string; email: string; full_name: string; user_id: string; role?: AppRole; properties?: string[]; }
interface Property { id: string; name: string; }

const roleLabels: Record<AppRole, { label: string; class: string }> = {
  superadmin: { label: 'Super Admin', class: 'bg-purple-100 text-purple-700' },
  hotel_manager: { label: 'Hotel Manager', class: 'bg-blue-100 text-blue-700' },
  staff: { label: 'Staff', class: 'bg-green-100 text-green-700' },
};

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ email: '', full_name: '', login_code: '', role: 'staff' as AppRole });
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [createSelectedProperties, setCreateSelectedProperties] = useState<string[]>([]);

  const fetchData = async () => {
    const [profilesRes, propertiesRes, rolesRes, assignmentsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('properties').select('id, name'),
      supabase.from('user_roles').select('*'),
      supabase.from('property_assignments').select('*'),
    ]);

    const usersData = (profilesRes.data || []).map(p => {
      const role = rolesRes.data?.find(r => r.user_id === p.user_id)?.role as AppRole | undefined;
      const props = assignmentsRes.data?.filter(a => a.user_id === p.user_id).map(a => a.property_id) || [];
      return { ...p, role, properties: props };
    });

    setUsers(usersData);
    setProperties(propertiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Use edge function to create user without auto-login
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          login_code: formData.login_code,
          full_name: formData.full_name,
          role: formData.role,
          property_ids: formData.role !== 'superadmin' ? createSelectedProperties : [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({ title: 'Error', description: result.error || 'Gagal membuat user', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      toast({ title: 'Berhasil', description: 'User berhasil ditambahkan' });
      fetchData();
      setDialogOpen(false);
      setFormData({ email: '', full_name: '', login_code: '', role: 'staff' });
      setCreateSelectedProperties([]);
    } catch (err) {
      toast({ title: 'Error', description: 'Gagal membuat user', variant: 'destructive' });
    }

    setSubmitting(false);
  };

  const handleAssignProperties = async () => {
    if (!selectedUser) return;
    setSubmitting(true);

    await supabase.from('property_assignments').delete().eq('user_id', selectedUser.user_id);
    
    if (selectedProperties.length > 0) {
      await supabase.from('property_assignments').insert(
        selectedProperties.map(pid => ({ user_id: selectedUser.user_id, property_id: pid }))
      );
    }

    toast({ title: 'Berhasil', description: 'Property assignment diupdate' });
    fetchData();
    setAssignDialogOpen(false);
    setSubmitting(false);
  };

  const openAssignDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedProperties(user.properties || []);
    setAssignDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Hapus user ini?')) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({ title: 'Error', description: result.error || 'Gagal hapus user', variant: 'destructive' });
        return;
      }

      toast({ title: 'Berhasil', description: 'User dihapus' });
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Gagal hapus user', variant: 'destructive' });
    }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Kelola User</h1><p className="text-muted-foreground mt-1">Tambah user dan assign property</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Tambah User</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah User Baru</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Nama Lengkap *</Label><Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Kode Login *</Label><Input value={formData.login_code} onChange={(e) => setFormData({ ...formData, login_code: e.target.value })} required minLength={6} /></div>
                <div className="space-y-2"><Label>Role *</Label>
                  <Select value={formData.role} onValueChange={(v) => {
                    const nextRole = v as AppRole;
                    setFormData({ ...formData, role: nextRole });
                    if (nextRole === 'superadmin') setCreateSelectedProperties([]);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="hotel_manager">Hotel Manager</SelectItem>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role !== 'superadmin' && (
                  <div className="space-y-2">
                    <Label>Assign Property (Multi)</Label>
                    <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border p-2">
                      {properties.map(p => (
                        <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createSelectedProperties.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) setCreateSelectedProperties([...createSelectedProperties, p.id]);
                              else setCreateSelectedProperties(createSelectedProperties.filter(id => id !== p.id));
                            }}
                            className="h-4 w-4"
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                      {properties.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground">Belum ada property.</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button><Button type="submit" disabled={submitting} className="flex-1">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead className="w-28">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role && <Badge className={roleLabels[user.role].class}>{roleLabels[user.role].label}</Badge>}</TableCell>
                    <TableCell>
                      {user.role === 'superadmin' ? <span className="text-muted-foreground">Semua</span> : (
                        <div className="flex flex-wrap gap-1">
                          {user.properties?.slice(0, 2).map(pid => {
                            const prop = properties.find(p => p.id === pid);
                            return prop ? <Badge key={pid} variant="outline">{prop.name}</Badge> : null;
                          })}
                          {(user.properties?.length || 0) > 2 && <Badge variant="outline">+{(user.properties?.length || 0) - 2}</Badge>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.role !== 'superadmin' && <Button variant="ghost" size="icon" onClick={() => openAssignDialog(user)}><Building2 className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(user.user_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Properties - {selectedUser?.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {properties.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={selectedProperties.includes(p.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedProperties([...selectedProperties, p.id]);
                    else setSelectedProperties(selectedProperties.filter(id => id !== p.id));
                  }} className="h-4 w-4" />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-4"><Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="flex-1">Batal</Button><Button onClick={handleAssignProperties} disabled={submitting} className="flex-1">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminUsers;
