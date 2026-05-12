import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/AboutEditor.module.css';

export default function Home({ initialContent }) {
  const [homeContent, setHomeContent] = useState(initialContent || {
    title: 'Fresh from Hearthfire Farm to Your Door',
    subtitle: 'Order fresh, organic produce from our hearth to your home.',
    mainImage: null,
    ctaButton: {
      text: 'Browse Produce',
      link: '/products'
    },
    sections: []
  });
  const [loading, setLoading] = useState(!initialContent);

  // Always fetch content client-side to ensure latest content
  useEffect(() => {
    async function fetchHomeContent() {
      try {
        setLoading(true);
        console.log('Fetching homepage content client-side...');
        const response = await fetch('/api/content/home');
        
        if (response.ok) {
          const data = await response.json();
          console.log('Home content API response:', data);
          if (data.success && data.content) {
            console.log('Setting home content with:', data.content);
            setHomeContent(data.content);
          } else {
            console.warn('API returned success: false or no content. Using default content');
            console.warn('API response:', data);
          }
        } else {
          console.error('Failed to fetch home content, status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
        }
      } catch (err) {
        console.error('Error fetching home content:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHomeContent();
  }, []);

  return (
    <>
      <Head>
        <title>Hearthfire Farm - Fresh Organic Produce Delivery</title>
        <meta name="description" content="Order fresh, organic produce direct from our farm to your door. Local delivery and pickup options available." />
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl mb-6">
          {homeContent.mainImage ? (
            <div className="h-64 sm:h-80 md:h-96 relative">
              <img 
                src={homeContent.mainImage}
                alt="Hearthfire Farm"
                className="w-full h-full object-contain sm:object-cover rounded-xl"
              />
            </div>
          ) : (
            <div className="bg-green-100 p-8 rounded-lg text-center">
              {/* Fallback content without CTA button */}
              <h2 className="text-2xl font-bold text-green-700 mb-2">
                Welcome to Hearthfire Farm
              </h2>
            </div>
          )}
        </div>
        
        {/* Title and Subtitle Section - moved below the hero image */}
        {(homeContent.title || homeContent.subtitle) && (
          <div className="text-center mb-12">
            {homeContent.title && (
              <h1 className="text-4xl md:text-5xl font-bold text-green-700 mb-4">
                {homeContent.title}
              </h1>
            )}
            {homeContent.subtitle && (
              <p className="text-xl text-gray-700 mb-6 max-w-2xl mx-auto">
                {homeContent.subtitle}
              </p>
            )}
            
            {/* Call to action button moved here */}
            <div className="mt-4 px-4 sm:px-0">
              <Link 
                href={homeContent.ctaButton?.link || "/schedule"}
                className="bg-green-600 text-white px-4 sm:px-8 py-3 rounded-lg hover:bg-green-700 text-base sm:text-lg font-medium transition-colors shadow-md inline-block max-w-full whitespace-normal text-center"
              >
                {homeContent.ctaButton?.text || "Check to see if we deliver to your area!"}
              </Link>
            </div>
          </div>
        )}

        {/* Content Sections */}
        {homeContent.sections && homeContent.sections.length > 0 && (
          <div className="space-y-16 mb-12">
            {homeContent.sections.map((section, index) => (
              <div 
                key={`section-${index}`} 
                className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8`}
              >
                {section.image && (
                  <div className="md:w-1/2">
                    <div className="rounded-lg overflow-hidden h-full">
                      <img 
                        src={section.image}
                        alt={section.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                <div className={`${section.image ? 'md:w-1/2' : 'w-full'} flex flex-col justify-center`}>
                  <h2 className="text-2xl md:text-3xl font-bold text-green-700 mb-4">
                    {section.title}
                  </h2>
                  <div 
                    className={styles.previewContent} 
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                  {section.button && section.button.text && (
                    <Link 
                      href={section.button.link || '#'} 
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 inline-block self-start mt-4"
                    >
                      {section.button.text}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Fallback if no sections defined */}
        {(!homeContent.sections || homeContent.sections.length === 0) && !loading && (
          <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-12">
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              About Our Farm
            </h2>
            <p className="text-gray-700 mb-6">
              At Hearthfire Farm, we grow the freshest organic vegetables, fruits, and herbs using sustainable farming practices. 
              Our mission is to provide healthy, nutritious food while protecting the environment and supporting our local community.
            </p>
            <Link
              href="/about" 
              className="text-green-600 font-medium hover:text-green-800"
            >
              Learn more about us →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// Use getStaticProps instead of getServerSideProps for next export compatibility
export function getStaticProps() {
  return {
    props: {
      initialContent: {
        title: 'Welcome to Hearthfire Farm',
        subtitle: "Georgia's Premiere Local Farm and Nursery",
        ctaButton: {
          text: 'Check to see if we deliver to your area!',
          link: '/schedule'
        },
        sections: []
      }
    }
  };
} 