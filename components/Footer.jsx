import Link from 'next/link';
import { FaInstagram, FaFacebook } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/products" className="text-gray-600 hover:text-green-700">
                  Our Produce
                </Link>
              </li>
              <li>
                <Link href="/schedule" className="text-gray-600 hover:text-green-700">
                  Delivery Schedule
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-600 hover:text-green-700">
                  Our Farm
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect With Us</h3>
            <div className="flex space-x-4">
              <a
                href="https://instagram.com/hearthfire_farmandnursery"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-green-700"
              >
                <FaInstagram className="h-6 w-6" />
                <span className="sr-only">Instagram</span>
              </a>
              <a
                href="https://facebook.com/hearthfirefarm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-green-700"
              >
                <FaFacebook className="h-6 w-6" />
                <span className="sr-only">Facebook</span>
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact</h3>
            <p className="text-gray-600">
              Questions? Get in touch with us at<br />
              <a href="mailto:info@hearthfirefarm.com" className="text-green-700 hover:text-green-800">
                info@hearthfirefarm.com
              </a>
            </p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} Hearthfire Farm. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
} 