import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/AboutEditor.module.css'; // Import the same styles used in the admin editor

export default function About() {
  const [aboutContent, setAboutContent] = useState({
    title: 'About Hearthfire Farm',
    content: 'Loading content...',
    heroImage: '/images/default-about-hero.jpg'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch about page content from Firestore
  useEffect(() => {
    async function fetchAboutContent() {
      try {
        setLoading(true);
        const response = await fetch('/api/content/about');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch about content: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.content) {
          setAboutContent(data.content);
        } else {
          console.warn('Using default about content');
        }
      } catch (err) {
        console.error('Error fetching about content:', err);
        setError('Failed to load about page content.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAboutContent();
  }, []);

  return (
    <>
      <Head>
        <title>{aboutContent.title || 'About Us'} - Hearthfire Farm</title>
        <meta name="description" content="Learn more about our mission, values, and sustainable farming practices." />
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-6">
          {aboutContent.heroImage && (
            <img 
              src={aboutContent.heroImage} 
              alt={aboutContent.title || 'About Hearthfire Farm'}
              className="w-full h-full object-contain sm:object-cover rounded-xl"
            />
          )}
        </div>

        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-green-700 mb-4">
            {aboutContent.title || 'About Hearthfire Farm'}
          </h1>
        </div>
        
        {/* Main Content */}
        <div className="bg-white rounded-lg p-6 md:p-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <p className="mt-4">
                We're experiencing technical difficulties loading our about page content.
                Please check back later.
              </p>
            </div>
          ) : (
            // Apply the same styles from the admin editor
            <div className={styles.previewContent}>
              <div dangerouslySetInnerHTML={{ __html: aboutContent.content }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
} 