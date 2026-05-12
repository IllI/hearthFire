// Test email API endpoint
import { sendAccountRegistrationConfirmation } from '../../lib/email-service';
import nodemailer from 'nodemailer';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';

// Promisify DNS lookup
const dnsLookup = promisify(dns.lookup);

// Test direct TCP connection to server
const testConnection = (host, port) => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let errorOccurred = false;
    
    // Set timeout to 5 seconds
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log(`Successfully connected to ${host}:${port}`);
      socket.end();
      resolve({ success: true, message: `Successfully connected to ${host}:${port}` });
    });
    
    socket.on('timeout', () => {
      errorOccurred = true;
      console.log(`Connection to ${host}:${port} timed out`);
      socket.destroy();
      reject({ success: false, message: `Connection to ${host}:${port} timed out` });
    });
    
    socket.on('error', (err) => {
      errorOccurred = true;
      console.log(`Error connecting to ${host}:${port}: ${err.message}`);
      reject({ success: false, message: `Error connecting to ${host}:${port}: ${err.message}` });
    });
    
    socket.on('close', () => {
      if (!errorOccurred) {
        resolve({ success: true, message: `Connection to ${host}:${port} closed` });
      }
    });
    
    console.log(`Testing direct connection to ${host}:${port}...`);
    socket.connect(port, host);
  });
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Extract email and settings from request body
    const { 
      email = 'cityzenill@gmail.com',
      useCustomSettings = false,
      smtpSettings = {},
      testConnectivity = true
    } = req.body;
    
    console.log(`Test email request received, sending to: ${email}`);
    console.log(`Using custom settings: ${useCustomSettings}`);
    
    // Log environment variables (without exposing password)
    console.log('Default email configuration from environment:');
    console.log(`- EMAIL_HOST: ${process.env.EMAIL_HOST}`);
    console.log(`- EMAIL_PORT: ${process.env.EMAIL_PORT}`);
    console.log(`- EMAIL_SECURE: ${process.env.EMAIL_SECURE}`);
    console.log(`- EMAIL_USER: ${process.env.EMAIL_USER}`);
    console.log(`- EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? 'Set (not shown)' : 'Not set'}`);
    
    // Determine SMTP settings
    const host = useCustomSettings && smtpSettings.host ? smtpSettings.host : (process.env.EMAIL_HOST || '208.91.199.223');
    const port = useCustomSettings && smtpSettings.port ? parseInt(smtpSettings.port) : parseInt(process.env.EMAIL_PORT || '587');
    
    // Test DNS resolution for the host if it's not an IP address
    if (testConnectivity && !(/^[0-9.]+$/.test(host))) {
      try {
        console.log(`Testing DNS resolution for ${host}...`);
        const { address, family } = await dnsLookup(host);
        console.log(`DNS lookup successful: ${host} resolves to ${address} (IPv${family})`);
      } catch (dnsError) {
        console.error(`DNS lookup failed for ${host}:`, dnsError.message);
        // Continue anyway, as we might be able to connect using IP
      }
    }
    
    // Test direct TCP connection
    if (testConnectivity) {
      try {
        const connectionResult = await testConnection(host, port);
        console.log(`TCP connection test result: ${connectionResult.message}`);
      } catch (connError) {
        console.warn(`TCP connection test failed: ${connError.message}`);
        // Continue anyway, as SMTP client might have more advanced connection capabilities
      }
    }
    
    // Test SMTP connection
    console.log('Testing SMTP connection...');
    
    const config = {
      host: host,
      port: port,
      secure: useCustomSettings && (smtpSettings.secure !== undefined) ? smtpSettings.secure : (process.env.EMAIL_SECURE === 'true'),
      auth: {
        user: useCustomSettings && smtpSettings.user ? smtpSettings.user : (process.env.EMAIL_USER || 'info@hearthfirefarm.com'),
        pass: useCustomSettings && smtpSettings.password ? smtpSettings.password : process.env.EMAIL_PASSWORD
      },
      debug: true,
      logger: true,
      authMethod: 'PLAIN',
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000
    };
    
    console.log(`Using SMTP configuration: host=${config.host}, port=${config.port}, secure=${config.secure}, user=${config.auth.user}`);
    
    try {
      console.log(`Attempting to connect to ${config.host}:${config.port}...`);
      const transporter = nodemailer.createTransport(config);
      
      // Try to verify the connection
      await transporter.verify();
      console.log('SMTP connection verified successfully');
      
      // Create a mock user
      const mockUser = {
        displayName: 'Test User',
        email: email
      };
      
      // If custom settings are used, send directly without the email service
      if (useCustomSettings) {
        console.log('Sending test email with custom settings...');
        
        const info = await transporter.sendMail({
          from: `"Hearthfire Farm Test" <${config.auth.user}>`,
          to: email,
          subject: 'Test Email from Hearthfire Farm',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Hearthfire Farm Test Email</h1>
              </div>
              
              <div style="padding: 20px;">
                <p>Dear Test User,</p>
                
                <p>This is a test email sent from the Hearthfire Farm website using custom SMTP settings:</p>
                
                <ul>
                  <li>Host: ${config.host}</li>
                  <li>Port: ${config.port}</li>
                  <li>Secure: ${config.secure}</li>
                  <li>User: ${config.auth.user}</li>
                </ul>
                
                <p>If you received this email, your email configuration is working correctly!</p>
                
                <p>Sent at: ${new Date().toLocaleString()}</p>
                
                <p>Sincerely,<br>The Hearthfire Farm Team</p>
              </div>
              
              <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                <p>This is a test email. Please do not reply to this message.</p>
              </div>
            </div>
          `
        });
        
        console.log('Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Test email sent successfully with custom settings', 
          messageId: info.messageId,
          connectionInfo: {
            host: config.host,
            port: config.port,
            secure: config.secure
          }
        });
      }
      
      // Otherwise use the regular email service
      console.log('Sending test email with email service...');
      const result = await sendAccountRegistrationConfirmation(mockUser);
      
      if (result) {
        console.log('Test email sent successfully!');
        console.log('Message ID:', result.messageId);
        
        if (result.previewUrl) {
          console.log('Preview URL:', result.previewUrl);
        }
        
        return res.status(200).json({ 
          success: true, 
          message: 'Test email sent successfully', 
          messageId: result.messageId,
          previewUrl: result.previewUrl || null,
          connectionInfo: {
            host: config.host,
            port: config.port,
            secure: config.secure
          }
        });
      } else {
        console.log('Test email function returned null or undefined');
        return res.status(500).json({ 
          success: false, 
          error: 'Email service returned null result',
        });
      }
    } catch (verifyError) {
      console.error('SMTP connection verification failed:', verifyError);
      
      // Try with alternative settings as a test
      try {
        console.log('Attempting with alternative SMTP settings...');
        
        // Try different configurations
        const alternativeConfigs = [
          // Try with SSL
          {
            ...config,
            port: 465,
            secure: true
          },
          // Try with different auth method
          {
            ...config,
            authMethod: 'LOGIN'
          },
          // Try with standard port 25
          {
            ...config,
            port: 25,
            secure: false
          }
        ];
        
        let successfulConfig = null;
        
        for (const altConfig of alternativeConfigs) {
          try {
            console.log(`Trying alternative config: port=${altConfig.port}, secure=${altConfig.secure}, authMethod=${altConfig.authMethod}`);
            const altTransporter = nodemailer.createTransport(altConfig);
            
            await altTransporter.verify();
            console.log('Alternative SMTP connection verified successfully');
            successfulConfig = altConfig;
            
            // Send a test email with the working config
            const mockUser = {
              displayName: 'Test User',
              email: email
            };
            
            const info = await altTransporter.sendMail({
              from: `"Hearthfire Farm Test" <${altConfig.auth.user}>`,
              to: email,
              subject: 'Test Email from Hearthfire Farm (Alternative Settings)',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #FFA500; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Hearthfire Farm Test Email</h1>
                    <h2 style="color: white; margin: 10px 0 0 0;">Alternative Settings</h2>
                  </div>
                  
                  <div style="padding: 20px;">
                    <p>Dear Test User,</p>
                    
                    <p>This is a test email sent from the Hearthfire Farm website using <strong>alternative SMTP settings</strong>:</p>
                    
                    <ul>
                      <li>Host: ${altConfig.host}</li>
                      <li>Port: ${altConfig.port}</li>
                      <li>Secure: ${altConfig.secure}</li>
                      <li>Auth Method: ${altConfig.authMethod}</li>
                    </ul>
                    
                    <p>If you received this email, these alternative settings work correctly!</p>
                    
                    <p>Please update your environment variables to use these settings.</p>
                    
                    <p>Sent at: ${new Date().toLocaleString()}</p>
                    
                    <p>Sincerely,<br>The Hearthfire Farm Team</p>
                  </div>
                  
                  <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                    <p>This is a test email. Please do not reply to this message.</p>
                  </div>
                </div>
              `
            });
            
            console.log('Alternative settings test email sent successfully!');
            console.log('Message ID:', info.messageId);
            
            break; // Exit the loop if we found a working config
          } catch (configError) {
            console.error(`Alternative config failed:`, configError.message);
            // Continue to next configuration
          }
        }
        
        if (successfulConfig) {
          return res.status(200).json({ 
            success: true, 
            message: 'Email sent with alternative settings',
            note: `Please update your environment variables to use these settings: Host=${successfulConfig.host}, Port=${successfulConfig.port}, Secure=${successfulConfig.secure}, AuthMethod=${successfulConfig.authMethod}`,
            suggestedConfig: {
              host: successfulConfig.host,
              port: successfulConfig.port,
              secure: successfulConfig.secure,
              authMethod: successfulConfig.authMethod
            }
          });
        }
        
        // If no alternative configs worked, try alternative hosts
        const alternativeHosts = [
          { host: 'smtp.spaceship.com', port: 587, secure: false },
          { host: 'outgoing.spaceship.com', port: 587, secure: false },
          { host: 'mail.hearthfirefarm.com', port: 587, secure: false },
          { host: 'smtp.hearthfirefarm.com', port: 587, secure: false }
        ];
        
        for (const altHost of alternativeHosts) {
          try {
            // Test direct connection first
            if (testConnectivity) {
              try {
                await testConnection(altHost.host, altHost.port);
                console.log(`TCP connection to ${altHost.host}:${altHost.port} successful`);
              } catch (connErr) {
                console.warn(`TCP connection to ${altHost.host}:${altHost.port} failed: ${connErr.message}`);
                // Continue anyway - DNS might not be set up
              }
            }
            
            const altConfig = {
              ...config,
              host: altHost.host,
              port: altHost.port,
              secure: altHost.secure
            };
            
            console.log(`Trying alternative host: ${altConfig.host}:${altConfig.port}`);
            const altTransporter = nodemailer.createTransport(altConfig);
            
            await altTransporter.verify();
            console.log(`Alternative SMTP server ${altConfig.host} verified successfully`);
            
            // Send test email with this host
            const info = await altTransporter.sendMail({
              from: `"Hearthfire Farm Test" <${altConfig.auth.user}>`,
              to: email,
              subject: 'Test Email from Hearthfire Farm (Alternative Host)',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Hearthfire Farm Test Email</h1>
                    <h2 style="color: white; margin: 10px 0 0 0;">Alternative Host</h2>
                  </div>
                  
                  <div style="padding: 20px;">
                    <p>Dear Test User,</p>
                    
                    <p>This is a test email sent from the Hearthfire Farm website using an <strong>alternative host</strong>:</p>
                    
                    <ul>
                      <li>Host: ${altConfig.host}</li>
                      <li>Port: ${altConfig.port}</li>
                      <li>Secure: ${altConfig.secure}</li>
                    </ul>
                    
                    <p>If you received this email, this alternative host works correctly!</p>
                    
                    <p>Please update your environment variables to use this host.</p>
                    
                    <p>Sent at: ${new Date().toLocaleString()}</p>
                    
                    <p>Sincerely,<br>The Hearthfire Farm Team</p>
                  </div>
                </div>
              `
            });
            
            console.log('Alternative host test email sent successfully!');
            console.log('Message ID:', info.messageId);
            
            return res.status(200).json({ 
              success: true, 
              message: 'Email sent with alternative host',
              note: `Please update your environment variables to use this host: Host=${altConfig.host}, Port=${altConfig.port}, Secure=${altConfig.secure}`,
              suggestedConfig: {
                host: altConfig.host,
                port: altConfig.port,
                secure: altConfig.secure
              }
            });
          } catch (hostError) {
            console.error(`Alternative host ${altHost.host} failed:`, hostError.message);
            // Continue to next host
          }
        }
        
        // Fall back to Ethereal test account
        console.log('Falling back to Ethereal test account...');
        
        try {
          const testAccount = await nodemailer.createTestAccount();
          
          // Create a test transporter
          const etherealTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
          
          console.log('Created Ethereal test account:', testAccount.user);
          
          // Create a mock user
          const mockUser = {
            displayName: 'Test User',
            email: email
          };
          
          // Send a simple test email directly
          const info = await etherealTransporter.sendMail({
            from: `"Hearthfire Test" <${testAccount.user}>`,
            to: email,
            subject: 'Test Email from Hearthfire Farm',
            text: 'This is a test email sent through Ethereal.',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Hearthfire Farm Test Email</h1>
                  <h2 style="color: white; margin: 10px 0 0 0;">Using Ethereal (Test Service)</h2>
                </div>
                
                <div style="padding: 20px;">
                  <p>Dear Test User,</p>
                  
                  <p>This is a test email sent from the Hearthfire Farm website using Ethereal (a test email service).</p>
                  
                  <p><strong>Note:</strong> Your primary email service is not working. The actual connection error was:</p>
                  
                  <div style="background-color: #f8f8f8; padding: 10px; border-left: 4px solid #ff0000; margin: 15px 0;">
                    <code>${verifyError.message}</code>
                  </div>
                  
                  <p>Please check your SMTP settings:</p>
                  <ul>
                    <li>Host: ${config.host}</li>
                    <li>Port: ${config.port}</li>
                    <li>Secure: ${config.secure}</li>
                    <li>Username: ${config.auth.user}</li>
                    <li>Password: Verify it's correct</li>
                  </ul>
                  
                  <p>Common issues include:</p>
                  <ul>
                    <li>Incorrect hostname</li>
                    <li>Wrong port number</li>
                    <li>Incorrect login credentials</li>
                    <li>Firewall blocking SMTP connections</li>
                    <li>Email provider security settings</li>
                  </ul>
                  
                  <p>Recommendations:</p>
                  <ul>
                    <li>Contact your email provider (Spaceship.com) to confirm the correct SMTP settings</li>
                    <li>Ask if they have any specific requirements for SMTP authentication</li>
                    <li>Check if you need to explicitly allow external applications to send email from your account</li>
                  </ul>
                  
                  <p>Sent at: ${new Date().toLocaleString()}</p>
                </div>
              </div>
            `
          });
          
          console.log('Ethereal test email sent successfully!');
          console.log('Message ID:', info.messageId);
          const previewUrl = nodemailer.getTestMessageUrl(info);
          console.log('Preview URL:', previewUrl);
          
          return res.status(200).json({ 
            success: true, 
            message: 'Primary email service failed but Ethereal test successful',
            error: verifyError.message,
            messageId: info.messageId,
            previewUrl: previewUrl,
            troubleshooting: {
              attemptedConfigs: {
                primary: {
                  host: config.host,
                  port: config.port,
                  secure: config.secure
                }
              }
            }
          });
        } catch (etherealError) {
          console.error('Even Ethereal test account failed:', etherealError);
          
          // All approaches failed
          return res.status(500).json({ 
            success: false, 
            error: 'All email service attempts failed',
            details: {
              primary: verifyError.message,
              ethereal: etherealError.message
            }
          });
        }
      } catch (error) {
        console.error('Error while attempting alternative configurations:', error);
        
        // Fall back to Ethereal if everything else failed
        try {
          const testAccount = await nodemailer.createTestAccount();
          console.log('Created Ethereal test account as last resort:', testAccount.user);
          
          return res.status(500).json({
            success: false,
            error: 'All email configurations failed',
            message: 'Please check your email provider settings and credentials',
            etherealAccount: testAccount.user,
            primaryError: verifyError.message
          });
        } catch (finalError) {
          return res.status(500).json({
            success: false,
            error: 'Complete email failure',
            message: 'Unable to connect to any email service, including test services',
            details: finalError.message
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in test-email API endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'An unknown error occurred' 
    });
  }
} 