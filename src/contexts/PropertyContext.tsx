import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Property {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
}

interface PropertyContextType {
  properties: Property[];
  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;
  loading: boolean;
  refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProperties = async () => {
    if (!user) {
      setProperties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    if (role === 'superadmin') {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .order('name');
      setProperties(data || []);
    } else {
      const { data } = await supabase
        .from('property_assignments')
        .select('property:properties(*)')
        .eq('user_id', user.id);
      
      const props = data?.map(d => d.property).filter(Boolean) as Property[] || [];
      setProperties(props);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (user && role) {
      fetchProperties();
    }
  }, [user, role]);

  const refreshProperties = async () => {
    await fetchProperties();
  };

  return (
    <PropertyContext.Provider value={{ 
      properties, 
      selectedProperty, 
      setSelectedProperty, 
      loading,
      refreshProperties 
    }}>
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};
