import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useProperty } from '@/contexts/PropertyContext';
import { useAuth } from '@/contexts/AuthContext';
import AssetsReportPanel from '@/components/reports/AssetsReportPanel';
import MaintenanceReportPanel from '@/components/reports/MaintenanceReportPanel';

const Reports = () => {
  const { propertyId } = useParams();
  const { properties, setSelectedProperty, selectedProperty } = useProperty();
  const { role } = useAuth();

  const isSuperadmin = role === 'superadmin';

  useEffect(() => {
    const property = properties.find(p => p.id === propertyId);
    if (property) setSelectedProperty(property);
  }, [propertyId, properties, setSelectedProperty]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Laporan</h1>
          <p className="text-muted-foreground mt-1">Lihat data & export laporan aset dan maintenance</p>
        </div>

        <Tabs defaultValue="assets">
          <TabsList>
            <TabsTrigger value="assets">Laporan Aset</TabsTrigger>
            <TabsTrigger value="maintenance">Laporan Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-4">
            <AssetsReportPanel
              propertyId={propertyId}
              selectedPropertyName={selectedProperty?.name}
              isSuperadmin={isSuperadmin}
            />
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4">
            <MaintenanceReportPanel
              propertyId={propertyId}
              selectedPropertyName={selectedProperty?.name}
              isSuperadmin={isSuperadmin}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;

