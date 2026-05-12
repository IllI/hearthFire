import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function DeliveryCalendar() {
  const [date, setDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTimeSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/delivery/schedules');
        if (!response.ok) {
          throw new Error('Failed to fetch time slots');
        }
        const data = await response.json();
        // Assuming the API returns an array of schedules with a 'slots' property
        const todaySlots = data.find(schedule => new Date(schedule.date).toDateString() === date.toDateString());
        setTimeSlots(todaySlots ? todaySlots.slots : []);
      } catch (error) {
        setError(error.message);
      }
      setLoading(false);
    };

    fetchTimeSlots();
  }, [date]);

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
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && timeSlots.length === 0 && <p>No available time slots for this date.</p>}
        {timeSlots.map((slot) => (
          <button
            key={slot.id}
            className="w-full p-2 border rounded hover:bg-green-50 hover:border-green-200"
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}