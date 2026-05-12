import { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function DeliveryCalendar() {
  const [date, setDate] = useState(new Date());
  const [timeSlots] = useState([
    '9:00 AM - 11:00 AM',
    '11:00 AM - 1:00 PM',
    '1:00 PM - 3:00 PM',
    '3:00 PM - 5:00 PM'
  ]);

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Schedule Delivery</h2>
      <Calendar
        onChange={setDate}
        value={date}
        minDate={new Date()}
        className="mb-6"
      />
      <div className="space-y-2">
        <h3 className="font-medium">Available Time Slots:</h3>
        {timeSlots.map((slot) => (
          <button
            key={slot}
            className="w-full p-2 border rounded hover:bg-green-50 hover:border-green-200"
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
} 