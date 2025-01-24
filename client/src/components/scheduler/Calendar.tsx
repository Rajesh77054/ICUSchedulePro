
import { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQueryClient } from '@tanstack/react-query';
import type { User, Shift } from '@/lib/types';
import { ShiftActionsDialog } from './ShiftActionsDialog';

interface CalendarProps {
  shifts?: Shift[];
  users?: User[];
}

export default function Calendar({ shifts = [], users = [] }: CalendarProps) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const handleForceRefresh = () => {
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
    };
    window.addEventListener('forceCalendarRefresh', handleForceRefresh);
    return () => window.removeEventListener('forceCalendarRefresh', handleForceRefresh);
  }, []);

  const handleEventClick = (clickInfo: { event: { id: string } }) => {
    const shift = shifts.find(s => s.id.toString() === clickInfo.event.id);
    if (shift) {
      setSelectedShift(shift);
      setShowShiftDialog(true);
    }
  };

  const handleEventDrop = async (dropInfo: { event: { id: string, startStr: string, endStr: string } }) => {
    const shiftId = parseInt(dropInfo.event.id);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    const newShift = {
      ...shift,
      startDate: dropInfo.event.startStr,
      endDate: dropInfo.event.endStr
    };

    try {
      await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift)
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
    } catch (error) {
      console.error('Failed to update shift:', error);
    }
  };

  const handleEventResize = async (resizeInfo: any) => {
    const shiftId = parseInt(resizeInfo.event.id);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    const newShift = {
      ...shift,
      startDate: resizeInfo.event.startStr,
      endDate: resizeInfo.event.endStr
    };

    try {
      await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift)
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
    } catch (error) {
      console.error('Failed to update shift:', error);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-12rem)] overflow-hidden rounded-lg border bg-white">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        editable={true}
        droppable={true}
        events={shifts.map(shift => {
          const user = users.find(u => u.id === shift.userId);
          return {
            id: shift.id.toString(),
            title: user ? `${user.name} - ${user.title}` : `Shift ${shift.id}`,
            start: shift.startDate,
            end: shift.endDate,
            allDay: true,
            backgroundColor: user?.color || '#4CAF50',
            borderColor: user?.color || '#4CAF50'
          };
        })}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek'
        }}
      />
      {selectedShift && (
        <ShiftActionsDialog
          open={showShiftDialog}
          onOpenChange={setShowShiftDialog}
          shift={selectedShift}
        />
      )}
    </div>
  );
}
