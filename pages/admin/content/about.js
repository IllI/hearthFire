import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminRoute from '../../../components/AdminRoute';
import AdminNavigation from '../../../components/AdminNavigation';
import { useAuth } from '../../../contexts/AuthContext';
import Head from 'next/head';
import Link from 'next/link';
import RichTextEditor from '../../../components/RichTextEditor';
import MediaLibrary from '../../../components/MediaLibrary';
import Image from 'next/image';
import ContentImagePreview from '../../../components/ContentImagePreview';
import styles from '../../../styles/AboutEditor.module.css';

export default function AboutPageEditor() {
  return (
    <AdminRoute>
      <EditorContent />
    </AdminRoute>
  );
}

function EditorContent() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [aboutContent, setAboutContent] = useState({
    title: '',
    content: '',
    heroImage: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaTarget, setMediaTarget] = useState(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(null);

  // Fetch current about page content
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
          setPreviewHtml(data.content.content || '');
        }
      } catch (err) {
        console.error('Error fetching about content:', err);
        setError('Failed to load about page content. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAboutContent();
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAboutContent(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle hero image selection from media library
  const handleHeroImageSelect = (fileUrl) => {
    // The MediaLibrary returns a direct URL string, not an object with path
    setAboutContent(prev => ({
      ...prev,
      heroImage: fileUrl
    }));
    setShowMediaLibrary(false);
  };

  // Handle rich text editor content change
  const handleContentChange = (html) => {
    setAboutContent(prev => ({
      ...prev,
      content: html
    }));
    setPreviewHtml(html);
  };

  // Toggle content preview
  const togglePreview = () => {
    setIsPreviewOpen(!isPreviewOpen);
  };

  // Handle opening media library for hero image
  const handleOpenHeroMediaLibrary = () => {
    setShowMediaLibrary(true);
  };

  // Handle direct upload
  const handleDirectUpload = (imageUrl) => {
    if (mediaTarget === 'hero') {
      setAboutContent(prev => ({
        ...prev,
        heroImage: imageUrl
      }));
    } else if (mediaTarget === 'section' && activeSectionIndex !== null) {
      const updatedSections = [...aboutContent.sections];
      updatedSections[activeSectionIndex] = {
        ...updatedSections[activeSectionIndex],
        image: imageUrl
      };
      
      setAboutContent(prev => ({
        ...prev,
        sections: updatedSections
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setSaveSuccess(false);
      setError(null);
      
      // Get token
      const token = await currentUser.getIdToken();
      
      // Save content to Firestore
      const response = await fetch('/api/content/update-about', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(aboutContent)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save content');
      }
      
      setSaveSuccess(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving about content:', err);
      setError(err.message || 'Failed to save content. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Edit About Page - Admin Dashboard</title>
      </Head>
      
      <AdminNavigation />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit About Page</h1>
          <div className="flex space-x-3">
            <Link 
              href="/admin/content"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Content
            </Link>
            <Link 
              href="/about" 
              target="_blank"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Preview
            </Link>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {saveSuccess && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">About page content saved successfully!</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow-md rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label htmlFor="title" className="block text-base font-medium text-gray-700 mb-2">
                    Page Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={aboutContent.title}
                    onChange={handleInputChange}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm text-base border-gray-300 rounded-md py-2 px-3"
                    required
                    placeholder="Enter page title"
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Hero Image
                  </label>
                  <ContentImagePreview 
                    src={aboutContent.heroImage}
                    alt="Hero image"
                    onChangeImage={handleOpenHeroMediaLibrary}
                    onDirectUpload={handleDirectUpload}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-base font-medium text-gray-700">
                    Page Content
                  </label>
                  <button
                    type="button"
                    onClick={togglePreview}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    {isPreviewOpen ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                
                <RichTextEditor 
                  content={aboutContent.content}
                  onChange={handleContentChange}
                  placeholder="Enter your about page content here..."
                />
                
                {isPreviewOpen && (
                  <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden shadow-md">
                    <h3 className="text-lg font-medium text-gray-700 p-4 bg-gray-50 border-b border-gray-200">Page Preview</h3>
                    
                    {/* Hero Image Preview */}
                    <div className="relative h-48 w-full">
                      {aboutContent.heroImage ? (
                        <div className="relative w-full h-full bg-gray-100">
                          <Image
                            src={aboutContent.heroImage}
                            alt={aboutContent.title || 'About Hearthfire Farm'}
                            layout="fill"
                            objectFit="cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                            <h1 className="text-3xl font-bold text-white text-center">
                              {aboutContent.title || 'About Hearthfire Farm'}
                            </h1>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <p className="text-gray-500 text-center">No hero image selected</p>
                          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                            <h1 className="text-3xl font-bold text-white text-center">
                              {aboutContent.title || 'About Hearthfire Farm'}
                            </h1>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Content Preview */}
                    <div className="bg-white p-6">
                      <div className="prose prose-green max-w-none">
                        <div 
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                          className={styles.previewContent}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      {showMediaLibrary && (
        <MediaLibrary 
          onSelect={handleHeroImageSelect}
          onClose={() => setShowMediaLibrary(false)}
        />
      )}
    </>
  );
} 