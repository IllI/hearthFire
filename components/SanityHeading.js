import React from 'react';

/**
 * SanityHeading - A component to style headings from Sanity CMS
 * This ensures consistent styling for headings coming from Sanity
 * even when direct styling isn't available.
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children The heading content
 * @param {string} props.level The heading level (h1, h2, etc.)
 * @param {string} props.className Additional class names
 * @param {string} props.type Optional heading type (e.g., 'ceremony')
 * @param {Object} props.style Additional inline styles
 */
const SanityHeading = ({ 
  children, 
  level = 'h1',
  className = '',
  type = '',
  style = {}
}) => {
  // Add specific classes based on content
  const isCeremonyTitle = 
    typeof children === 'string' && 
    (children.includes('Post-Ceremony') || 
     children.includes('Ceremony is a beginning') ||
     children.includes('Integration Support'));
  
  // Enhanced class names for specific heading types
  const enhancedClass = `sanity-heading ${className} ${isCeremonyTitle ? 'ceremony-title' : ''} ${type ? `${type}-title` : ''}`.trim();
  
  // Enhanced styles for specific heading types
  const enhancedStyle = {
    ...style,
    ...(isCeremonyTitle ? { 
      fontSize: '3rem',
      lineHeight: '1.2',
      fontWeight: 500,
      marginBottom: '1.5rem',
      textAlign: 'center'
    } : {})
  };
  
  // Add data attributes for CSS targeting
  const dataAttributes = {};
  if (typeof children === 'string') {
    dataAttributes['data-content'] = children;
    
    if (children === 'Post-Ceremony Integration Support') {
      dataAttributes['data-title'] = 'Post-Ceremony Integration Support';
    }
    
    if (children === 'Ceremony is a beginning...') {
      dataAttributes['data-title'] = 'Ceremony is a beginning';
    }
  }
  
  if (type) {
    dataAttributes['data-type'] = type;
  }
  
  // Render the appropriate heading element
  const HeadingTag = level;
  
  return (
    <HeadingTag 
      className={enhancedClass}
      style={enhancedStyle}
      {...dataAttributes}
    >
      {children}
    </HeadingTag>
  );
};

export default SanityHeading; 