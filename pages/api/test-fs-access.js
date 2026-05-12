import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const results = {
    success: false,
    tests: [],
    error: null
  };
  
  try {
    // Test 1: Check if we can read the current directory
    try {
      const currentDir = process.cwd();
      const files = await fs.readdir(currentDir);
      results.tests.push({
        name: 'Read current directory',
        success: true,
        path: currentDir,
        files: files.slice(0, 5) // Just return the first 5 files
      });
    } catch (error) {
      results.tests.push({
        name: 'Read current directory',
        success: false,
        error: error.message
      });
    }
    
    // Test 2: Check if public directory exists
    try {
      const publicDir = path.join(process.cwd(), 'public');
      const publicExists = await fs.stat(publicDir).then(() => true).catch(() => false);
      results.tests.push({
        name: 'Check public directory',
        success: publicExists,
        path: publicDir,
        exists: publicExists
      });
      
      if (publicExists) {
        const files = await fs.readdir(publicDir);
        results.tests[results.tests.length - 1].files = files.slice(0, 5);
      }
    } catch (error) {
      results.tests.push({
        name: 'Check public directory',
        success: false,
        error: error.message
      });
    }
    
    // Test 3: Create/read/write to uploads directory
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      // Write a test file
      const testFilePath = path.join(uploadsDir, 'test-file.txt');
      await fs.writeFile(testFilePath, 'Test file created at ' + new Date().toISOString());
      
      // Read it back
      const fileContent = await fs.readFile(testFilePath, 'utf8');
      
      results.tests.push({
        name: 'Create and write to uploads directory',
        success: true,
        path: uploadsDir,
        testFile: testFilePath,
        content: fileContent
      });
    } catch (error) {
      results.tests.push({
        name: 'Create and write to uploads directory',
        success: false,
        error: error.message
      });
    }
    
    // Test 4: Check environment variables
    results.tests.push({
      name: 'Environment check',
      success: true,
      isProduction: process.env.NODE_ENV === 'production',
      nodeEnv: process.env.NODE_ENV,
      hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      isFirebaseFunctions: !!(process.env.FIREBASE_CONFIG || process.env.FUNCTION_NAME)
    });
    
    // Overall success
    results.success = results.tests.every(test => test.success);
    
    return res.status(200).json(results);
  } catch (error) {
    results.error = error.message;
    results.stack = error.stack;
    return res.status(500).json(results);
  }
} 