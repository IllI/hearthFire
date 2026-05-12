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

export default function HomePageEditor() {
  return (
    <AdminRoute>
      <EditorContent />
    </AdminRoute>
  );
}

// Section editor component
function SectionEditor({ section, index, onChange, onDelete }) {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const { currentUser } = useAuth();
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange(index, { ...section, [name]: value });
  };

  const handleContentChange = (html) => {
    onChange(index, { ...section, content: html });
  };

  const handleButtonChange = (e) => {
    const { name, value } = e.target;
    onChange(index, { 
      ...section, 
      button: { 
        ...section.button,
        [name.replace('button_', '')]: value 
      } 
    });
  };

  const handleImageSelect = (imageUrl) => {
    onChange(index, { ...section, image: imageUrl });
    setShowMediaLibrary(false);
  };
  
  // Handle opening the media library
  const handleOpenMediaLibrary = () => {
    setShowMediaLibrary(true);
  };

  return (
    <div className="border border-gray-200 rounded-md p-4 mb-4 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Section {index + 1}</h3>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor={`title_${index}`} className="block text-sm font-medium text-gray-700 mb-1">
            Section Title
          </label>
          <input
            type="text"
            id={`title_${index}`}
            name="title"
            value={section.title}
            onChange={handleChange}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            required
          />
        </div>
        
        <div>
          <label htmlFor={`content_${index}`} className="block text-sm font-medium text-gray-700 mb-1">
            Section Content
          </label>
          <RichTextEditor
            content={section.content}
            onChange={handleContentChange}
            placeholder="Add content for this section..."
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section Image
          </label>
          <ContentImagePreview 
            src={section.image} 
            alt={`Section ${index + 1} image`}
            onChangeImage={handleOpenMediaLibrary}
            onDirectUpload={(imageUrl) => handleImageSelect(imageUrl)}
          />
          
          {showMediaLibrary && (
            <MediaLibrary
              onSelect={handleImageSelect}
              onClose={() => setShowMediaLibrary(false)}
            />
          )}
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Section Button (Optional)</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`button_text_${index}`} className="block text-sm text-gray-700 mb-1">
                Button Text
              </label>
              <input
                type="text"
                id={`button_text_${index}`}
                name="button_text"
                value={section.button?.text || ''}
                onChange={handleButtonChange}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label htmlFor={`button_link_${index}`} className="block text-sm text-gray-700 mb-1">
                Button Link
              </label>
              <input
                type="text"
                id={`button_link_${index}`}
                name="button_link"
                value={section.button?.link || ''}
                onChange={handleButtonChange}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorContent() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [homeContent, setHomeContent] = useState({
    title: '',
    subtitle: '',
    mainImage: '',
    ctaButton: {
      text: 'Browse Produce',
      link: '/products'
    },
    sections: []
  });
  const [originalContent, setOriginalContent] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaTarget, setMediaTarget] = useState(null);
  const [activeMediaSection, setActiveMediaSection] = useState(null);

  // Fetch current home page content
  useEffect(() => {
    async function fetchHomeContent() {
      try {
        setLoading(true);
        const response = await fetch('/api/content/home');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch home content: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.content) {
          setHomeContent(data.content);
          setOriginalContent(JSON.stringify(data.content));
        }
      } catch (err) {
        console.error('Error fetching home content:', err);
        setError('Failed to load home page content. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHomeContent();
  }, []);

  // Check for changes whenever homeContent updates
  useEffect(() => {
    if (originalContent) {
      try {
        const parsedOriginal = JSON.parse(originalContent);
        const currentContentStr = JSON.stringify(homeContent);
        const hasContentChanged = currentContentStr !== JSON.stringify(parsedOriginal);
        setHasChanges(hasContentChanged);
      } catch (err) {
        console.error('Error comparing content:', err);
        setHasChanges(false);
      }
    }
  }, [homeContent, originalContent]);

  // Handle input changes for main fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setHomeContent(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle hero image selection from media library
  const handleHeroImageSelect = (fileUrl) => {
    setHomeContent(prev => ({
      ...prev,
      mainImage: fileUrl
    }));
    setShowMediaLibrary(false);
    setMediaTarget(null);
  };
  
  // Handle opening the media library for hero image
  const handleOpenHeroMediaLibrary = () => {
    setMediaTarget('hero');
    setShowMediaLibrary(true);
  };

  // Handle CTA button changes
  const handleCtaButtonChange = (e) => {
    const { name, value } = e.target;
    setHomeContent(prev => ({
      ...prev,
      ctaButton: {
        ...prev.ctaButton,
        [name.replace('ctaButton_', '')]: value
      }
    }));
  };

  // Handle section changes (including showing media library)
  const handleSectionChange = (index, updatedSection) => {
    // If we're opening the media library, set state accordingly
    if (updatedSection._openMediaLibrary) {
      delete updatedSection._openMediaLibrary;
      
      setHomeContent(prev => ({
        ...prev,
        sections: prev.sections.map((s, i) => 
          i === index ? updatedSection : s
        )
      }));
      
      setMediaTarget('section');
      setActiveMediaSection(index);
      setShowMediaLibrary(true);
    } else {
      // Regular section update
      setHomeContent(prev => ({
        ...prev,
        sections: prev.sections.map((s, i) => 
          i === index ? updatedSection : s
        )
      }));
    }
  };

  // Add a new section
  const addSection = () => {
    const newSection = {
      title: 'New Section',
      content: '<p>Enter your content here.</p>',
      image: '',
      button: {
        text: '',
        link: ''
      }
    };
    
    setHomeContent(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  // Delete a section
  const deleteSection = (index) => {
    const updatedSections = [...homeContent.sections];
    updatedSections.splice(index, 1);
    
    setHomeContent(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  // Remove any error warnings about title/subtitle being required
  const validateForm = () => {
    // All fields are optional now
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSaving(true);
      setSaveSuccess(false);
      setError(null);
      
      // Get token
      const token = await currentUser.getIdToken();
      
      // Save content to Firestore
      const response = await fetch('/api/content/update-home', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(homeContent)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save content');
      }
      
      // Update original content with a fresh copy of the current content
      const freshContentCopy = JSON.stringify(JSON.parse(JSON.stringify(homeContent)));
      setOriginalContent(freshContentCopy);
      
      setSaveSuccess(true);
      setHasChanges(false);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving home content:', err);
      setError(err.message || 'Failed to save content. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Inside EditorContent component where the media library is used
  const handleDirectUpload = (imageUrl) => {
    if (mediaTarget === 'hero') {
      handleHeroImageSelect(imageUrl);
    } else if (mediaTarget === 'section' && activeMediaSection !== null) {
      handleSectionChange(
        activeMediaSection,
        {
          ...homeContent.sections[activeMediaSection],
          image: imageUrl
        }
      );
    }
  };

  return (
    <>
      <Head>
        <title>Edit Home Page - Admin Dashboard</title>
      </Head>
      
      <AdminNavigation />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Home Page</h1>
          <div className="flex space-x-3">
            {saveSuccess && (
              <div className="bg-green-100 text-green-800 px-3 py-2 rounded-md text-sm flex items-center">
                <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Saved!
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !hasChanges || loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                hasChanges && !saving ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300 cursor-not-allowed'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link 
              href="/admin/content"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Content
            </Link>
            <Link 
              href="/" 
              target="_blank"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Preview
            </Link>
          </div>
        </div>
        
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
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Main Content Section */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h2 className="text-xl font-medium text-gray-900 mb-4">Main Content</h2>
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Page Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={homeContent.title}
                    onChange={handleInputChange}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                
                <div>
                  <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    id="subtitle"
                    name="subtitle"
                    value={homeContent.subtitle}
                    onChange={handleInputChange}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Main Hero Image
                  </label>
                  <ContentImagePreview 
                    src={homeContent.mainImage}
                    alt="Main hero image"
                    onChangeImage={handleOpenHeroMediaLibrary}
                    onDirectUpload={handleDirectUpload}
                  />
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-md font-medium text-gray-700 mb-2">Call-to-Action Button</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ctaButton_text" className="block text-sm text-gray-700 mb-1">
                        Button Text
                      </label>
                      <input
                        type="text"
                        id="ctaButton_text"
                        name="ctaButton_text"
                        value={homeContent.ctaButton?.text || ''}
                        onChange={handleCtaButtonChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="ctaButton_link" className="block text-sm text-gray-700 mb-1">
                        Button Link
                      </label>
                      <input
                        type="text"
                        id="ctaButton_link"
                        name="ctaButton_link"
                        value={homeContent.ctaButton?.link || ''}
                        onChange={handleCtaButtonChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content Sections */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-medium text-gray-900">Content Sections</h2>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  Add Section
                </button>
              </div>
              
              <div className="space-y-4">
                {homeContent.sections.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No content sections yet. Click "Add Section" to create one.
                  </p>
                ) : (
                  homeContent.sections.map((section, index) => (
                    <SectionEditor
                      key={index}
                      section={section}
                      index={index}
                      onChange={handleSectionChange}
                      onDelete={deleteSection}
                    />
                  ))
                )}
              </div>
            </div>
          </form>
        )}
      </div>

      {showMediaLibrary && (
        <MediaLibrary 
          onSelect={handleDirectUpload}
          onClose={() => {
            setShowMediaLibrary(false);
            setMediaTarget(null);
            setActiveMediaSection(null);
          }}
        />
      )}
    </>
  );
} 