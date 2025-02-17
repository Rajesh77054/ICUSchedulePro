import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { getShiftDuration, detectShiftConflicts } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { format, differenceInDays, addDays } from "date-fns";
import type { Shift, User } from "@/lib/types";
import { ShiftDialog } from "./ShiftDialog";
import { ShiftActionsDialog } from "./ShiftActionsDialog";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventDragStartArg, EventDragStopArg, EventResizeDoneArg, EventClickArg, DateSelectArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useQuery } from "@tanstack/react-query";

type CalendarView = 'dayGridWeek' | 'dayGridMonth' | 'multiMonth' | 'listWeek';

interface CalendarProps {
  shifts?: Shift[];
}

interface SwapRequest {
  id: number;
  shiftId: number;
  requestorId: number;
  recipientId: number;
  status: 'pending' | 'accepted' | 'rejected';
  shift: Shift;
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

  // Update shifts query configuration
  const { data: shifts = [], error: shiftsError } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 5000, // Poll every 5 seconds
    retry: 3,
    onError: (error) => {
      console.error('Error fetching shifts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch shifts. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update swap requests query with better error handling
  const { data: swapRequests = [] } = useQuery<SwapRequest[]>({
    queryKey: ["/api/swap-requests"],
    staleTime: 0,
    refetchInterval: 5000,
    retry: 3,
    onError: (error) => {
      console.error('Error fetching swap requests:', error);
      toast({
        title: "Error",
        description: "Failed to fetch swap requests. Please try again.",
        variant: "destructive",
      });
    }
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

  // Add delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete shift');
      }
      return res.json();
    },
    onSuccess: async (response, shiftId) => {
      // Only proceed if the deletion was successful
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete shift');
      }

      // Cancel any outgoing queries first
      await queryClient.cancelQueries({ queryKey: ["/api/shifts"] });

      // Update the cache immediately
      queryClient.setQueryData(["/api/shifts"], (oldData: Shift[] = []) => {
        return oldData.filter(shift => shift.id !== shiftId);
      });

      // Force a refresh of all shift-related queries
      await queryClient.invalidateQueries({
        queryKey: ["/api/shifts"],
        refetchType: 'all',
        exact: false
      });

      // Trigger calendar refresh
      window.dispatchEvent(new Event('forceCalendarRefresh'));

      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update effect to force refresh on WebSocket updates
  useEffect(() => {
    const handleShiftUpdate = async () => {
      console.log('Forcing calendar refresh due to shift update');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/shifts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] })
      ]);

