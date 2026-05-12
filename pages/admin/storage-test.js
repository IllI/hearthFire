import { useState, useEffect } from 'react';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';
import AdminRoute from '../../components/AdminRoute';
import styles from '../../styles/StorageTest.module.css';

const StorageTestPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState({ firebase: [], proxy: [] });
  const [folders, setFolders] = useState({ firebase: [], proxy: [] });
  const [currentPath, setCurrentPath] = useState('');
  const [initStatus, setInitStatus] = useState({ loading: false, result: null });

  // Initialize component
  useEffect(() => {
    fetchFilesFromBothSources();
  }, [currentPath]);

  const fetchFilesFromBothSources = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Initialize objects to hold results from both sources
      const newFiles = { firebase: [], proxy: [] };
      const newFolders = { firebase: [], proxy: [] };

      // Fetch from Firebase directly
      try {
        console.log('Fetching directly from Firebase Storage');
        const storage = getStorage(getApp());
        const storageRef = ref(storage, currentPath);
        const result = await listAll(storageRef);

        // Handle folders
        newFolders.firebase = result.prefixes.map(prefixRef => ({
          name: prefixRef.name,
          fullPath: prefixRef.fullPath
        }));

        // Handle files
        const filePromises = result.items.map(async (itemRef) => {
          try {
            const url = await getDownloadURL(itemRef);
            return {
              name: itemRef.name,
              fullPath: itemRef.fullPath,
              url,
              success: true
            };
          } catch (error) {
            console.error('Error getting download URL:', error);
            return {
              name: itemRef.name,
              fullPath: itemRef.fullPath,
              error: error.message,
              success: false
            };
          }
        });

        newFiles.firebase = await Promise.all(filePromises);
        console.log('Firebase direct access successful:', newFiles.firebase.length, 'files found');
      } catch (firebaseError) {
        console.error('Error accessing Firebase Storage directly:', firebaseError);
        newFiles.firebase = [{ error: firebaseError.message, success: false }];
      }

      // Fetch from proxy
      try {
        console.log('Fetching from storage proxy');
        const response = await fetch(`/api/storage-proxy?path=${encodeURIComponent(currentPath)}&action=list`);
        
        if (!response.ok) {
          throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle folders
        newFolders.proxy = (data.prefixes || []).map(prefix => {
          const name = prefix.split('/').pop();
          return { 
            name, 
            fullPath: prefix
          };
        });
        
        // Handle files
        newFiles.proxy = (data.items || []).map(item => {
          return {
            name: item.name,
            fullPath: item.name,
            url: `/api/storage-proxy?path=${encodeURIComponent(item.name)}&action=download`,
            success: true
          };
        });
        
        console.log('Proxy access successful:', newFiles.proxy.length, 'files found');
      } catch (proxyError) {
        console.error('Error accessing storage via proxy:', proxyError);
        newFiles.proxy = [{ error: proxyError.message, success: false }];
      }

      setFiles(newFiles);
      setFolders(newFolders);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folderPath) => {
    setCurrentPath(folderPath);
  };

  const goToParentFolder = () => {
    if (!currentPath) return;
    
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    setCurrentPath(parentPath);
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'Root', path: '' }];
    
    const parts = currentPath.split('/');
    let currentPartialPath = '';
    
    return [
      { name: 'Root', path: '' },
      ...parts.map(part => {
        currentPartialPath = currentPartialPath ? `${currentPartialPath}/${part}` : part;
        return { name: part, path: currentPartialPath };
      })
    ];
  };

  const renderBreadcrumbs = () => {
    const breadcrumbs = getBreadcrumbs();
    
    return (
      <div className={styles.breadcrumbs}>
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path}>
            {index > 0 && <span className={styles.breadcrumbSeparator}>/</span>}
            <button 
              className={styles.breadcrumbLink}
              onClick={() => navigateToFolder(crumb.path)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>
    );
  };

  const initializeStorage = async () => {
    setInitStatus({ loading: true, result: null });
    
    try {
      const response = await fetch('/api/initialize-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey: 'admin123' })
      });
      
      const result = await response.json();
      setInitStatus({ loading: false, result });
      
      if (response.ok) {
        alert('Storage initialized successfully! Refreshing data...');
        fetchFilesFromBothSources();
      } else {
        alert(`Failed to initialize storage: ${result.error || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error initializing storage:', error);
      setInitStatus({ 
        loading: false, 
        result: { error: error.message }
      });
      alert(`Error initializing storage: ${error.message}`);
    }
  };

  return (
    <AdminRoute>
      <div className={styles.container}>
        <h1>Firebase Storage Test</h1>
        <p className={styles.description}>This page tests both direct Firebase Storage access and proxy-based access.</p>
        
        <div className={styles.actions}>
          <button 
            className={styles.refreshButton}
            onClick={fetchFilesFromBothSources}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          
          <button 
            className={styles.initButton}
            onClick={initializeStorage}
            disabled={initStatus.loading}
          >
            {initStatus.loading ? 'Initializing...' : 'Initialize Sample Content'}
          </button>
        </div>
        
        {error && (
          <div className={styles.error}>
            <p>Error: {error}</p>
          </div>
        )}
        
        <div className={styles.navigation}>
          {currentPath && (
            <button className={styles.backButton} onClick={goToParentFolder}>
              ← Back
            </button>
          )}
          {renderBreadcrumbs()}
        </div>
        
        <div className={styles.testsContainer}>
          <div className={styles.testPanel}>
            <h2>Firebase Direct Access</h2>
            {isLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <div className={styles.contentPanel}>
                <h3>Folders</h3>
                {folders.firebase.length === 0 ? (
                  <p className={styles.emptyMessage}>No folders found</p>
                ) : (
                  <div className={styles.folderList}>
                    {folders.firebase.map((folder) => (
                      <div 
                        key={folder.fullPath} 
                        className={styles.folder}
                        onClick={() => navigateToFolder(folder.fullPath)}
                      >
                        <span className={styles.folderIcon}>📁</span>
                        <span>{folder.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <h3>Files</h3>
                {files.firebase.length === 0 ? (
                  <p className={styles.emptyMessage}>No files found</p>
                ) : (
                  <div className={styles.fileList}>
                    {files.firebase.map((file, index) => (
                      <div key={file.fullPath || index} className={styles.file}>
                        {file.error ? (
                          <div className={styles.fileError}>
                            <span>Error: {file.error}</span>
                          </div>
                        ) : (
                          <>
                            <div className={styles.fileInfo}>
                              <span>{file.name}</span>
                            </div>
                            {file.url && (
                              <div className={styles.filePreview}>
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                  }}
                                />
                                <div className={styles.errorPreview} style={{display: 'none'}}>
                                  Failed to load image
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className={styles.testPanel}>
            <h2>Storage Proxy Access</h2>
            {isLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <div className={styles.contentPanel}>
                <h3>Folders</h3>
                {folders.proxy.length === 0 ? (
                  <p className={styles.emptyMessage}>No folders found</p>
                ) : (
                  <div className={styles.folderList}>
                    {folders.proxy.map((folder) => (
                      <div 
                        key={folder.fullPath} 
                        className={styles.folder}
                        onClick={() => navigateToFolder(folder.fullPath)}
                      >
                        <span className={styles.folderIcon}>📁</span>
                        <span>{folder.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <h3>Files</h3>
                {files.proxy.length === 0 ? (
                  <p className={styles.emptyMessage}>No files found</p>
                ) : (
                  <div className={styles.fileList}>
                    {files.proxy.map((file, index) => (
                      <div key={file.fullPath || index} className={styles.file}>
                        {file.error ? (
                          <div className={styles.fileError}>
                            <span>Error: {file.error}</span>
                          </div>
                        ) : (
                          <>
                            <div className={styles.fileInfo}>
                              <span>{file.name}</span>
                            </div>
                            {file.url && (
                              <div className={styles.filePreview}>
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                  }}
                                />
                                <div className={styles.errorPreview} style={{display: 'none'}}>
                                  Failed to load image
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {initStatus.result && (
          <div className={styles.statusSection}>
            <h3>Storage Initialization Status</h3>
            <pre>{JSON.stringify(initStatus.result, null, 2)}</pre>
          </div>
        )}
      </div>
    </AdminRoute>
  );
};

export default StorageTestPage; 