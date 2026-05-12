import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

export default function TestEmail() {
  const router = useRouter();
  const [email, setEmail] = useState('cityzenill@gmail.com');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '',
    secure: false,
    user: '',
    password: ''
  });

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email,
          useCustomSettings: showAdvanced && 
            (smtpSettings.host || smtpSettings.port || smtpSettings.user || smtpSettings.password),
          smtpSettings: showAdvanced ? smtpSettings : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'An unknown error occurred');
        if (data.details) {
          console.error('Error details:', data.details);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to send request');
      console.error('Request error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSmtpSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSmtpSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Email Service Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSendTestEmail}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" htmlFor="email">
                Recipient Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div className="mb-6">
              <button 
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-green-600 hover:text-green-800 flex items-center"
              >
                {showAdvanced ? '- Hide' : '+ Show'} Advanced Settings
              </button>
            </div>

            {showAdvanced && (
              <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                <h3 className="font-medium mb-3">Custom SMTP Settings (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Leave fields empty to use the default settings from your environment variables.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="smtp-host">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      id="smtp-host"
                      name="host"
                      value={smtpSettings.host}
                      onChange={handleSmtpSettingsChange}
                      placeholder="e.g., mail.spaceship.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="smtp-port">
                      SMTP Port
                    </label>
                    <input
                      type="text"
                      id="smtp-port"
                      name="port"
                      value={smtpSettings.port}
                      onChange={handleSmtpSettingsChange}
                      placeholder="e.g., 587"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="smtp-user">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      id="smtp-user"
                      name="user"
                      value={smtpSettings.user}
                      onChange={handleSmtpSettingsChange}
                      placeholder="e.g., info@hearthfirefarm.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="smtp-password">
                      SMTP Password
                    </label>
                    <input
                      type="password"
                      id="smtp-password"
                      name="password"
                      value={smtpSettings.password}
                      onChange={handleSmtpSettingsChange}
                      placeholder="SMTP Password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 flex items-center">
                    <input
                      type="checkbox"
                      id="smtp-secure"
                      name="secure"
                      checked={smtpSettings.secure}
                      onChange={handleSmtpSettingsChange}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm" htmlFor="smtp-secure">
                      Use SSL/TLS (Secure)
                    </label>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 focus:ring-green-500 focus:ring-offset-green-200 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md"
            >
              {sending ? 'Sending...' : 'Send Test Email'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-8 p-4 border border-red-200 bg-red-50 rounded-md">
            <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
            <p className="text-red-700">{error}</p>
            
            {result && result.details && (
              <div className="mt-4 text-sm">
                <h4 className="font-medium text-red-800 mb-1">Detailed Error Information:</h4>
                <pre className="bg-white p-3 rounded overflow-x-auto">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {result && result.success && (
          <div className="mb-8 p-4 border border-green-200 bg-green-50 rounded-md">
            <h3 className="text-lg font-medium text-green-800 mb-2">Success</h3>
            <p className="text-green-700 mb-3">{result.message}</p>
            
            {result.messageId && (
              <p className="text-sm mb-1">
                <span className="font-medium">Message ID:</span> {result.messageId}
              </p>
            )}
            
            {result.previewUrl && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">
                  This test email was sent using Ethereal, a test email service.
                  You can view it here:
                </p>
                <a 
                  href={result.previewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View Test Email
                </a>
              </div>
            )}
            
            {result.note && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">Note:</span> {result.note}
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="bg-blue-50 p-4 border border-blue-200 rounded-md">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Important Notes</h3>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            <li>This page is for testing the email service configuration.</li>
            <li>Emails will be sent from <code className="bg-blue-100 px-1 py-0.5 rounded">info@hearthfirefarm.com</code></li>
            <li>
              Make sure your SMTP settings are correctly configured in your <code className="bg-blue-100 px-1 py-0.5 rounded">.env.local</code> file
              or environment variables.
            </li>
            <li>
              For Spaceship SMTP, typical settings are:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Host: mail.spaceship.com</li>
                <li>Port: 587 (or 465 with SSL)</li>
                <li>Security: STARTTLS (or SSL)</li>
              </ul>
            </li>
            <li>
              In development mode, if email sending fails, the system will attempt to use 
              Ethereal (a test email service) as a fallback.
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
} 