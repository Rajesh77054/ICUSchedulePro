
import { useState, useRef, useEffect } from 'react';
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { getShiftDuration } from "@/lib/utils";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQueryClient } from '@tanstack/react-query';
import type { User, Shift } from '@/lib/types';

interface CalendarProps {
  shifts?: Shift[];
}

export function Calendar({ shifts = [] }: CalendarProps) {
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const handleForceRefresh = () => {
      calendarRef.current?.getApi().refetchEvents();
    };
    window.addEventListener('forceCalendarRefresh', handleForceRefresh);
    return () => window.removeEventListener('forceCalendarRefresh', handleForceRefresh);
  }, []);

  return (
    <div className="w-full h-[calc(100vh-12rem)] overflow-hidden rounded-lg border bg-white">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={shifts.map(shift => ({
          id: shift.id.toString(),
          title: `Shift ${shift.id}`,
          start: shift.startDate,
          end: shift.endDate,
          allDay: true,
          backgroundColor: '#4CAF50'
        }))}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek'
        }}
      />
    </div>
  );
}
