import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  // If auth is still loading, show a loading state
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  // If user is not authenticated, redirect to login
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }
  
  // If authenticated, show the children components
  return children;
} 