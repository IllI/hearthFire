import { useState, useEffect, useRef } from 'react';
import styles from '../styles/MediaLibrary.module.css';
import { useAuth } from '../contexts/AuthContext';

// Icons for the media library
const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="32" height="32"><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const BackIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="24" height="24"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;
const GridIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const ListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
const FolderAddIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM10 11a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ErrorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const EmptyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="48" height="48"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;

const MediaLibrary = ({ onSelect, onClose, multiple = false }) => {
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [currentPath, setCurrentPath] = useState('general'); // Default to 'general' as the initial path
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    fetchFiles();
  }, [currentPath]);
  
  const fetchFiles = async () => {
    try {
      setError(null);
      
      // Get the auth token
      let token = 'dev-token';
      if (currentUser) {
        try {
          token = await currentUser.getIdToken();
        } catch (err) {
          console.error('Error getting auth token:', err);
        }
      }
      
      console.log(`Fetching files from path: ${currentPath}`);
      
      // Construct the API request
      const response = await fetch(`/api/list-uploads?path=${encodeURIComponent(currentPath)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // The API directly returns files and directories arrays without a success property
      // Check if data is an object and has expected structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from API');
      }
      
      // Set files and directories from the response
      setFiles(Array.isArray(data.files) ? data.files : []);
      setDirectories(Array.isArray(data.directories) ? data.directories : []);
      
      console.log(`Fetched ${data.files?.length || 0} files and ${data.directories?.length || 0} directories`);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(`Error loading files: ${err.message}`);
    }
  };
  
  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles.length) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      // Get the auth token
      let token = 'dev-token';
      if (currentUser) {
        try {
          token = await currentUser.getIdToken();
        } catch (err) {
          console.error('Error getting auth token:', err);
        }
      }
      
      const formData = new FormData();
      formData.append('path', currentPath);
      
      // Append each file to the form data
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }
      
      console.log(`Uploading ${selectedFiles.length} files to path ${currentPath}`);
      
      // Upload the file(s)
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      // Handle progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };
      
      // Handle completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            fetchFiles();
          } else {
            setError(response.error || 'Upload failed');
          }
        } else {
          setError(`Upload failed: ${xhr.status} ${xhr.statusText}`);
        }
        setIsUploading(false);
      };
      
      // Handle errors
      xhr.onerror = () => {
        setError('Network error during upload');
        setIsUploading(false);
      };
      
      xhr.send(formData);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(`Upload error: ${err.message}`);
      setIsUploading(false);
    }
  };
  
  const handleFileDelete = async (filename) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }
    
    try {
      setError(null);
      
      // Get the auth token
      let token = 'dev-token';
      if (currentUser) {
        try {
          token = await currentUser.getIdToken();
        } catch (err) {
          console.error('Error getting auth token:', err);
        }
      }
      
      console.log(`Deleting file ${filename} from path ${currentPath}`);
      
      const response = await fetch(`/api/delete-upload?filename=${encodeURIComponent(filename)}&path=${encodeURIComponent(currentPath)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the deleted file from the selected files
        setSelectedFiles(prev => prev.filter(f => f !== filename));
        fetchFiles();
      } else {
        throw new Error(data.error || 'Unknown error deleting file');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(`Error deleting file: ${err.message}`);
    }
  };
  
  const handleFileSelect = (file) => {
    if (multiple) {
      // Toggle selection for multiple files
      setSelectedFiles(prev => {
        if (prev.includes(file)) {
          return prev.filter(f => f !== file);
        } else {
          return [...prev, file];
        }
      });
    } else {
      // Select only this file for single selection
      setSelectedFiles([file]);
    }
  };
  
  const handleConfirmSelection = () => {
    const selectedUrls = multiple 
      ? selectedFiles.map(file => `/uploads/${currentPath ? `${currentPath}/` : ''}${file}`)
      : `/uploads/${currentPath ? `${currentPath}/` : ''}${selectedFiles[0]}`;
    
    onSelect(selectedUrls);
    onClose();
  };
  
  const navigateToDirectory = (dirName) => {
    const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
    setCurrentPath(newPath);
    setSelectedFiles([]);
  };
  
  const navigateToBreadcrumb = (path) => {
    setCurrentPath(path);
    setSelectedFiles([]);
  };
  
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
  };
  
  // Breadcrumb generation
  const breadcrumbs = [
    { name: 'Home', path: 'general' },
    ...currentPath.split('/').filter(Boolean).map((part, index, arr) => {
      if (part === 'general') return null;
      const path = arr.slice(0, index + 1).join('/');
      return { name: part, path };
    }).filter(Boolean)
  ];
  
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }
    
    try {
      setError(null);
      
      // Get the auth token
      let token = 'dev-token';
      if (currentUser) {
        try {
          token = await currentUser.getIdToken();
        } catch (err) {
          console.error('Error getting auth token:', err);
        }
      }
      
      console.log(`Creating folder '${newFolderName}' in path '${currentPath}'`);
      
      const response = await fetch('/api/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: currentPath,
          folderName: newFolderName
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setNewFolderName('');
        setShowCreateFolder(false);
        fetchFiles();
      } else {
        throw new Error(data.error || 'Unknown error creating folder');
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(`Error creating folder: ${err.message}`);
    }
  };
  
  const goBack = () => {
    if (currentPath === 'general' || !currentPath.includes('/')) {
      setCurrentPath('general');
    } else {
      const pathParts = currentPath.split('/');
      pathParts.pop();
      const newPath = pathParts.join('/');
      setCurrentPath(newPath);
    }
    setSelectedFiles([]);
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Determine if we should show the empty state
  const isEmpty = files.length === 0 && directories.length === 0;
  
  return (
    <div className={styles.mediaLibrary} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Media Library</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        
        <div className={styles.toolbar}>
          <div className={styles.breadcrumbs}>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.path}>
                {index > 0 && <span className={styles.breadcrumbSeparator}>/</span>}
                <button 
                  className={styles.breadcrumbButton}
                  onClick={() => navigateToBreadcrumb(crumb.path)}
                >
                  {index === 0 ? <HomeIcon /> : null} {crumb.name}
                </button>
              </span>
            ))}
          </div>
          
          <div className={styles.actions}>
            <div className={styles.viewModeToggle}>
              <button 
                className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                title="Grid view"
              >
                <GridIcon />
              </button>
              <button 
                className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
                title="List view"
              >
                <ListIcon />
              </button>
            </div>
            
            <button 
              className={styles.button}
              onClick={() => setShowCreateFolder(!showCreateFolder)}
            >
              <FolderAddIcon /> New Folder
            </button>
            
            <button 
              className={styles.uploadButton}
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
            >
              <UploadIcon /> Upload
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
              multiple
            />
          </div>
        </div>
        
        {showCreateFolder && (
          <div className={styles.createFolderForm}>
            <input 
              type="text" 
              value={newFolderName} 
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
            />
            <button onClick={handleCreateFolder}>Create</button>
            <button onClick={() => setShowCreateFolder(false)}>Cancel</button>
          </div>
        )}
        
        {isUploading && (
          <div className={styles.uploadProgress}>
            <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
          </div>
        )}
        
        {error && (
          <div className={styles.error}>
            <ErrorIcon /> {error}
          </div>
        )}
        
        {viewMode === 'grid' ? (
          <div className={styles.grid}>
            {currentPath !== 'general' && (
              <div className={styles.backFolder} onClick={goBack}>
                <div className={styles.folderIcon}>
                  <BackIcon />
                </div>
                <div className={styles.folderName}>Back</div>
              </div>
            )}
            
            {directories.map((dir) => (
              <div 
                key={dir}
                className={styles.folderItem} 
                onClick={() => navigateToDirectory(dir)}
              >
                <div className={styles.folderIcon}>
                  <FolderIcon />
                </div>
                <div className={styles.folderName}>{dir}</div>
              </div>
            ))}
            
            {files.map((file) => {
              const isImage = /\.(jpe?g|png|gif|svg|webp)$/i.test(file.filename);
              const fileName = file.filename;
              const fileSize = file.size || 0;
              const isSelected = selectedFiles.includes(fileName);
              
              return (
                <div 
                  key={fileName}
                  className={`${styles.fileItem} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleFileSelect(fileName)}
                >
                  <div className={styles.fileImageContainer}>
                    {isImage ? (
                      <img 
                        src={`/uploads/${currentPath ? `${currentPath}/` : ''}${fileName}`} 
                        alt={fileName}
                        className={styles.fileImage}
                      />
                    ) : (
                      <div className={styles.fileIcon}>📄</div>
                    )}
                    <button 
                      className={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileDelete(fileName);
                      }}
                      aria-label="Delete file"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className={styles.fileDetails}>
                    <div className={styles.fileName}>{fileName}</div>
                    <div className={styles.fileSize}>{formatFileSize(fileSize)}</div>
                  </div>
                </div>
              );
            })}
            
            {isEmpty && (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <EmptyIcon />
                </div>
                <div className={styles.emptyStateText}>
                  {currentPath ? 'This folder is empty' : 'No files found'}
                </div>
                <button 
                  className={styles.uploadButton}
                  onClick={() => fileInputRef.current.click()}
                >
                  <UploadIcon /> Upload Files
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            <div className={styles.listView}>
              <div className={styles.fileItemHeader}>
                <div className={styles.listCell}>Name</div>
                <div className={styles.listCell}>Size</div>
                <div className={styles.listCell}>Type</div>
                <div className={styles.listCell}>Actions</div>
              </div>
              
              {currentPath !== 'general' && (
                <div className={styles.listItem} onClick={goBack}>
                  <div className={styles.listCell}>
                    <div className={`${styles.fileName} ${styles.listMode}`}>
                      <BackIcon /> ..
                    </div>
                  </div>
                  <div className={styles.listCell}>-</div>
                  <div className={styles.listCell}>Folder</div>
                  <div className={styles.listCell}></div>
                </div>
              )}
              
              {directories.map((dir) => (
                <div 
                  key={dir}
                  className={styles.listItem} 
                  onClick={() => navigateToDirectory(dir)}
                >
                  <div className={styles.listCell}>
                    <div className={`${styles.fileName} ${styles.listMode}`}>
                      <FolderIcon /> {dir}
                    </div>
                  </div>
                  <div className={styles.listCell}>-</div>
                  <div className={styles.listCell}>Folder</div>
                  <div className={styles.listCell}></div>
                </div>
              ))}
              
              {files.map((file) => {
                const isImage = /\.(jpe?g|png|gif|svg|webp)$/i.test(file.filename);
                const fileName = file.filename;
                const fileSize = file.size || 0;
                const isSelected = selectedFiles.includes(fileName);
                const fileType = isImage ? 'Image' : 'File';
                
                return (
                  <div 
                    key={fileName}
                    className={`${styles.listItem} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleFileSelect(fileName)}
                  >
                    <div className={styles.listCell}>
                      <div className={`${styles.fileName} ${styles.listMode}`}>
                        <div className={styles.filePreview}>
                          {isImage ? (
                            <img 
                              src={`/uploads/${currentPath ? `${currentPath}/` : ''}${fileName}`} 
                              alt={fileName}
                            />
                          ) : (
                            <div className={styles.fileIcon}>📄</div>
                          )}
                        </div>
                        {fileName}
                      </div>
                    </div>
                    <div className={styles.listCell}>{formatFileSize(fileSize)}</div>
                    <div className={styles.listCell}>{fileType}</div>
                    <div className={`${styles.listCell} ${styles.fileCellActions}`}>
                      <button 
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileDelete(fileName);
                        }}
                        aria-label="Delete file"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {isEmpty && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <EmptyIcon />
                  </div>
                  <div className={styles.emptyStateText}>
                    {currentPath ? 'This folder is empty' : 'No files found'}
                  </div>
                  <button 
                    className={styles.uploadButton}
                    onClick={() => fileInputRef.current.click()}
                  >
                    <UploadIcon /> Upload Files
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className={styles.footer}>
          <div className={styles.selectedCount}>
            {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected` : 'No files selected'}
          </div>
          <button 
            className={styles.confirmButton}
            onClick={handleConfirmSelection}
            disabled={selectedFiles.length === 0}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
};

// Home icon component
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
  </svg>
);

export default MediaLibrary; 