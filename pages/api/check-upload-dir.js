import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    // Check main uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    let uploadsDirExists = false;
    
    try {
      await fs.access(uploadsDir, fs.constants.F_OK);
      uploadsDirExists = true;
      console.log('Upload directory exists:', uploadsDir);
    } catch (error) {
      uploadsDirExists = false;
      console.log('Upload directory does not exist, will create it:', uploadsDir);
    }
    
    // Create main uploads dir if needed
    if (!uploadsDirExists) {
      try {
        await fs.mkdir(uploadsDir, { recursive: true });
        console.log('Created upload directory:', uploadsDir);
      } catch (mkdirError) {
        console.error('Error creating upload directory:', mkdirError);
        return res.status(500).json({
          error: 'Failed to create upload directory',
          details: mkdirError.message,
          code: mkdirError.code
        });
      }
    }
    
    // Check if directory is writable by creating a test file
    const testFilePath = path.join(uploadsDir, `test-file-${Date.now()}.txt`);
    try {
      await fs.writeFile(testFilePath, 'This is a test file to check write permissions.');
      console.log('Successfully wrote test file:', testFilePath);
      
      // Clean up test file
      await fs.unlink(testFilePath);
      console.log('Cleaned up test file');
    } catch (writeError) {
      console.error('Error writing test file:', writeError);
      return res.status(500).json({
        error: 'Directory exists but is not writable',
        details: writeError.message,
        code: writeError.code
      });
    }
    
    // Check products subdirectory
    const productsDir = path.join(uploadsDir, 'products');
    let productsDirExists = false;
    
    try {
      await fs.access(productsDir, fs.constants.F_OK);
      productsDirExists = true;
      console.log('Products directory exists:', productsDir);
    } catch (error) {
      productsDirExists = false;
      console.log('Products directory does not exist, will create it:', productsDir);
    }
    
    // Create products dir if needed
    if (!productsDirExists) {
      try {
        await fs.mkdir(productsDir, { recursive: true });
        console.log('Created products directory:', productsDir);
      } catch (mkdirError) {
        console.error('Error creating products directory:', mkdirError);
        return res.status(500).json({
          error: 'Failed to create products directory',
          details: mkdirError.message,
          code: mkdirError.code
        });
      }
    }
    
    // Check if products directory is writable
    const testProductsFilePath = path.join(productsDir, `test-file-${Date.now()}.txt`);
    try {
      await fs.writeFile(testProductsFilePath, 'This is a test file to check write permissions in products dir.');
      console.log('Successfully wrote test file to products dir:', testProductsFilePath);
      
      // Clean up test file
      await fs.unlink(testProductsFilePath);
      console.log('Cleaned up test file from products dir');
    } catch (writeError) {
      console.error('Error writing test file to products dir:', writeError);
      return res.status(500).json({
        error: 'Products directory exists but is not writable',
        details: writeError.message,
        code: writeError.code
      });
    }
    
    // Return success response with structure information
    return res.status(200).json({
      success: true,
      directories: {
        uploads: {
          path: uploadsDir,
          exists: true,
          writable: true
        },
        products: {
          path: productsDir,
          exists: true,
          writable: true
        }
      },
      message: 'Upload directories exist and are writable'
    });
  } catch (error) {
    console.error('Unexpected error checking upload directories:', error);
    return res.status(500).json({
      error: 'Unexpected error checking upload directories',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 