import React, { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, startOfWeek, endOfMonth, endOfWeek, addDays, isSameMonth, isSameDay, parseISO, isToday, addWeeks, subWeeks, startOfDay, endOfDay } from 'date-fns';

export default function Calendar({ events = [], selectedEvent, onEventClick, compactMode = false }) {
  // State for current date displayed
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // State for view mode (month/week)
  const [viewMode, setViewMode] = useState('month');
  
  // Days of week array
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Get days for current month/week view
  const getDays = () => {
    if (viewMode === 'month') {
      // Month view - show 3 weeks instead of 6
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const startDate = startOfWeek(monthStart);
      
      // Instead of showing 6 weeks, only show 3 weeks starting from the first day of the month
      // This will make day cells larger while still showing enough context
      const endDate = addDays(startDate, 20); // 3 weeks (21 days)
      
      const days = [];
      let day = startDate;
      
      while (day <= endDate) {
        // Filter events for this day
        const dayEvents = events.filter(event => {
          const eventDate = new Date(event.date);
          return isSameDay(day, eventDate);
        });
        
        days.push({
          date: day,
          isCurrentMonth: isSameMonth(day, monthStart),
          isToday: isToday(day),
          events: dayEvents
        });
        
        day = addDays(day, 1);
      }
      
      return days;
    } else {
      // Week view
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(weekStart);
      
      const days = [];
      let day = weekStart;
      
      while (day <= weekEnd) {
        // Filter events for this day
        const dayEvents = events.filter(event => {
          const eventDate = new Date(event.date);
          return isSameDay(day, eventDate);
        });
        
        days.push({
          date: day,
          isCurrentMonth: isSameMonth(day, currentDate),
          isToday: isToday(day),
          events: dayEvents
        });
        
        day = addDays(day, 1);
      }
      
      return days;
    }
  };
  
  // Navigation functions
  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };
  
  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get days for rendering with useMemo
  const { days, dateLabel } = useMemo(() => {
    const calculatedDays = getDays();
    let label = '';
    
    if (viewMode === 'month') {
      label = format(currentDate, 'MMMM yyyy');
    } else {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(weekStart);
      
      // Format: "Apr 1 - Apr 7, 2025"
      if (isSameMonth(weekStart, weekEnd)) {
        label = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd')}, ${format(weekEnd, 'yyyy')}`;
      } else {
        label = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}, ${format(weekEnd, 'yyyy')}`;
      }
    }
    
    return {
      days: calculatedDays,
      dateLabel: label
    };
  }, [currentDate, events, viewMode]);
  
  return (
    <>
      {/* Calendar header */}
      <div className="bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center border-b">
        <div className="flex items-center justify-between mb-2 sm:mb-0">
          <h2 className="text-lg font-semibold text-gray-900 mr-4">
            {dateLabel}
          </h2>
          <div className="flex space-x-2">
            <button 
              type="button" 
              className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm"
              onClick={goToToday}
            >
              Today
            </button>
            <div className="flex border rounded">
              <button 
                type="button" 
                className="p-1 hover:bg-gray-100"
                onClick={goToPrevious}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button 
                type="button" 
                className="p-1 hover:bg-gray-100"
                onClick={goToNext}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex ml-auto space-x-2">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'month' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'week' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Week
          </button>
        </div>
      </div>
      
      {/* Day names */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {daysOfWeek.map((day) => (
          <div key={day} className="bg-gray-50 py-2 text-xs text-center text-gray-500 font-medium">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className={`flex-1 grid grid-cols-7 ${viewMode === 'month' ? 'grid-rows-3' : 'grid-rows-1'} border-gray-200 overflow-auto`}>
        {days.map((day, i) => (
          <div
            key={i}
            className={`${
              viewMode === 'month' ? 'min-h-[120px]' : 'min-h-[330px]'
            } border-b border-r border-gray-200 ${
              !day.isCurrentMonth ? 'bg-gray-50' : day.isToday ? 'bg-green-50' : 'bg-white'
            } p-2 flex flex-col overflow-hidden`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`text-sm ${
                !day.isCurrentMonth ? 'text-gray-400' :
                day.isToday ? 'text-green-700 font-bold' : 'text-gray-700'
              }`}>
                {format(day.date, 'd')}
              </span>
              {day.isToday && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Today
                </span>
              )}
            </div>
            
            {day.events.length > 0 && (
              <div className={`mt-1 space-y-2 ${
                viewMode === 'month' ? 'max-h-[80px]' : 'max-h-[280px]'
              } overflow-y-auto flex-1 pr-1`}>
                {day.events.map(event => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                      event.type === 'pickup' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-green-100 text-green-800 hover:bg-green-200'
                    } transition-colors ${
                      selectedEvent && selectedEvent.id === event.id ? 'ring-1 ring-offset-1 ring-blue-500' : ''
                    }`}
                  >
                    <span className="block font-medium">
                      {event.type === 'pickup' ? 'Pickup' : 'Delivery'}
                    </span>
                    {viewMode === 'week' && event.timeSlot && (
                      <span className="block text-xs opacity-75 mt-1">
                        {event.timeSlot.time || 'Standard hours'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
} 