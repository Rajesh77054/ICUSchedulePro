import { useState, useRef, useMemo } from "react";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PROVIDERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";
import { ShiftDialog } from "./ShiftDialog";

// Import FullCalendar and required plugins
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';

type CalendarView = 'dayGridWeek' | 'dayGridMonth' | 'multiMonth' | 'listWeek';

interface CalendarProps {
  shifts?: Shift[];
}

export function Calendar({ shifts: initialShifts = [] }: CalendarProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>('dayGridMonth');
  const [viewTitle, setViewTitle] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date }>();
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false);

  const calendarRef = useRef<FullCalendar>(null);
  const queryClient = useQueryClient();

  const getProviderColor = (providerId: number) => {
    return PROVIDERS.find(p => p.id === providerId)?.color || "hsl(0, 0%, 50%)";
  };

  const calendarEvents = useMemo(() =>
    initialShifts.map(shift => ({
      id: shift.id.toString(),
      title: PROVIDERS.find(p => p.id === shift.providerId)?.name || 'Unknown',
      start: shift.startDate,
      end: shift.endDate,
      backgroundColor: getProviderColor(shift.providerId),
      borderColor: getProviderColor(shift.providerId),
      textColor: 'white',
      extendedProps: { shift },
    })),
    [initialShifts]
  );

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

  const handleSelect = (selectInfo: any) => {
    setSelectedDates({
      start: selectInfo.start,
      end: selectInfo.end,
    });
    setDialogOpen(true);
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const calendar = calendarRef.current;
      if (calendar) {
        calendar.getApi().gotoDate(newDate);
        setDate(newDate);
        setMiniCalendarOpen(false);
      }
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
        <div className="flex items-center space-x-4">
          <CardTitle className="text-lg md:text-xl font-bold">
            {viewTitle}
          </CardTitle>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="h-9 w-9 md:h-8 md:w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-9 md:h-8"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="h-9 w-9 md:h-8 md:w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={view} onValueChange={handleViewChange}>
            <SelectTrigger className="h-9 md:h-8 w-[120px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dayGridWeek">Week</SelectItem>
              <SelectItem value="dayGridMonth">Month</SelectItem>
              <SelectItem value="multiMonth">Year</SelectItem>
              <SelectItem value="listWeek">List</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Popover open={miniCalendarOpen} onOpenChange={setMiniCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 w-9 p-0"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <MiniCalendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[calc(100vh-16rem)] md:h-[600px] relative">
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              multiMonthPlugin,
              interactionPlugin,
              listPlugin,
            ]}
            initialView={view}
            headerToolbar={false}
            events={calendarEvents}
            initialDate={date}
            weekends={true}
            firstDay={0}
            dayMaxEvents={3}
            navLinks={true}
            eventContent={(eventInfo) => (
              <div className="p-1 select-none truncate">
                {eventInfo.event.title}
              </div>
            )}
            height="100%"
            selectable={true}
            select={handleSelect}
            views={{
              dayGridWeek: {
                titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
                duration: { weeks: 1 }
              },
              dayGridMonth: {
                titleFormat: { year: 'numeric', month: 'long' }
              },
              multiMonth: {
                duration: { years: 1 },
                titleFormat: { year: 'numeric' },
                multiMonthMaxColumns: 2,
                multiMonthMinWidth: 300,
                showNonCurrentDates: false
              },
              listWeek: {
                titleFormat: { year: 'numeric', month: 'long' },
                duration: { weeks: 1 },
                noEventsContent: 'No shifts scheduled'
              }
            }}
            datesSet={(dateInfo) => {
              setDate(dateInfo.view.currentStart);
              setView(dateInfo.view.type as CalendarView);
              setViewTitle(dateInfo.view.title);
            }}
          />
        </div>
      </CardContent>

      {selectedDates && (
        <ShiftDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          startDate={selectedDates.start}
          endDate={selectedDates.end}
        />
      )}
    </Card>
  );
}