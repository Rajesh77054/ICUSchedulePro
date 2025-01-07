import { useState, useRef } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PROVIDERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";
import { ShiftDialog } from "./ShiftDialog";
import { useToast } from "@/hooks/use-toast";

type CalendarView = 'dayGridWeek' | 'dayGridMonth' | 'multiMonth';

export function Calendar() {
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>('dayGridWeek');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date }>();
  const calendarRef = useRef<FullCalendar>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", view, date],
  });

  const { mutate: updateShift } = useMutation({
    mutationFn: async (data: Partial<Shift>) => {
      const res = await fetch(`/api/shifts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
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
    extendedProps: { shift },
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

  const handleSelect = (selectInfo: any) => {
    setSelectedDates({
      start: selectInfo.start,
      end: selectInfo.end,
    });
    setDialogOpen(true);
  };

  const handleEventDrop = (dropInfo: any) => {
    const shift = dropInfo.event.extendedProps.shift;
    updateShift({
      id: shift.id,
      startDate: format(dropInfo.event.start, 'yyyy-MM-dd'),
      endDate: format(dropInfo.event.end || dropInfo.event.start, 'yyyy-MM-dd'),
    });
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
            onClick={() => handleViewChange('multiMonth')}
            className={view === 'multiMonth' ? 'bg-primary text-primary-foreground' : ''}
          >
            Year
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] [&_.fc-toolbar-title]:text-base [&_.fc-col-header-cell-cushion]:text-sm [&_.fc-daygrid-day-number]:text-sm [&_.fc-multimonth-title]:font-medium [&_.fc-multimonth-title]:!py-2 [&_.fc-multimonth-title]:!px-4 [&_.fc-multimonth-title]:!text-base [&_.fc-multimonth]:gap-6">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, multiMonthPlugin, interactionPlugin]}
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
            editable={true}
            selectable={true}
            selectMirror={true}
            select={handleSelect}
            eventDrop={handleEventDrop}
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
                multiMonthMaxColumns: 3,
                multiMonthMinWidth: 350,
                showNonCurrentDates: false
              }
            }}
            datesSet={(dateInfo) => {
              setDate(dateInfo.view.currentStart);
              setView(dateInfo.view.type as CalendarView);
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