import { useState, useRef } from "react";
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
  const calendarRef = useRef<FullCalendar>(null);

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

  const handleNext = () => {
    const calendar = calendarRef.current;
    if (calendar) {
      calendar.getApi().next();
    }
  };

  const handlePrev = () => {
    const calendar = calendarRef.current;
    if (calendar) {
      calendar.getApi().prev();
    }
  };

  const handleToday = () => {
    const calendar = calendarRef.current;
    if (calendar) {
      calendar.getApi().today();
    }
  };

  const handleViewChange = (newView: CalendarView) => {
    const calendar = calendarRef.current;
    if (calendar) {
      calendar.getApi().changeView(newView);
      setView(newView);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-4">
          <CardTitle className="text-xl font-bold">ICU Schedule</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 mr-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
        <div className="h-[600px] [&_.fc-toolbar-title]:text-base [&_.fc-col-header-cell-cushion]:text-sm [&_.fc-daygrid-day-number]:text-sm [&_.fc-multimonth-daygrid]:gap-4 [&_.fc-multimonth-title]:!py-1 [&_.fc-multimonth-title]:!text-xs [&_.fc-daygrid-month-labelrow]:!text-xs [&_.fc-multimonth-month-cell]:!pt-4 [&_.fc-multimonth-month-cell]:!min-w-[200px] [&_.fc-multimonth-title]:!px-2">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={{
              left: '',
              center: 'title',
              right: '',
            }}
            events={calendarEvents}
            initialDate={date}
            weekends={true}
            firstDay={0}
            height="100%"
            dayMaxEvents={true}
            navLinks={true}
            editable={false}
            selectable={true}
            selectMirror={true}
            views={{
              dayGridWeek: {
                titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
                duration: { weeks: 1 }
              },
              dayGridMonth: {
                titleFormat: { year: 'numeric', month: 'long' }
              },
              dayGridYear: {
                titleFormat: { year: 'numeric' },
                duration: { years: 1 },
                multiMonthMinWidth: '200px',
                multiMonthTitleFormat: { month: 'short' },
                dayHeaderFormat: { weekday: 'narrow' },
                dayCellClassNames: 'text-[10px] py-0',
                dayHeaderClassNames: 'text-[10px]',
                stickyHeaderDates: true,
                fixedWeekCount: false
              }
            }}
            datesSet={(dateInfo) => {
              setDate(dateInfo.view.currentStart);
              setView(dateInfo.view.type as CalendarView);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}