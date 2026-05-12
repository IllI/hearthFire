import { useState } from 'react';
import Layout from '../../components/Layout';

export default function DirectEmailTest() {
  const [email, setEmail] = useState('cityzenill@gmail.com');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/direct-email-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else if (response.status === 207) {
        // Partial success (primary failed, fallback worked)
        setResult(data);
        setError(data.primaryError);
      } else {
        setError(data.error || 'An unknown error occurred');
      }
    } catch (err) {
      setError(err.message || 'Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-8">Direct Email Test</h1>
        <p className="mb-6 text-gray-700">
          This page tests direct email connectivity with the SMTP server, bypassing most of the application logic.
          It will output detailed diagnostic information to help troubleshoot email issues.
        </p>

        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <form onSubmit={handleSendEmail}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                Recipient Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-2 border rounded-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send Test Email'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className={`bg-${result.fallbackSuccess ? 'yellow' : 'green'}-100 border-l-4 border-${result.fallbackSuccess ? 'yellow' : 'green'}-500 p-4 mb-6`}>
            <p className="font-bold">Result</p>
            <pre className="whitespace-pre-wrap text-sm mt-2 bg-gray-100 p-3 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
            
            {result.previewUrl && (
              <div className="mt-4">
                <p className="font-bold">Preview URL (Ethereal):</p>
                <a 
                  href={result.previewUrl} 
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {result.previewUrl}
                </a>
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-100 p-4 rounded-lg mt-8">
          <h2 className="text-xl font-bold mb-3">Important Notes</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>This test bypasses most of the application email logic for direct SMTP testing</li>
            <li>Check the browser console and server logs for detailed information</li>
            <li>If direct sending fails, the test will attempt to use Ethereal (test service)</li>
            <li>Ethereal emails can be viewed using the preview URL but are not actually delivered</li>
            <li><strong>Current sender</strong>: {process.env.EMAIL_USER || 'info@hearthfirefarm.com'}</li>
            <li><strong>SMTP server</strong>: {process.env.EMAIL_HOST || '208.91.199.223'}</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
} 