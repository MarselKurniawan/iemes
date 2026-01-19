import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  LayoutDashboard, 
  MapPin, 
  Package, 
  Wrench, 
  FileText, 
  Users, 
  LogOut,
  Menu,
  X,
  ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, role, signOut } = useAuth();
  const { selectedProperty, setSelectedProperty } = useProperty();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const mainNavItems = [
    { 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/dashboard',
      show: true
    },
  ];

  const propertyNavItems = selectedProperty ? [
    { label: 'Overview', icon: Building2, path: `/property/${selectedProperty.id}` },
    { label: 'Lokasi', icon: MapPin, path: `/property/${selectedProperty.id}/locations` },
    { label: 'Aset', icon: Package, path: `/property/${selectedProperty.id}/assets` },
    { label: 'Maintenance', icon: Wrench, path: `/property/${selectedProperty.id}/maintenance` },
    { label: 'Laporan', icon: FileText, path: `/property/${selectedProperty.id}/reports` },
  ] : [];

  const adminNavItems = role === 'superadmin' ? [
    { label: 'Kelola Property', icon: Building2, path: '/admin/properties' },
    { label: 'Kelola User', icon: Users, path: '/admin/users' },
  ] : [];

  const handleBackToProperties = () => {
    setSelectedProperty(null);
    navigate('/dashboard');
  };

  const NavLink = ({ item }: { item: { label: string; icon: any; path: string } }) => {
    const isActive = location.pathname === item.path;
    return (
      <button
        onClick={() => {
          navigate(item.path);
          setSidebarOpen(false);
        }}
        className={cn(
          'nav-link w-full text-left',
          isActive && 'nav-link-active'
        )}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sidebar-accent">
                <Building2 className="h-6 w-6 text-sidebar-primary" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AssetTrack</h1>
                <p className="text-xs text-sidebar-foreground/70">Management System</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-sidebar-accent rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-1">
            {mainNavItems.filter(i => i.show).map(item => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>

          {selectedProperty && (
            <div className="space-y-2">
              <button
                onClick={handleBackToProperties}
                className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground px-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Kembali
              </button>
              <div className="px-3 py-2 bg-sidebar-accent rounded-lg">
                <p className="text-xs text-sidebar-foreground/70">Property Aktif</p>
                <p className="font-medium truncate">{selectedProperty.name}</p>
              </div>
              <div className="space-y-1 pt-2">
                {propertyNavItems.map(item => (
                  <NavLink key={item.path} item={item} />
                ))}
              </div>
            </div>
          )}

          {adminNavItems.length > 0 && (
            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                Admin
              </p>
              <div className="space-y-1">
                {adminNavItems.map(item => (
                  <NavLink key={item.path} item={item} />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">
                {role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 lg:px-6 h-16 flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-muted rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
        </header>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
