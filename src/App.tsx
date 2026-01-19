import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PropertyProvider } from "@/contexts/PropertyContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PropertyOverview from "./pages/PropertyOverview";
import Locations from "./pages/Locations";
import Assets from "./pages/Assets";
import Maintenance from "./pages/Maintenance";
import Reports from "./pages/Reports";
import AdminProperties from "./pages/AdminProperties";
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/property/:propertyId" element={<ProtectedRoute><PropertyOverview /></ProtectedRoute>} />
    <Route path="/property/:propertyId/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
    <Route path="/property/:propertyId/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
    <Route path="/property/:propertyId/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
    <Route path="/property/:propertyId/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/admin/properties" element={<ProtectedRoute><AdminRoute><AdminProperties /></AdminRoute></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><AdminUsers /></AdminRoute></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PropertyProvider>
            <AppRoutes />
          </PropertyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
