import React from 'react';

/**
 * PageTitle component for consistent heading styling
 * 
 * @param {object} props Component props
 * @param {string} props.title The title text
 * @param {string} props.className Additional CSS classes
 * @param {string} props.dataSection Optional data attribute for specific section targeting
 * @param {boolean} props.isCeremonyTitle Whether this is a ceremony page title requiring extra styling
 */
const PageTitle = ({ 
  title, 
  className = '', 
  dataSection = '',
  isCeremonyTitle = false 
}) => {
  // Determine which class to use
  const titleClass = isCeremonyTitle 
    ? 'ceremony-integration-title' 
    : 'page-title';

  // Combine classes
  const combinedClasses = `${titleClass} ${className}`.trim();
  
  // Add data attributes if provided
  const dataAttributes = {};
  if (dataSection) {
    dataAttributes['data-sanity-section'] = dataSection;
  }
  
  if (title === 'Post-Ceremony Integration Support') {
    dataAttributes['data-title'] = title;
  }
  
  return (
    <h1 
      className={combinedClasses} 
      {...dataAttributes}
    >
      {title}
    </h1>
  );
};

export default PageTitle; 