      // Force FullCalendar to refetch events
      if (calendarRef.current) {
        const api = calendarRef.current.getApi();
        api.refetchEvents();
      }
    };

    // Listen for both shift changes and manual refresh events
    window.addEventListener('shiftChange', handleShiftUpdate);
    window.addEventListener('forceCalendarRefresh', handleShiftUpdate);

    return () => {
      window.removeEventListener('shiftChange', handleShiftUpdate);
      window.removeEventListener('forceCalendarRefresh', handleShiftUpdate);
    };
  }, [queryClient]);


  // Add effect to force refresh on swap request changes
  useEffect(() => {
    const handleSwapUpdate = async () => {
      console.log('Forcing calendar refresh due to swap update');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/shifts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] })
      ]);

      if (calendarRef.current) {
        const api = calendarRef.current.getApi();
        api.refetchEvents();
      }
    };

    window.addEventListener('swapRequestUpdate', handleSwapUpdate);
    return () => window.removeEventListener('swapRequestUpdate', handleSwapUpdate);
  }, [queryClient]);

  // Update calendar events with better logging
  const calendarEvents = useMemo(() => {
    console.log('Recalculating calendar events:', { shifts, swapRequests });

    if (!Array.isArray(shifts)) {
      console.warn('Shifts data is not an array:', shifts);
      return [];
    }

    return shifts.map(shift => {
      const swapRequest = swapRequests.find(req =>
        req.shiftId === shift.id &&
        req.status === 'accepted'
      );

      console.log('Processing shift:', { 
        shiftId: shift.id, 
        status: shift.status,
        swapRequest: swapRequest ? { id: swapRequest.id, status: swapRequest.status } : null
      });

      const effectiveUserId = shift.status === 'swapped' && swapRequest
        ? (shift.userId === swapRequest.requestorId ? swapRequest.recipientId : swapRequest.requestorId)
        : shift.userId;

      return {
        id: shift.id.toString(),
        title: users.find(u => u.id === effectiveUserId)?.name || 'Unknown',
        start: shift.startDate,
        end: shift.endDate,
        backgroundColor: getUserColor(effectiveUserId),
        borderColor: getUserColor(effectiveUserId),
        textColor: 'white',
        extendedProps: {
          shift,
          swapped: shift.status === 'swapped',
          originalUserId: shift.userId,
          effectiveUserId,
          swapRequest: swapRequest || null
        },
        editable: true,
        durationEditable: true,
      };
    });
  }, [shifts, users, swapRequests]);

  const handleEventDrop = async (dropInfo: EventDragStopArg) => {
    try {
      if (!dropInfo.event) return;

      const shiftId = parseInt(dropInfo.event.id);
      const startDate = dropInfo.event.start;
      const endDate = dropInfo.event.end;

      if (!startDate || !endDate) {
        dropInfo.revert();
        return;
      }

      const shift = shifts.find(s => s.id === shiftId);

      if (!shift) {
        dropInfo.revert();
        return;
      }

      const duration = differenceInDays(new Date(shift.endDate), new Date(shift.startDate));
      const newEndDate = addDays(startDate, duration);

      const otherShifts = shifts.filter(s => s.id !== shiftId);
      const conflicts = detectShiftConflicts({
        ...shift,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(newEndDate, 'yyyy-MM-dd')
      }, otherShifts);

      if (conflicts.length > 0) {
        toast({
          title: "Schedule Conflict",
          description: conflicts.map(c => `${c.type === 'overlap' ? '🔄' : '⚠️'} ${c.message}`).join("\n"),
          variant: "destructive"
        });
        dropInfo.revert();
        return;
      }

      await updateShiftMutation.mutateAsync({
        id: shiftId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(newEndDate, 'yyyy-MM-dd'),
      });
    } catch (error) {
      console.error('Error in handleEventDrop:', error);
      dropInfo.revert();
      toast({
        title: "Error",
        description: "Failed to update shift dates",
        variant: "destructive"
      });
    }
  };

  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    try {
      if (!resizeInfo.event) return;

      const shiftId = parseInt(resizeInfo.event.id);
      const startDate = resizeInfo.event.startStr;
      const endDate = resizeInfo.event.endStr;
      const shift = shifts.find(s => s.id === shiftId);

      if (!shift) {
        resizeInfo.revert();
        return;
      }

      const otherShifts = shifts.filter(s => s.id !== shiftId);
      const conflicts = detectShiftConflicts({
        ...shift,
        startDate,
        endDate
      }, otherShifts);

      if (conflicts.length > 0) {
        toast({
          title: "Schedule Conflict",
          description: conflicts.map(c => `${c.type === 'overlap' ? '🔄' : '⚠️'} ${c.message}`).join("\n"),
          variant: "destructive"
        });
        resizeInfo.revert();
        return;
      }

      await updateShiftMutation.mutateAsync({
        id: shiftId,
        startDate,
        endDate,
      });
    } catch (error) {
      resizeInfo.revert();
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive"
      });
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

  const handleSelect = (selectInfo: DateSelectArg) => {
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

  // Add handleDeleteShift function
  const handleDeleteShift = async (shiftId: number) => {
    try {
      await deleteShiftMutation.mutateAsync(shiftId);
    } catch (error) {
      console.error('Error deleting shift:', error);
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
        onDelete={handleDeleteShift}
      />
    </Card>
  );
}