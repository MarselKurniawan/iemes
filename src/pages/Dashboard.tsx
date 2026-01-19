import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { Building2, ChevronRight, MapPin, Plus, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const Dashboard = () => {
  const { role } = useAuth();
  const { properties, setSelectedProperty, loading } = useProperty();
  const navigate = useNavigate();

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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pilih Property</h1>
            <p className="text-muted-foreground mt-1">
              Pilih property untuk melihat dan mengelola aset
            </p>
          </div>
          {role === 'superadmin' && (
            <Button onClick={() => navigate('/admin/properties')}>
              <Plus className="h-4 w-4 mr-2" />
              Kelola Property
            </Button>
          )}
        </div>

        {properties.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tidak ada property</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {role === 'superadmin' 
                  ? 'Tambahkan property baru untuk memulai'
                  : 'Hubungi admin untuk mendapatkan akses ke property'}
              </p>
              {role === 'superadmin' && (
                <Button className="mt-4" onClick={() => navigate('/admin/properties')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Property
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <Card 
                key={property.id} 
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
                onClick={() => handleSelectProperty(property)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="mt-3">{property.name}</CardTitle>
                  {property.address && (
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {property.address}
                    </CardDescription>
                  )}
                </CardHeader>
                {property.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {property.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
