import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/contexts/PropertyContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, MapPin, Package, Wrench, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stats {
  totalLocations: number;
  totalAssets: number;
  totalMaintenance: number;
  pendingMaintenance: number;
  upcomingMaintenance: number;
}

interface AssetByCondition {
  name: string;
  value: number;
  color: string;
}

interface AssetByCategory {
  name: string;
  count: number;
}

interface MaintenanceByStatus {
  name: string;
  value: number;
  color: string;
}

const conditionColors: Record<string, string> = {
  baik: '#22c55e',
  cukup: '#3b82f6',
  perlu_perbaikan: '#f59e0b',
  rusak: '#ef4444',
};

const conditionLabels: Record<string, string> = {
  baik: 'Baik',
  cukup: 'Cukup',
  perlu_perbaikan: 'Perlu Perbaikan',
  rusak: 'Rusak',
};

const categoryLabels: Record<string, string> = {
  peralatan_kamar: 'Peralatan Kamar',
  peralatan_dapur: 'Peralatan Dapur',
  mesin_laundry_housekeeping: 'Laundry & HK',
  kendaraan_operasional: 'Kendaraan',
  peralatan_kantor_it: 'Kantor & IT',
  peralatan_rekreasi_leisure: 'Rekreasi',
  infrastruktur: 'Infrastruktur',
};

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#6b7280',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const PropertyOverview = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty, selectedProperty } = useProperty();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentMaintenance, setRecentMaintenance] = useState<any[]>([]);
  const [assetsByCondition, setAssetsByCondition] = useState<AssetByCondition[]>([]);
  const [assetsByCategory, setAssetsByCategory] = useState<AssetByCategory[]>([]);
  const [maintenanceByStatus, setMaintenanceByStatus] = useState<MaintenanceByStatus[]>([]);

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) {
      setSelectedProperty(property);
    } else if (!loading && properties.length > 0) {
      navigate('/dashboard');
    }
  }, [propertyId, properties]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!propertyId) return;

      const [locationsRes, assetsRes, maintenanceRes, allMaintenanceRes] = await Promise.all([
        supabase.from('locations').select('id', { count: 'exact' }).eq('property_id', propertyId),
        supabase.from('assets').select('id, condition, category, next_maintenance_date').eq('property_id', propertyId),
        supabase.from('maintenance').select('*').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('maintenance').select('status').eq('property_id', propertyId),
      ]);

      const assets = assetsRes.data || [];
      const allMaintenance = allMaintenanceRes.data || [];

      const pendingCount = maintenanceRes.data?.filter(m => m.status === 'pending' || m.status === 'in_progress').length || 0;
      
      // Check assets with upcoming maintenance (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const upcomingCount = assets.filter(a => {
        if (!a.next_maintenance_date) return false;
        const nextDate = new Date(a.next_maintenance_date);
        return nextDate <= thirtyDaysFromNow && nextDate >= new Date();
      }).length || 0;

      setStats({
        totalLocations: locationsRes.count || 0,
        totalAssets: assets.length,
        totalMaintenance: allMaintenance.length,
        pendingMaintenance: pendingCount,
        upcomingMaintenance: upcomingCount,
      });

      // Calculate assets by condition
      const conditionCounts: Record<string, number> = {};
      assets.forEach(a => {
        conditionCounts[a.condition] = (conditionCounts[a.condition] || 0) + 1;
      });
      setAssetsByCondition(
        Object.entries(conditionCounts).map(([key, value]) => ({
          name: conditionLabels[key] || key,
          value,
          color: conditionColors[key] || '#6b7280',
        }))
      );

      // Calculate assets by category
      const categoryCounts: Record<string, number> = {};
      assets.forEach(a => {
        categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      });
      setAssetsByCategory(
        Object.entries(categoryCounts).map(([key, count]) => ({
          name: categoryLabels[key] || key,
          count,
        }))
      );

      // Calculate maintenance by status
      const maintenanceStatusCounts: Record<string, number> = {};
      allMaintenance.forEach(m => {
        maintenanceStatusCounts[m.status] = (maintenanceStatusCounts[m.status] || 0) + 1;
      });
      setMaintenanceByStatus(
        Object.entries(maintenanceStatusCounts).map(([key, value]) => ({
          name: statusLabels[key] || key,
          value,
          color: statusColors[key] || '#6b7280',
        }))
      );

      setRecentMaintenance(maintenanceRes.data || []);
      setLoading(false);
    };

    fetchStats();
  }, [propertyId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    { label: 'Total Lokasi', value: stats?.totalLocations || 0, icon: MapPin, color: 'text-blue-600' },
    { label: 'Total Aset', value: stats?.totalAssets || 0, icon: Package, color: 'text-green-600' },
    { label: 'Maintenance Aktif', value: stats?.pendingMaintenance || 0, icon: Wrench, color: 'text-orange-600' },
    { label: 'Perlu Perawatan', value: stats?.upcomingMaintenance || 0, icon: AlertTriangle, color: 'text-amber-600' },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'Dalam Proses',
      completed: 'Selesai',
      cancelled: 'Dibatalkan',
    };
    return <Badge className={variants[status] || variants.pending}>{labels[status] || status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">{selectedProperty?.name}</h1>
          {selectedProperty?.address && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {selectedProperty.address}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {stats?.upcomingMaintenance && stats.upcomingMaintenance > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">
                  {stats.upcomingMaintenance} aset memerlukan perawatan dalam 30 hari ke depan
                </p>
                <p className="text-sm text-amber-700">
                  Jadwalkan maintenance untuk mencegah kerusakan
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics Charts */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Assets by Condition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aset Berdasarkan Kondisi</CardTitle>
            </CardHeader>
            <CardContent>
              {assetsByCondition.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={assetsByCondition}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {assetsByCondition.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assets by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aset Berdasarkan Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              {assetsByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={assetsByCategory} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Maintenance Berdasarkan Status</CardTitle>
            </CardHeader>
            <CardContent>
              {maintenanceByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={maintenanceByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {maintenanceByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Maintenance Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMaintenance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Belum ada data maintenance</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMaintenance.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {item.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Wrench className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.start_date).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PropertyOverview;