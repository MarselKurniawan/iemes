import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { migrateImages, STORAGE_BASE_URL } from '@/lib/external-storage';
import { Loader2, CheckCircle, XCircle, ArrowRight, Database, HardDrive } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface MigrationItem {
  id: string;
  name: string;
  source: 'assets' | 'maintenance';
  urls: string[];
  property_id: string;
}

const OLD_STORAGE_PREFIX = 'https://wzabyfciqcuecmslyjwc.supabase.co/storage/v1/object/public/evidence/';

export default function AdminMigration() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [migratedCount, setMigratedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    loadItems();
  }, []);

  if (role !== 'superadmin') return <Navigate to="/dashboard" replace />;

  const loadItems = async () => {
    setLoading(true);
    
    // Get assets with old URLs
    const { data: assets } = await supabase
      .from('assets')
      .select('id, name, photo_urls, property_id')
      .not('photo_urls', 'is', null);

    // Get maintenance with old URLs
    const { data: maintenance } = await supabase
      .from('maintenance')
      .select('id, title, evidence_urls, property_id')
      .not('evidence_urls', 'is', null);

    const migrationItems: MigrationItem[] = [];
    let imgCount = 0;

    (assets || []).forEach(a => {
      const oldUrls = (a.photo_urls || []).filter((u: string) => u.startsWith(OLD_STORAGE_PREFIX));
      if (oldUrls.length > 0) {
        migrationItems.push({ id: a.id, name: a.name, source: 'assets', urls: oldUrls, property_id: a.property_id });
        imgCount += oldUrls.length;
      }
    });

    (maintenance || []).forEach(m => {
      const oldUrls = (m.evidence_urls || []).filter((u: string) => u.startsWith(OLD_STORAGE_PREFIX));
      if (oldUrls.length > 0) {
        migrationItems.push({ id: m.id, name: m.title, source: 'maintenance', urls: oldUrls, property_id: m.property_id });
        imgCount += oldUrls.length;
      }
    });

    setItems(migrationItems);
    setTotalImages(imgCount);
    setLoading(false);
  };

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startMigration = async () => {
    setMigrating(true);
    setMigratedCount(0);
    setFailedCount(0);
    setLog([]);
    addLog('🚀 Memulai migrasi...');

    let migrated = 0;
    let failed = 0;
    const batchSize = 5; // Process 5 items at a time

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      for (const item of batch) {
        addLog(`📦 Migrasi: ${item.name} (${item.urls.length} foto)`);
        
        // Prepare images for migration
        const imagesToMigrate = item.urls.map(url => ({
          url,
          property_id: item.property_id,
        }));

        try {
          const results = await migrateImages(imagesToMigrate);
          
          // Build new URL list (replace old URLs with new ones)
          const allUrls = item.source === 'assets'
            ? (await supabase.from('assets').select('photo_urls').eq('id', item.id).single()).data?.photo_urls || []
            : (await supabase.from('maintenance').select('evidence_urls').eq('id', item.id).single()).data?.evidence_urls || [];

          const updatedUrls = allUrls.map((originalUrl: string) => {
            const result = results.find(r => r.old_url === originalUrl);
            if (result?.success && result.new_url) {
              return result.new_url;
            }
            return originalUrl;
          });

          // Update database
          if (item.source === 'assets') {
            await supabase.from('assets').update({ photo_urls: updatedUrls }).eq('id', item.id);
          } else {
            await supabase.from('maintenance').update({ evidence_urls: updatedUrls }).eq('id', item.id);
          }

          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;
          migrated += successCount;
          failed += failCount;

          if (failCount > 0) {
            addLog(`⚠️ ${item.name}: ${successCount} berhasil, ${failCount} gagal`);
          } else {
            addLog(`✅ ${item.name}: ${successCount} foto berhasil dimigrasikan`);
          }
        } catch (error) {
          failed += item.urls.length;
          addLog(`❌ ${item.name}: Error - ${error}`);
        }

        setMigratedCount(migrated);
        setFailedCount(failed);
        setProgress(Math.round(((migrated + failed) / totalImages) * 100));
      }
    }

    addLog(`🏁 Migrasi selesai! ${migrated} berhasil, ${failed} gagal`);
    setMigrating(false);
    
    toast({
      title: 'Migrasi Selesai',
      description: `${migrated} foto berhasil dimigrasikan, ${failed} gagal`,
    });

    // Reload items to see remaining
    await loadItems();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Migrasi Storage</h1>
            <p className="text-muted-foreground text-sm">
              Pindahkan gambar dari Cloud Storage ke storage-ims.sinergimax.com
            </p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{items.length}</p>
                  <p className="text-sm text-muted-foreground">Item perlu migrasi</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <HardDrive className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{totalImages}</p>
                  <p className="text-sm text-muted-foreground">Total foto</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ArrowRight className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tujuan</p>
                  <p className="text-sm font-mono">storage-ims.sinergimax.com</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Migration Control */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kontrol Migrasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memuat data...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Semua gambar sudah dimigrasikan!</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Pastikan file <code className="bg-muted px-1 rounded">upload.php</code> dan <code className="bg-muted px-1 rounded">migrate.php</code> sudah di-upload ke hosting, 
                  dan folder <code className="bg-muted px-1 rounded">uploads/</code> sudah dibuat dengan permission write.
                </p>
                <Button 
                  onClick={startMigration} 
                  disabled={migrating}
                  size="lg"
                >
                  {migrating ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Migrasi berjalan...</>
                  ) : (
                    <>Mulai Migrasi ({totalImages} foto)</>
                  )}
                </Button>
              </>
            )}

            {migrating && (
              <div className="space-y-2">
                <Progress value={progress} />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />{migratedCount} berhasil
                  </span>
                  {failedCount > 0 && (
                    <span>
                      <XCircle className="h-3 w-3 inline mr-1 text-destructive" />{failedCount} gagal
                    </span>
                  )}
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log */}
        {log.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Log Migrasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-3 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
                {log.map((entry, idx) => (
                  <div key={idx}>{entry}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items Preview */}
        {!loading && items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Item yang Perlu Dimigrasikan (preview 20)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.slice(0, 20).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.source === 'assets' ? 'default' : 'secondary'}>
                        {item.source === 'assets' ? 'Aset' : 'Maintenance'}
                      </Badge>
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.urls.length} foto</span>
                  </div>
                ))}
                {items.length > 20 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    ... dan {items.length - 20} item lainnya
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
