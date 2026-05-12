import AdminRoute from '../../../components/AdminRoute';
import ProductForm from '../../../components/ProductForm';
import Link from 'next/link';

export default function NewProduct() {
  return (
    <AdminRoute>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link 
            href="/admin/products"
            className="text-green-600 hover:text-green-800"
          >
            &larr; Back to Products
          </Link>
          <h1 className="text-2xl font-bold mt-2">Add New Product</h1>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <ProductForm />
        </div>
      </div>
    </AdminRoute>
  );
} 