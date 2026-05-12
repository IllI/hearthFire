import { useState, useEffect } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminSalesChart({ orders = [] }) {
  const [chartData, setChartData] = useState(null);
  
  useEffect(() => {
    // If no orders provided, set default chart data with zeros
    if (!orders || orders.length === 0) {
      console.log('AdminSalesChart: No orders provided, using empty data');
      
      // Generate labels for the last 30 days
      const labels = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return format(date, 'MMM d');
      });
      
      // Create empty datasets
      setChartData({
        labels,
        datasets: [
          {
            label: 'Sales ($)',
            data: Array(30).fill(0),
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            yAxisID: 'y',
          },
          {
            label: 'Orders',
            data: Array(30).fill(0),
            borderColor: 'rgba(153, 102, 255, 1)',
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            yAxisID: 'y1',
          },
        ],
      });
      
      return;
    }
    
    console.log(`AdminSalesChart: Processing ${orders.length} orders for chart`);
    
    // Debug the first order's timestamp format
    if (orders.length > 0) {
      const sampleOrder = orders[0];
      console.log('Sample order timestamp:', {
        createdAt: sampleOrder.createdAt,
        type: typeof sampleOrder.createdAt,
        hasToDate: sampleOrder.createdAt && typeof sampleOrder.createdAt.toDate === 'function',
        hasSeconds: sampleOrder.createdAt && sampleOrder.createdAt.seconds !== undefined
      });
    }

    // Generate data for the last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    // Create date-based maps for sales and order counts
    const dailySales = {};
    const dailyOrders = {};

    // Initialize all dates with zeros
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = format(date, 'yyyy-MM-dd');
      dailySales[dateStr] = 0;
      dailyOrders[dateStr] = 0;
    }

    // Process each order
    let totalProcessed = 0;
    let skippedInvalidDate = 0;
    let totalSales = 0;

    orders.forEach((order) => {
      try {
        // Enhanced timestamp handling
        let orderDate;
        
        // Extract the createdAt timestamp
        const createdAt = order.createdAt;
        
        if (!createdAt) {
          console.warn('Order missing createdAt timestamp:', order.id);
          skippedInvalidDate++;
          return; // skip this order
        }
        
        // Firestore timestamp with toDate method
        if (typeof createdAt.toDate === 'function') {
          orderDate = createdAt.toDate();
        }
        // Firestore timestamp with seconds
        else if (createdAt.seconds !== undefined) {
          orderDate = new Date(createdAt.seconds * 1000);
        }
        // ISO string
        else if (typeof createdAt === 'string') {
          orderDate = new Date(createdAt);
        }
        // Already a Date object
        else if (createdAt instanceof Date) {
          orderDate = createdAt;
        }
        else {
          console.warn('Invalid timestamp format for order:', order.id);
          skippedInvalidDate++;
          return; // skip this order
        }
        
        // Check if the orderDate is valid
        if (isNaN(orderDate.getTime())) {
          console.warn('Invalid date for order:', order.id);
          skippedInvalidDate++;
          return; // skip this order
        }
        
        // Check if the order is within the last 30 days
        if (orderDate < thirtyDaysAgo) {
          return; // skip orders older than 30 days
        }
        
        // Format the date as YYYY-MM-DD for aggregation
        const dateStr = format(orderDate, 'yyyy-MM-dd');
        
        // Get the order total
        let orderTotal = 0;
        if (typeof order.total === 'number') {
          orderTotal = order.total;
        } else if (typeof order.total === 'string') {
          orderTotal = parseFloat(order.total) || 0;
        }
        
        // Add to daily totals
        if (dailySales[dateStr] !== undefined) {
          dailySales[dateStr] += orderTotal;
          dailyOrders[dateStr] += 1;
          totalSales += orderTotal;
          totalProcessed++;
        }
      } catch (error) {
        console.error('Error processing order for chart:', error, order);
        skippedInvalidDate++;
      }
    });
    
    console.log(`Chart processing summary: processed ${totalProcessed} orders, skipped ${skippedInvalidDate} with invalid dates`);
    console.log(`Total sales for period: $${totalSales.toFixed(2)}`);

    // Convert to arrays for Chart.js
    const dates = Object.keys(dailySales).sort();
    const salesValues = dates.map(date => dailySales[date]);
    const orderCounts = dates.map(date => dailyOrders[date]);
    
    // Format dates for display
    const labels = dates.map(date => {
      const [year, month, day] = date.split('-');
      return format(new Date(year, month - 1, day), 'MMM d');
    });
    
    // Log summary info for debugging
    const nonZeroSalesDays = salesValues.filter(val => val > 0).length;
    const nonZeroOrderDays = orderCounts.filter(val => val > 0).length;
    
    console.log(`Chart data summary: ${nonZeroSalesDays} days with sales, ${nonZeroOrderDays} days with orders`);

    // Set the chart data
    setChartData({
      labels,
      datasets: [
        {
          label: 'Sales ($)',
          data: salesValues,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y',
        },
        {
          label: 'Orders',
          data: orderCounts,
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          yAxisID: 'y1',
        },
      ],
    });
  }, [orders]);

  // Chart.js options
  const options = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: 'Sales Overview (Last 30 Days)',
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Sales ($)',
        },
        ticks: {
          callback: function(value) {
            return '$' + value;
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Order Count',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  if (!chartData) {
    return <div className="text-center p-4">Loading chart data...</div>;
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <Line data={chartData} options={options} />
    </div>
  );
} 