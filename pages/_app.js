import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { CartProvider } from '../contexts/CartContext';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [routeChangeStart, setRouteChangeStart] = useState(false);
  
  useEffect(() => {
    // Ensure NEXT_PUBLIC_DATA_MODE is available globally
    if (typeof window !== 'undefined') {
      window.NEXT_PUBLIC_DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE || 'production';
    }
    
    // Set up router event listeners to ensure cart data is preserved during navigation
    const handleRouteChangeStart = () => {
      console.log('Route change starting - ensuring cart data is saved');
      setRouteChangeStart(true);
      
      // Make a backup of the cart in sessionStorage to ensure it survives navigation
      try {
        const cartData = localStorage.getItem('cart');
        if (cartData) {
          sessionStorage.setItem('cart_backup', cartData);
          console.log('Cart data backed up to sessionStorage before navigation');
        }
      } catch (e) {
        console.error('Error backing up cart before navigation:', e);
      }
    };

    // Listen for route change events
    router.events.on('routeChangeStart', handleRouteChangeStart);
    
    // Clean up
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, []);
  
  // Special case for admin route which needs its own layout
  if (router.pathname.startsWith('/admin')) {
    return (
      <>
        <Head>
          <title>Hearthfire Farm Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </>
    );
  }
  
  // Regular layout for non-admin routes
  return (
    <>
      <Head>
        <title>Hearthfire Farm</title>
        <meta name="description" content="Fresh, local produce from Hearthfire Farm" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <AuthProvider>
        <CartProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </CartProvider>
      </AuthProvider>
    </>
  );
}

export default MyApp;