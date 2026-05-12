export default function CartSummary() {
  return (
    <div className="snipcart-summary">
      <span className="snipcart-total-price text-green-700 font-medium"></span>
      <span className="snipcart-items-count text-gray-500">({' '}
        <span className="snipcart-total-items"></span> items)
      </span>
    </div>
  );
} 