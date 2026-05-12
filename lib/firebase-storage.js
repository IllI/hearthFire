import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from 'firebase/storage';

// Flag to completely disable Firebase Storage (set to true to only use local storage)
const DISABLE_FIREBASE = true;

/**
 * Upload an image to local storage first, with Firebase as fallback
 * @param {File} file - The file to upload
 * @param {string} path - The storage path (e.g., 'content-images')
 * @param {Function} progressCallback - Optional callback for upload progress
 * @returns {Promise<string>} - The download URL of the uploaded file
 */
export const uploadImage = async (file, path = 'content-images', progressCallback = null) => {
  try {
    // First try to use local storage
    console.log(`Using local storage for uploading ${file.name} to ${path}`);
    return await useLocalUpload(file, path, progressCallback);
  } catch (localError) {
    console.error('Local upload failed:', localError);

    // Only try Firebase if not disabled
    if (!DISABLE_FIREBASE) {
      console.log('Attempting Firebase Storage fallback');
      return await useFirebaseUpload(file, path, progressCallback);
    } else {
      console.error('Firebase Storage is disabled, and local upload failed');
      throw new Error('Image upload failed and Firebase fallback is disabled');
    }
  }
};

/**
 * Upload to local storage via the fallback-upload endpoint
 */
const useLocalUpload = async (file, path, progressCallback) => {
  // Report initial progress
  if (progressCallback) progressCallback(10);

  // Create a FormData object with the file and path info
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path); // Added path information

  // Use a dev token in development
  const token = 'dev-token';

  try {
    // Upload using our fallback API
    const response = await fetch('/api/fallback-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    // Report progress
    if (progressCallback) progressCallback(75);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local upload failed: ${errorText}`);
    }

    const data = await response.json();

    // Report complete
    if (progressCallback) progressCallback(100);

    return data.url;
  } catch (error) {
    console.error('Local upload error:', error);
    throw error;
  }
};

/**
 * Upload to Firebase Storage (used as fallback only)
 */
const useFirebaseUpload = async (file, path, progressCallback) => {
  try {
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `${path}/${filename}`);

    // Test if Firebase Storage is accessible
    const testRef = ref(storage);
    await new Promise((resolve, reject) => {
      // Set a timeout in case Firebase hangs
      const timeout = setTimeout(() => {
        reject(new Error('Firebase Storage connection timed out'));
      }, 3000);

      // Try to list an item to verify connectivity
      listAll(testRef).then(() => {
        clearTimeout(timeout);
        resolve();
      }).catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Return a promise that resolves with the download URL
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Calculate progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          // Call progress callback if provided
          if (progressCallback) {
            progressCallback(progress);
          }
        },
        (error) => {
          // Handle errors
          console.error('Firebase upload error:', error);
          reject(error);
        },
        async () => {
          // Upload completed successfully, get the download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  } catch (error) {
    console.error('Firebase Storage error:', error);
    throw error;
  }
};

/**
 * Get a list of all images
 * @param {string} path - The storage path to list from
 * @returns {Promise<Array>} - Array of image objects with name and URL
 */
export const listImages = async (path = 'content-images') => {
  try {
    // First try to use local storage
    console.log(`Listing images from local path: ${path}`);
    return await listLocalImages(path);
  } catch (localError) {
    console.error('Local image listing failed:', localError);

    // Only try Firebase if not disabled
    if (!DISABLE_FIREBASE) {
      console.log('Attempting to list images from Firebase Storage');
      return await listFirebaseImages(path);
    } else {
      console.error('Firebase Storage is disabled, and local listing failed');
      return []; // Return empty array as fallback
    }
  }
};

/**
 * List images from local storage
 */
const listLocalImages = async (path) => {
  try {
    const response = await fetch(`/api/list-uploads?path=${encodeURIComponent(path)}`);

    if (!response.ok) {
      console.error('Local listing failed:', response.status);
      throw new Error(`Failed to list local images: ${response.statusText}`);
    }

    const data = await response.json();

    // Map the response to match our format
    return data.files.map(file => ({
      name: file.name,
      fullPath: `local-uploads/${path}/${file.name}`,
      url: file.url,
      createdAt: file.createdAt || Date.now().toString(),
      size: file.size,
      path: path
    }));
  } catch (error) {
    console.error('Error listing local images:', error);
    throw error;
  }
};

/**
 * List images from Firebase Storage (used as fallback only)
 */
const listFirebaseImages = async (path) => {
  try {
    // Test Firebase connectivity
    const testRef = ref(storage);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Firebase Storage connection timed out'));
      }, 3000);

      listAll(testRef).then(() => {
        clearTimeout(timeout);
        resolve();
      }).catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // List images from Firebase
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);

    // Get download URLs
    const items = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          url: url,
          createdAt: itemRef.name.split('-')[0] || null,
          path: path
        };
      })
    );

    // Sort by creation time
    return items.sort((a, b) =>
      b.createdAt && a.createdAt ? parseInt(b.createdAt) - parseInt(a.createdAt) : 0
    );
  } catch (error) {
    console.error('Error listing Firebase images:', error);
    throw error;
  }
};

/**
 * Delete an image
 * @param {string} fullPath - The full path of the file to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export const deleteImage = async (fullPath) => {
  try {
    // Determine if this is a local path or a Firebase path
    if (fullPath.startsWith('local-uploads/')) {
      // Parse the path components
      const pathComponents = fullPath.replace('local-uploads/', '').split('/');
      const filename = pathComponents.pop(); // Get the filename
      const path = pathComponents.join('/'); // Reassemble the path

      console.log(`Deleting local image: ${filename} from path: ${path}`);
      return await deleteLocalImage(filename, path);
    } else {
      // Only try Firebase if not disabled
      if (!DISABLE_FIREBASE) {
        console.log(`Deleting Firebase image: ${fullPath}`);
        return await deleteFirebaseImage(fullPath);
      } else {
        console.error('Firebase Storage is disabled, unable to delete Firebase image');
        return false;
      }
    }
  } catch (error) {
    console.error('Error in deleteImage:', error);
    return false;
  }
};

/**
 * Delete an image from local storage
 */
const deleteLocalImage = async (filename, path = '') => {
  try {
    const queryParams = new URLSearchParams({
      filename: filename
    });

    if (path) {
      queryParams.append('path', path);
    }

    const response = await fetch(`/api/delete-upload?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer dev-token'
      }
    });

    if (!response.ok) {
      console.error('Local delete failed:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting local image:', error);
    return false;
  }
};

/**
 * Delete an image from Firebase Storage
 */
const deleteFirebaseImage = async (fullPath) => {
  try {
    const imageRef = ref(storage, fullPath);
    await deleteObject(imageRef);
    return true;
  } catch (error) {
    console.error('Error deleting Firebase image:', error);
    return false;
  }
}; 