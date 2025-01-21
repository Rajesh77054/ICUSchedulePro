import { useState, useRef, useMemo } from "react";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Shift, User } from "@/lib/types";
import { ShiftDialog } from "./ShiftDialog";
import { ShiftActionsDialog } from "./ShiftActionsDialog";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin, { 
  EventClickArg,
  EventDropArg,
  EventResizeDoneArg 
} from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useQuery } from "@tanstack/react-query";

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
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftActionsOpen, setShiftActionsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calendarRef = useRef<FullCalendar>(null);

  // Fetch users for shift assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getUserColor = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.color || "hsl(0, 0%, 50%)";
  };

  // Update shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: async (data: { id: number; startDate: string; endDate: string }) => {
      const res = await fetch(`/api/shifts/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update shift');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      toast({
        title: 'Success',
        description: 'Shift updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const calendarEvents = useMemo(() =>
    initialShifts.map(shift => ({
      id: shift.id.toString(),
      title: users.find(u => u.id === shift.userId)?.name || 'Unknown',
      start: shift.startDate,
      end: shift.endDate,
      backgroundColor: getUserColor(shift.userId),
      borderColor: getUserColor(shift.userId),
      textColor: 'white',
      extendedProps: { shift },
      editable: true,
      durationEditable: true,
    })),
    [initialShifts, users]
  );

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const shiftId = parseInt(dropInfo.event.id);
    const startDate = dropInfo.event.startStr;
    const endDate = dropInfo.event.endStr;

    try {
      await updateShiftMutation.mutateAsync({
        id: shiftId,
        startDate,
        endDate,
      });
    } catch (error) {
      dropInfo.revert();
    }
  };

  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    const shiftId = parseInt(resizeInfo.event.id);
    const startDate = resizeInfo.event.startStr;
    const endDate = resizeInfo.event.endStr;

    try {
      await updateShiftMutation.mutateAsync({
        id: shiftId,
        startDate,
        endDate,
      });
    } catch (error) {
      resizeInfo.revert();
    }
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const shift = clickInfo.event.extendedProps.shift;
    setSelectedShift(shift);
    setShiftActionsOpen(true);
  };

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
        <div className="flex items-center gap-2">
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
        </div>
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
            editable={true}
            droppable={true}
            eventDurationEditable={true}
            eventResizableFromStart={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventContent={(eventInfo) => {
              const shift = eventInfo.event.extendedProps.shift;
              return (
                <div className="p-1 select-none truncate">
                  {eventInfo.event.title}
                  {shift?.status === 'swapped' && (
                    <span className="ml-1 text-xs text-blue-500">(Swapped)</span>
                  )}
                </div>
              );
            }}
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
      <ShiftActionsDialog
        shift={selectedShift}
        open={shiftActionsOpen}
        onOpenChange={setShiftActionsOpen}
      />
    </Card>
  );
}