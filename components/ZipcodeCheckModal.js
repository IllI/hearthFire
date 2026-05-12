import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// This array should match the VALID_ZIP_CODES from cart.js and other files
const VALID_ZIP_CODES = [
  "30002", "30021", "30030", "30032", "30033", "30034", "30035", "30038",
  "30072", "30079", "30080", "30083", "30084", "30088", "30094", "30228", 
  "30236", "30238", "30250", "30253", "30260", "30273", "30274", "30281", 
  "30288", "30294", "30296", "30297", "30303", "30305", "30306", "30307", 
  "30308", "30309", "30310", "30311", "30312", "30313", "30314", "30315", 
  "30316", "30317", "30318", "30319", "30322", "30324", "30326", "30327", 
  "30328", "30329", "30332", "30334", "30337", "30338", "30339", "30340", 
  "30341", "30342", "30344", "30345", "30346", "30354", "30360", "30363"
];

/**
 * ZipcodeCheckModal - A modal that appears for new users to check if delivery is available in their area
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Function to close the modal
 */
export default function ZipcodeCheckModal({ isOpen, onClose }) {
  const [zipCode, setZipCode] = useState('');
  const [zipCodeChecked, setZipCodeChecked] = useState(false);
  const [zipCodeValid, setZipCodeValid] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);
  const router = useRouter();
  
  // Close modal when ESC key is pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  // Close modal when clicking outside
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };
  
  // Handle ZIP code input change
  const handleZipCodeChange = (e) => {
    const value = e.target.value.trim();
    setZipCode(value);
    
    // Only allow numbers and limit to 5 digits
    if (!/^\d*$/.test(value)) {
      setError('Please enter numbers only');
    } else if (value.length > 5) {
      setError('ZIP code should be 5 digits');
    } else {
      setError('');
    }
    
    // Reset validation state when input changes
    setZipCodeChecked(false);
    setZipCodeValid(false);
  };
  
  // Check if the ZIP code is valid
  const checkZipCode = () => {
    if (zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }
    
    const isValid = VALID_ZIP_CODES.includes(zipCode);
    setZipCodeValid(isValid);
    setZipCodeChecked(true);
    
    // Store the valid ZIP code in localStorage for future use
    if (isValid) {
      try {
        localStorage.setItem('validZipCode', zipCode);
        localStorage.setItem('zipCodeCheckedTime', new Date().toISOString());
      } catch (e) {
        console.error('Error storing ZIP code in localStorage:', e);
      }
    }
  };
  
  // Handle continue to products button
  const handleContinueToProducts = () => {
    onClose();
  };
  
  // Handle redirection to schedule page
  const handleGoToSchedule = () => {
    onClose();
    router.push('/schedule');
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Modal header */}
        <div className="mb-5">
          <h3 className="text-2xl font-semibold text-green-700">Welcome to Hearthfire Farm</h3>
          <p className="text-gray-600 mt-2">We deliver fresh produce to select areas around Atlanta.</p>
          <p className="text-gray-600 mt-1">If we don't deliver to your area, you can still shop with us and pick up your order from one of our <Link href="/schedule" className="text-green-600 hover:text-green-700 underline">pickup locations</Link>.</p>
        </div>
        
        {/* ZIP code check section */}
        <div className="mb-6">
          <label htmlFor="zipcode" className="block text-sm font-medium text-gray-700 mb-2">
            Enter your ZIP code to check if we deliver to your area:
          </label>
          <div className="flex">
            <input
              type="text"
              id="zipcode"
              value={zipCode}
              onChange={handleZipCodeChange}
              placeholder="e.g., 30307"
              className={`border rounded-l px-3 py-2 w-full ${error ? 'border-red-300' : 'border-gray-300'}`}
              maxLength={5}
              disabled={zipCodeValid}
            />
            <button
              onClick={checkZipCode}
              disabled={zipCode.length !== 5 || zipCodeValid}
              className={`px-4 py-2 font-medium rounded-r 
                ${zipCodeValid 
                  ? 'bg-green-600 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 disabled:text-gray-500'}`}
            >
              {zipCodeValid ? 'Valid' : 'Check'}
            </button>
          </div>
          
          {/* Show validation message */}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          
          {zipCodeChecked && (
            <p className={`mt-2 text-sm ${zipCodeValid ? 'text-green-600' : 'text-red-600'}`}>
              {zipCodeValid 
                ? "Great news! We deliver to your area." 
                : "Sorry, we don't currently deliver to your area."}
            </p>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col space-y-3">
          {zipCodeValid ? (
            <button
              onClick={handleContinueToProducts}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded"
            >
              Continue to Products
            </button>
          ) : zipCodeChecked ? (
            <>
              <p className="text-sm text-gray-600">
                You can still shop with us! Check our pickup locations instead:
              </p>
              <button
                onClick={handleGoToSchedule}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded"
              >
                View Pickup Locations
              </button>
              <button
                onClick={handleContinueToProducts}
                className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded"
              >
                Continue to Products Anyway
              </button>
            </>
          ) : (
            <button
              onClick={handleContinueToProducts}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded"
            >
              Continue Without Checking
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 