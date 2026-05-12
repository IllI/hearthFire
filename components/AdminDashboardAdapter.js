import { useEffect, useState } from 'react';
import { DashboardContent } from '../pages/admin/index';

export default function AdminDashboardAdapter(props) {
  const [dataModeFromClient, setDataModeFromClient] = useState('production');
  
  useEffect(() => {
    // Set up environment fallbacks client-side
    if (typeof window !== 'undefined') {
      // Set environment mode, using window.NEXT_PUBLIC_DATA_MODE if available
      setDataModeFromClient(window.NEXT_PUBLIC_DATA_MODE || 'production');
      
      // Ensure NEXT_PUBLIC_DATA_MODE is available globally
      if (!window.NEXT_PUBLIC_DATA_MODE) {
        window.NEXT_PUBLIC_DATA_MODE = 'production';
        console.log('Set default window.NEXT_PUBLIC_DATA_MODE to production');
      }
    }
  }, []);
  
  return (
    <DashboardContent 
      {...props} 
      dataModeFromServer={props.dataModeFromServer} 
      dataModeFromClient={dataModeFromClient} 
    />
  );
} 