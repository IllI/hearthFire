import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  console.log('ImgBB upload handler called');

  try {
    // Parse the incoming form data
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      multiples: false
    });

    // Parse the form
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parsing error:', err);
          reject(err);
        } else {
          resolve([fields, files]);
        }
      });
    });

    console.log("Form parsed successfully");

    // Get the file from the form
    let file;
    if (files.file) {
      file = files.file;
    } else if (Array.isArray(files.file) && files.file.length > 0) {
      file = files.file[0];
    }

    if (!file) {
      console.error('No file found in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get file info
    const filepath = file.filepath || file.path;
    const filename = file.originalFilename || file.originalname || file.name || 'unknown';
    const filesize = file.size || 0;
    const filetype = file.mimetype || file.type || 'application/octet-stream';

    console.log('File details:', {
      filename,
      filesize,
      filetype,
      filepath: filepath ? 'Valid path found' : 'Path missing'
    });

    if (!filepath) {
      console.error('File path is missing after parsing');
      return res.status(500).json({ error: 'File path missing after processing' });
    }

    // Get ImgBB API key from environment variables
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';
    console.log('Using ImgBB API key ending with:', IMGBB_API_KEY.slice(-4));

    // Read the file data
    console.log('Reading file data...');
    const fileBuffer = await fs.readFile(filepath);
    console.log('File read successful, size:', fileBuffer.length);

    // Encode the file as base64
    const base64Image = fileBuffer.toString('base64');

    console.log('Uploading image to ImgBB using native fetch API...');

    try {
      // Use native fetch API instead of axios
      const formData = new URLSearchParams();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', base64Image);
      formData.append('name', filename);

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // Not directly supported, but mentioned for documentation
      });

      console.log('ImgBB API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ImgBB response not OK:', errorText);
        throw new Error(`ImgBB API error: ${response.status}`);
      }

      const data = await response.json();

      // Check if the upload was successful
      if (data && data.success) {
        console.log('Image uploaded successfully to ImgBB');

        // Return the image URL
        return res.status(200).json({
          url: data.data.url,
          display_url: data.data.display_url,
          thumb_url: data.data.thumb.url,
          delete_url: data.data.delete_url,
          size: file.size
        });
      } else {
        console.error('ImgBB upload failed:', data);
        return res.status(500).json({
          error: 'Failed to upload image to ImgBB',
          details: data
        });
      }
    } catch (fetchError) {
      console.error('Error in ImgBB API request:', fetchError);

      return res.status(500).json({
        error: 'ImgBB API error',
        message: fetchError.message
      });
    }
  } catch (error) {
    console.error('Unhandled error in image upload handler:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({
      error: 'Server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 