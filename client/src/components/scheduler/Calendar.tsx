import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { PROVIDERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";

type CalendarView = 'dayGridWeek' | 'dayGridMonth' | 'dayGridYear';

export function Calendar() {
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>('dayGridWeek');

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", view, date],
  });

  const getProviderColor = (providerId: number) => {
    return PROVIDERS.find(p => p.id === providerId)?.color || "hsl(0, 0%, 50%)";
  };

  const calendarEvents = shifts?.map(shift => ({
    id: shift.id.toString(),
    title: PROVIDERS.find(p => p.id === shift.providerId)?.name || 'Unknown',
    start: shift.startDate,
    end: shift.endDate,
    backgroundColor: getProviderColor(shift.providerId),
    borderColor: getProviderColor(shift.providerId),
    textColor: 'white',
  })) || [];

  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
  };

  const handleDateChange = (date: Date) => {
    setDate(date);
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-4">
          <CardTitle className="text-xl font-bold">ICU Schedule</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewChange('dayGridWeek')}
            className={view === 'dayGridWeek' ? 'bg-primary text-primary-foreground' : ''}
          >
            Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewChange('dayGridMonth')}
            className={view === 'dayGridMonth' ? 'bg-primary text-primary-foreground' : ''}
          >
            Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewChange('dayGridYear')}
            className={view === 'dayGridYear' ? 'bg-primary text-primary-foreground' : ''}
          >
            Year
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[600px]">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            events={calendarEvents}
            initialDate={date}
            weekends={true}
            firstDay={0} // Start week on Sunday
            height="100%"
            dayMaxEvents={true}
            navLinks={true}
            editable={false}
            selectable={true}
            selectMirror={true}
            views={{
              dayGridWeek: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
                duration: { weeks: 1 }
              },
              dayGridMonth: {
                titleFormat: { year: 'numeric', month: 'long' }
              },
              dayGridYear: {
                titleFormat: { year: 'numeric' },
                duration: { years: 1 },
                monthMode: true,
                multiMonthYear: true,
                multiMonthMaxColumns: 4, // 4 columns for desktop
                multiMonthMinWidth: 250, // Adjust based on screen size
              }
            }}
            datesSet={(dateInfo) => {
              handleDateChange(dateInfo.view.currentStart);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}