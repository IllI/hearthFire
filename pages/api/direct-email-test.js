// Direct email test endpoint
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { email = 'cityzenill@gmail.com' } = req.body;
    console.log(`Direct email test: sending to ${email}`);

    // Print all environment variables related to email (no secret values)
    console.log('Email environment variables:');
    console.log(`- EMAIL_HOST: ${process.env.EMAIL_HOST}`);
    console.log(`- EMAIL_PORT: ${process.env.EMAIL_PORT}`);
    console.log(`- EMAIL_SECURE: ${process.env.EMAIL_SECURE}`);
    console.log(`- EMAIL_USER: ${process.env.EMAIL_USER}`);
    console.log(`- EMAIL_PASSWORD: [Length: ${process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.length : 0}]`);

    // Try a direct connection with detailed debug output
    console.log('Attempting direct connection...');
    const password = process.env.EMAIL_PASSWORD.trim();
    
    // Log password characteristics for debugging (safely)
    console.log(`Password length: ${password.length}`);
    console.log(`Password first character: ${password.charAt(0)}`);
    console.log(`Password last character: ${password.charAt(password.length - 1)}`);
    console.log(`Password contains hyphens: ${password.includes('-')}`);
    
    // Create transporter with minimal configuration
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '465'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: password
      },
      debug: true,
      logger: true
    });

    // Send a simple test message
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"Hearthfire Test" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Direct SMTP Test',
      text: 'This is a direct SMTP test to diagnose connection issues.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Direct SMTP Test</h1>
          <p>This email was sent using direct SMTP connection.</p>
          <p>If you received this, it means the email configuration is working.</p>
          <p>Time sent: ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);

    return res.status(200).json({
      success: true,
      message: 'Direct test email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Direct email test failed:', error);
    
    // Try with fallback to Ethereal
    try {
      console.log('Attempting fallback to Ethereal...');
      const testAccount = await nodemailer.createTestAccount();
      
      const etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      
      const info = await etherealTransporter.sendMail({
        from: `"Hearthfire Test" <${testAccount.user}>`,
        to: req.body.email || 'cityzenill@gmail.com',
        subject: 'Direct SMTP Test (Fallback)',
        text: 'This is a fallback test using Ethereal.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Ethereal Fallback Test</h1>
            <p>This email was sent using the Ethereal fallback service.</p>
            <p>The primary email service failed with error: ${error.message}</p>
            <p>Time sent: ${new Date().toLocaleString()}</p>
          </div>
        `
      });
      
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Fallback email sent successfully to Ethereal');
      console.log('Preview URL:', previewUrl);
      
      return res.status(207).json({
        success: false,
        primaryError: error.message,
        fallbackSuccess: true,
        previewUrl: previewUrl,
        note: 'Primary email failed but fallback succeeded'
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return res.status(500).json({
        success: false,
        error: error.message,
        fallbackError: fallbackError.message,
        note: 'Both primary and fallback email services failed'
      });
    }
  }
} 