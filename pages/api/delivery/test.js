export default function handler(req, res) {
  console.log('Test API endpoint called');
  
  return res.status(200).json({
    message: 'Test API endpoint is working',
    mockData: [
      {
        id: 'test-schedule-1',
        date: new Date().toISOString(),
        slots: [
          { id: 'morning', name: 'Morning', time: '9am - 12pm' }
        ]
      }
    ]
  });
} 