import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminLayout from '../../components/AdminLayout';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

export default function Inventory() {
  const { currentUser, isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const firestore = getFirestore();
        const productsCollection = collection(firestore, 'products');
        const productSnapshot = await getDocs(productsCollection);
        
        const productsList = productSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          stock: doc.data().stock || 0
        }));
        
        setProducts(productsList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
        setError('Failed to load products');
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const updateStock = async (productId, newStock) => {
    try {
      const firestore = getFirestore();
      const productRef = doc(firestore, 'products', productId);
      
      await updateDoc(productRef, {
        stock: parseInt(newStock, 10),
        updatedAt: new Date()
      });
      
      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId ? { ...p, stock: parseInt(newStock, 10) } : p
        )
      );
    } catch (error) {
      console.error("Error updating product stock: ", error);
      setError("Failed to update inventory");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Inventory Management</h1>
          <p>Loading inventory data...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Inventory Management</h1>
          <p className="text-red-500">{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Inventory Management</h1>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map(product => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {product.images && product.images[0] && (
                        <img className="h-10 w-10 rounded-full mr-3 object-cover" src={product.images[0]} alt={product.name} />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      className="border rounded px-2 py-1 w-20"
                      value={product.stock}
                      onChange={(e) => updateStock(product.id, e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {product.updatedAt ? new Date(product.updatedAt.seconds * 1000).toLocaleString() : 'Never'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
} 