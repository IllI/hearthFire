import { useState, useEffect } from 'react';

export default function SimpleDebug() {
  const [windowInfo, setWindowInfo] = useState({
    origin: '',
    pathname: '',
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    // Update window information after component mounts (client-side only)
    setWindowInfo({
      origin: window.location.origin,
      pathname: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#2c3e50' }}>Simple Debug Page</h1>
      <p>This is a minimal test page with no dependencies to debug routing issues.</p>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Environment Information</h2>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          <li><strong>Origin:</strong> {windowInfo.origin}</li>
          <li><strong>Path:</strong> {windowInfo.pathname}</li>
          <li><strong>Timestamp:</strong> {windowInfo.timestamp}</li>
          <li><strong>Build Time:</strong> {new Date().toISOString()}</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Image Test</h2>
        <p>This image should load if static assets are working correctly:</p>
        <div>
          <img 
            src="/favicon.ico" 
            alt="Favicon Test" 
            style={{ border: '1px solid #ddd', marginTop: '10px' }} 
          />
        </div>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <a 
          href="/" 
          style={{ 
            display: 'inline-block', 
            padding: '8px 16px', 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '4px' 
          }}
        >
          Back to Home
        </a>
      </div>
    </div>
  );
} 