const fetchDeliverySchedules = async () => {
  setIsLoading(true);
  try {
    console.log('Fetching delivery schedules');
    const response = await fetch('/api/delivery/schedules');
    
    if (!response.ok) {
      console.error('Failed to fetch delivery schedules:', response.statusText);
      setErrorMessage('Unable to load delivery options. Please try again later.');
      setDeliverySchedules([]);
      return;
    }
    
    const data = await response.json();
    
    // Filter out past dates and dates with no available slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const validSchedules = data.filter(schedule => {
      // Check if schedule date is valid
      const scheduleDate = new Date(schedule.date);
      if (isNaN(scheduleDate.getTime())) {
        console.warn('Invalid date in schedule:', schedule);
        return false;
      }
      
      // Check if date is in the future
      if (scheduleDate < today) {
        return false;
      }
      
      // Check if at least one slot is available
      return schedule.slots && schedule.slots.some(slot => 
        slot.available && 
        (!slot.maxOrders || slot.currentOrders < slot.maxOrders)
      );
    });
    
    setDeliverySchedules(validSchedules);
    
    if (validSchedules.length === 0) {
      setErrorMessage('No delivery dates available. Please check back later.');
    } else {
      setErrorMessage('');
    }
  } catch (error) {
    console.error('Error fetching delivery schedules:', error);
    setErrorMessage('Unable to load delivery options. Please try again later.');
    setDeliverySchedules([]);
  } finally {
    setIsLoading(false);
  }
}; 