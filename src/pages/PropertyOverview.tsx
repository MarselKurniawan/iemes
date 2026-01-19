import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/contexts/PropertyContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, MapPin, Package, Wrench, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';

interface Stats {
  totalLocations: number;
  totalAssets: number;
  totalMaintenance: number;
  pendingMaintenance: number;
  upcomingMaintenance: number;
}

const PropertyOverview = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty, selectedProperty } = useProperty();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentMaintenance, setRecentMaintenance] = useState<any[]>([]);

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

      const [locationsRes, assetsRes, maintenanceRes] = await Promise.all([
        supabase.from('locations').select('id', { count: 'exact' }).eq('property_id', propertyId),
        supabase.from('assets').select('id, next_maintenance_date', { count: 'exact' }).eq('property_id', propertyId),
        supabase.from('maintenance').select('*').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(5),
      ]);

      const pendingCount = maintenanceRes.data?.filter(m => m.status === 'pending' || m.status === 'in_progress').length || 0;
      
      // Check assets with upcoming maintenance (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const upcomingCount = assetsRes.data?.filter(a => {
        if (!a.next_maintenance_date) return false;
        const nextDate = new Date(a.next_maintenance_date);
        return nextDate <= thirtyDaysFromNow && nextDate >= new Date();
      }).length || 0;

      setStats({
        totalLocations: locationsRes.count || 0,
        totalAssets: assetsRes.count || 0,
        totalMaintenance: maintenanceRes.data?.length || 0,
        pendingMaintenance: pendingCount,
        upcomingMaintenance: upcomingCount,
      });

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
