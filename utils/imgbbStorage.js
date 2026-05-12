import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';

// ImgBB API Key provided by user
const IMGBB_API_KEY = '93d42a3af8827220fb00930836b61a44';

/**
 * Uploads an image to ImgBB directly from the client, replacing Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} folder - The folder to upload to (ignored for ImgBB as it doesn't support folders in free tier)
 * @param {Function} onProgress - Optional callback for upload progress (0-100)
 * @returns {Promise<string>} - The direct display URL of the uploaded file
 */
export const uploadImageToImgBB = async (file, folder = 'products', onProgress = null) => {
  if (!file) throw new Error('No file provided');

  console.log(`[ImgBB] Starting upload for ${file.name}`);
  console.log('IMGBB UPLOADER V3 LOADED');

  try {
    // 1. Prepare the file for upload (convert to base64)
    if (onProgress) onProgress(10);

    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        // Strip the data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress(30);

    // 2. Prepare Form Data
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64Image);
    formData.append('name', file.name.split('.')[0]); // Name without extension

    if (onProgress) onProgress(50);

    // 3. Send to ImgBB
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });

    if (onProgress) onProgress(80);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ImgBB] API Error:', errorText);
      throw new Error(`ImgBB upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('[ImgBB] Unsuccessful response:', data);
      throw new Error('ImgBB returned success: false');
    }

    if (onProgress) onProgress(100);

    // Return the display URL
    const imageUrl = data.data.url; // or data.data.display_url
    console.log(`[ImgBB] Upload success: ${imageUrl}`);
    return imageUrl;

  } catch (error) {
    console.error('[ImgBB] Upload error:', error);
    throw error;
  }
};

/**
 * Deletes an image from storage
 * Note: ImgBB API does not allow deletion via API key without the specific delete_url returned during upload.
 * We are not storing the delete URL, so we cannot delete images from ImgBB via this function.
 * This is a no-op for ImgBB URLs to prevent errors.
 * 
 * If the URL is a Firebase Storage URL (legacy), we attempt to delete it.
 */
export const deleteImageFromStorage = async (url) => {
  if (!url) return;

  try {
    // Check if it's a Firebase URL
    if (url.includes('firebasestorage.googleapis.com')) {
      // Extract the path from the URL
      const decodedUrl = decodeURIComponent(url);
      const path = decodedUrl.split('o/')[1]?.split('?')[0];

      if (!path) {
        console.warn('[Storage] Cannot parse path from Firebase URL:', url);
        return;
      }

      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      console.log(`[Storage] Firebase file deleted: ${path}`);
    } else {
      console.log('[Storage] Skipping deletion for non-Firebase URL (ImgBB etc):', url);
    }
  } catch (error) {
    console.error('[Storage] Error deleting file:', error);
    // Suppress error to avoid breaking UI flow for deletion failures
  }
};