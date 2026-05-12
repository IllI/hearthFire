import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminRoute from '../../../components/AdminRoute';
import AdminNavigation from '../../../components/AdminNavigation';
import { useAuth } from '../../../contexts/AuthContext';
import Head from 'next/head';

export default function PromotionsManagement() {
  return (
    <AdminRoute>
      <PromotionsContent />
    </AdminRoute>
  );
}

// Format date for display
function formatDate(date) {
  if (!date) return 'No expiration';
  
  if (typeof date === 'object' && date.seconds) {
    date = new Date(date.seconds * 1000);
  } else if (typeof date === 'string') {
    date = new Date(date);
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function PromotionsContent() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPromotion, setCurrentPromotion] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    type: 'fixed',
    value: '',
    description: '',
    active: true,
    expiryDate: ''
  });
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  useEffect(() => {
    loadPromotions();
  }, []);
  
  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get token
      let token = 'dev-token';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      
      const response = await fetch('/api/promotions', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load promotions');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Sort promotions with active ones first, then by code
        const sortedPromotions = data.promotions.sort((a, b) => {
          if (a.active !== b.active) {
            return a.active ? -1 : 1;
          }
          return a.code.localeCompare(b.code);
        });
        
        setPromotions(sortedPromotions);
      } else {
        throw new Error(data.error || 'Failed to load promotions');
      }
    } catch (err) {
      console.error('Error loading promotions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const resetForm = () => {
    setFormData({
      code: '',
      type: 'fixed',
      value: '',
      description: '',
      active: true,
      expiryDate: ''
    });
    setFormError(null);
  };
  
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const openEditModal = (promotion) => {
    const expiryDate = promotion.expiryDate ? 
      (typeof promotion.expiryDate === 'object' && promotion.expiryDate.toDate ? 
        promotion.expiryDate.toDate().toISOString().split('T')[0] :
        new Date(promotion.expiryDate).toISOString().split('T')[0]) : 
      '';
    
    setFormData({
      code: promotion.code,
      type: promotion.type,
      value: promotion.value,
      description: promotion.description,
      active: promotion.active !== false,
      expiryDate
    });
    
    setCurrentPromotion(promotion);
    setShowEditModal(true);
  };
  
  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    
    try {
      if (!formData.code || !formData.type || !formData.description) {
        setFormError('Please fill all required fields');
        return;
      }
      
      // Only require value for non-shipping types
      if (formData.type !== 'shipping' && !formData.value) {
        setFormError('Please enter a value for the discount');
        return;
      }
      
      // Get token
      let token = 'dev-token';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      
      const response = await fetch('/api/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`Promotion code ${formData.code} created successfully`);
        resetForm();
        setShowAddModal(false);
        loadPromotions();
      } else {
        setFormError(data.error || 'Failed to create promotion');
      }
    } catch (err) {
      console.error('Error creating promotion:', err);
      setFormError(err.message);
    }
  };
  
  const handleUpdatePromotion = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    
    try {
      if (!formData.type || !formData.description) {
        setFormError('Please fill all required fields');
        return;
      }
      
      // Only require value for non-shipping types
      if (formData.type !== 'shipping' && !formData.value) {
        setFormError('Please enter a value for the discount');
        return;
      }
      
      // Get token
      let token = 'dev-token';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      
      const response = await fetch(`/api/promotions/${currentPromotion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`Promotion code ${currentPromotion.code} updated successfully`);
        resetForm();
        setShowEditModal(false);
        loadPromotions();
      } else {
        setFormError(data.error || 'Failed to update promotion');
      }
    } catch (err) {
      console.error('Error updating promotion:', err);
      setFormError(err.message);
    }
  };
  
  const handleDeletePromotion = async (promotionId, promotionCode) => {
    if (!confirm(`Are you sure you want to delete the promotion code ${promotionCode}?`)) {
      return;
    }
    
    try {
      // Get token
      let token = 'dev-token';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      
      const response = await fetch(`/api/promotions/${promotionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`Promotion code ${promotionCode} deleted successfully`);
        loadPromotions();
      } else {
        setError(data.error || 'Failed to delete promotion');
      }
    } catch (err) {
      console.error('Error deleting promotion:', err);
      setError(err.message);
    }
  };
  
  return (
    <>
      <Head>
        <title>Promotions Management - Admin Dashboard</title>
      </Head>
      
      <AdminNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Promotions Management</h1>
          <button
            onClick={openAddModal}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add New Promotion
          </button>
        </div>
        
        {successMessage && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
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
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : promotions.length === 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center">
            <p className="text-gray-500">No promotions found. Create your first promotion using the "Add New Promotion" button.</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type & Value
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promotions.map((promotion) => (
                  <tr key={promotion.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{promotion.code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {promotion.type === 'fixed' && `$${promotion.value.toFixed(2)} off`}
                        {promotion.type === 'percentage' && `${promotion.value}% off`}
                        {promotion.type === 'shipping' && 'Free delivery'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{promotion.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${promotion.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {promotion.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(promotion.expiryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(promotion)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePromotion(promotion.id, promotion.code)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Add Promotion Modal */}
      {showAddModal && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowAddModal(false)}></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreatePromotion}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New Promotion</h3>
                  
                  {formError && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{formError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                        Promo Code *
                      </label>
                      <input
                        type="text"
                        id="code"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md uppercase"
                        placeholder="SUMMER25"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">Must be unique and will be converted to uppercase</p>
                    </div>
                    
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Type *
                      </label>
                      <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="fixed">Fixed Amount ($)</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="shipping">Free Delivery</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">
                        Value *
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          {formData.type === 'fixed' && <span className="text-gray-500 sm:text-sm">$</span>}
                        </div>
                        <input
                          type="number"
                          id="value"
                          name="value"
                          value={formData.value}
                          onChange={handleInputChange}
                          className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md ${formData.type === 'fixed' ? 'pl-7' : ''}`}
                          placeholder={formData.type === 'percentage' ? '25' : '10.00'}
                          min="0"
                          step={formData.type === 'percentage' ? '1' : '0.01'}
                          required={formData.type !== 'shipping'}
                          disabled={formData.type === 'shipping'}
                        />
                        {formData.type === 'percentage' && <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">%</span>
                        </div>}
                      </div>
                      {formData.type === 'shipping' && <p className="mt-1 text-xs text-gray-500">Delivery promotions automatically waive the delivery fee</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="Summer sale discount"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">This will be displayed to the customer</p>
                    </div>
                    
                    <div>
                      <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        id="expiryDate"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                      <p className="mt-1 text-xs text-gray-500">Leave blank for no expiration</p>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="active"
                        name="active"
                        type="checkbox"
                        checked={formData.active}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                        Active
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Create Promotion
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Promotion Modal */}
      {showEditModal && currentPromotion && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowEditModal(false)}></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdatePromotion}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit Promotion: {currentPromotion.code}</h3>
                  
                  {formError && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{formError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="edit-code" className="block text-sm font-medium text-gray-700 mb-1">
                        Promo Code
                      </label>
                      <input
                        type="text"
                        id="edit-code"
                        name="code"
                        value={formData.code}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-100"
                        disabled
                      />
                      <p className="mt-1 text-xs text-gray-500">Promo codes cannot be changed once created</p>
                    </div>
                    
                    <div>
                      <label htmlFor="edit-type" className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Type *
                      </label>
                      <select
                        id="edit-type"
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="fixed">Fixed Amount ($)</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="shipping">Free Delivery</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="edit-value" className="block text-sm font-medium text-gray-700 mb-1">
                        Value *
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          {formData.type === 'fixed' && <span className="text-gray-500 sm:text-sm">$</span>}
                        </div>
                        <input
                          type="number"
                          id="edit-value"
                          name="value"
                          value={formData.value}
                          onChange={handleInputChange}
                          className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md ${formData.type === 'fixed' ? 'pl-7' : ''}`}
                          placeholder={formData.type === 'percentage' ? '25' : '10.00'}
                          min="0"
                          step={formData.type === 'percentage' ? '1' : '0.01'}
                          required={formData.type !== 'shipping'}
                          disabled={formData.type === 'shipping'}
                        />
                        {formData.type === 'percentage' && <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">%</span>
                        </div>}
                      </div>
                      {formData.type === 'shipping' && <p className="mt-1 text-xs text-gray-500">Delivery promotions automatically waive the delivery fee</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        id="edit-description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="Summer sale discount"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">This will be displayed to the customer</p>
                    </div>
                    
                    <div>
                      <label htmlFor="edit-expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        id="edit-expiryDate"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full py-2 px-3 shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                      <p className="mt-1 text-xs text-gray-500">Leave blank for no expiration</p>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="edit-active"
                        name="active"
                        type="checkbox"
                        checked={formData.active}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="edit-active" className="ml-2 block text-sm text-gray-900">
                        Active
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Update Promotion
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 