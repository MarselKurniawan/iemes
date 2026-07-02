import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { Building2, Search, Plus, Loader2, MapPin, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const Dashboard = () => {
  const { role } = useAuth();
  const { properties, setSelectedProperty, loading } = useProperty();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

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

  const handleSelectProperty = (property: typeof properties[0]) => {
    setSelectedProperty(property);
    navigate(`/property/${property.id}`);
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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Pilih Property</h1>
            <p className="text-muted-foreground mt-2">
              Pilih property untuk melihat dan mengelola aset
            </p>
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
            {role === 'superadmin' && (
              <Button onClick={() => navigate('/admin/properties')} className="rounded-full shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Kelola Property
              </Button>
            )}
          </div>
        </div>

        {/* Stat */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Property" value={properties.length} highlight />
          <StatCard label="Ditampilkan" value={filtered.length} />
          <StatCard label="Dengan Alamat" value={properties.filter((p) => !!p.address).length} />
          <StatCard label="Akses Anda" value={role === 'superadmin' ? '∞' : properties.length} />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {properties.length === 0 ? 'Tidak ada property' : 'Tidak ada hasil'}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {properties.length === 0
                  ? role === 'superadmin'
                    ? 'Tambahkan property baru untuk memulai'
                    : 'Hubungi admin untuk mendapatkan akses ke property'
                  : `Tidak ditemukan property untuk "${query}"`}
              </p>
              {properties.length === 0 && role === 'superadmin' && (
                <Button className="mt-4 rounded-full" onClick={() => navigate('/admin/properties')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Property
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((property, idx) => (
              <PropertyCard
                key={property.id}
                index={idx}
                name={property.name}
                address={property.address}
                description={property.description}
                onOpen={() => handleSelectProperty(property)}
              />
            ))}
          </div>
        )}
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

const gradients = [
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-sky-500 via-cyan-500 to-teal-500',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-emerald-500 via-green-500 to-lime-500',
  'from-fuchsia-500 via-pink-500 to-red-500',
  'from-blue-600 via-indigo-500 to-violet-500',
];

const PropertyCard = ({
  index,
  name,
  address,
  description,
  onOpen,
}: {
  index: number;
  name: string;
  address: string | null;
  description: string | null;
  onOpen: () => void;
}) => {
  const gradient = gradients[index % gradients.length];
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all"
    >
      <div className={`relative h-32 bg-gradient-to-br ${gradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_60%)]" />
        <Badge className="absolute top-3 right-3 bg-emerald-500/90 hover:bg-emerald-500 text-white border-0 rounded-full text-[10px] px-2 py-0.5">
          Active
        </Badge>
        <div className="absolute -bottom-6 left-4 h-14 w-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-lg border-4 border-card">
          {initials || <Building2 className="h-5 w-5" />}
        </div>
      </div>
      <div className="p-4 pt-8">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight">{name}</h3>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>
        {address && (
          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1 line-clamp-2">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{address}</span>
          </p>
        )}
        {description && !address && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{description}</p>
        )}
      </div>
    </button>
  );
};

export default Dashboard;
