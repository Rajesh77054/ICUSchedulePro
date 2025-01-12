import { useState, useRef } from "react";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRightLeft, Trash2, AlertTriangle } from "lucide-react";
import { ConflictResolutionWizard } from "./ConflictResolutionWizard";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PROVIDERS, HOLIDAYS_2024_2025 } from "@/lib/constants";
import type { Shift } from "@/lib/types";
import { ShiftDialog } from "./ShiftDialog";
import { useToast } from "@/hooks/use-toast";
import { detectShiftConflicts } from "@/lib/utils";
import { ConflictVisualizer } from "./ConflictVisualizer";
import { ShiftSwap } from "./ShiftSwap";
import { OverlappingShiftsDialog } from "./OverlappingShiftsDialog";

type CalendarView = 'dayGridWeek' | 'dayGridMonth' | 'multiMonth' | 'listWeek';

interface ShiftDetailsProps {
  shift: Shift;
  onClose: () => void;
  onSwapRequest: () => void;
  onDelete: () => void;
}

function ShiftDetails({ shift, onClose, onSwapRequest, onDelete }: ShiftDetailsProps) {
  const provider = PROVIDERS.find(p => p.id === shift.providerId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <p className="text-sm font-medium">Provider</p>
              <p className="text-sm text-muted-foreground">
                {provider?.name}, {provider?.title}
              </p>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Period</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(shift.startDate), 'MMM d, yyyy')} - {format(new Date(shift.endDate), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => {
                onSwapRequest();
                onClose();
              }}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Request Shift Swap
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Shift
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to delete this shift?</p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Calendar() {
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>('dayGridMonth');
  const [viewTitle, setViewTitle] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date }>();
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false);
  const [activeConflicts, setActiveConflicts] = useState<{
    shift: Shift;
    conflicts: ReturnType<typeof detectShiftConflicts>;
  } | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [overlappingShifts, setOverlappingShifts] = useState<Shift[]>([]);
  const [overlappingShiftsOpen, setOverlappingShiftsOpen] = useState(false);
  const [qgendaConflicts, setQgendaConflicts] = useState<Array<{
    qgenda: {
      startDate: string;
      endDate: string;
      summary: string;
    };
    local: Shift;
  }>>([]);
  const [showConflictWizard, setShowConflictWizard] = useState(false);

  const calendarRef = useRef<FullCalendar>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts, isLoading } = useQuery<Shift[]>({
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
      setActiveConflicts(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: deleteShift } = useMutation({
    mutationFn: async (shiftId: number) => {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
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

  const { mutate: resolveQGendaConflicts } = useMutation({
    mutationFn: async (resolutions: Array<{ shiftId: number; action: 'keep-qgenda' | 'keep-local' }>) => {
      const res = await fetch('/api/shifts/resolve-qgenda-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutions }),
      });
      if (!res.ok) throw new Error('Failed to resolve conflicts');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      toast({
        title: 'Success',
        description: 'Calendar conflicts resolved successfully',
      });
      setShowConflictWizard(false);
      setQgendaConflicts([]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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

  const backgroundEvents = HOLIDAYS_2024_2025.map(holiday => ({
    start: holiday.date,
    display: 'background',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    classNames: ['holiday-event'],
  }));

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
    if (!shift) {
      dropInfo.revert();
      return;
    }

    const updatedShift: Shift = {
      ...shift,
      startDate: format(dropInfo.event.start, 'yyyy-MM-dd'),
      endDate: format(dropInfo.event.end || dropInfo.event.start, 'yyyy-MM-dd'),
    };

    const conflicts = detectShiftConflicts(updatedShift, (shifts || []).filter(s => s.id !== shift.id));
    if (conflicts.length > 0) {
      setActiveConflicts({ shift: updatedShift, conflicts });
      dropInfo.revert();
      return;
    }

    updateShift({
      id: shift.id,
      startDate: updatedShift.startDate,
      endDate: updatedShift.endDate,
    });
  };

  const handleEventResize = (resizeInfo: any) => {
    const shift = resizeInfo.event.extendedProps.shift;
    if (!shift) {
      resizeInfo.revert();
      return;
    }

    const updatedShift: Shift = {
      ...shift,
      startDate: format(resizeInfo.event.start, 'yyyy-MM-dd'),
      endDate: format(resizeInfo.event.end || resizeInfo.event.start, 'yyyy-MM-dd'),
    };

    const conflicts = detectShiftConflicts(updatedShift, (shifts || []).filter(s => s.id !== shift.id));
    if (conflicts.length > 0) {
      setActiveConflicts({ shift: updatedShift, conflicts });
      resizeInfo.revert();
      return;
    }

    updateShift({
      id: shift.id,
      startDate: updatedShift.startDate,
      endDate: updatedShift.endDate,
    });
  };

  const handleEventClick = (clickInfo: any) => {
    const shift = clickInfo.event.extendedProps.shift;
    setSelectedShift(shift);
  };

  const handleEventMouseEnter = (info: any) => {
    const shift = info.event.extendedProps.shift;
    const conflicts = detectShiftConflicts(shift, shifts || []);
    if (conflicts.length > 0) {
      setActiveConflicts({ shift, conflicts });

      // Create a tooltip with resolve button
      const tooltip = document.createElement('div');
      tooltip.className = 'fc-tooltip bg-destructive text-destructive-foreground p-2 rounded shadow-lg';
      tooltip.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-sm">Shift overlaps with ${conflicts.length} other shift(s)</span>
          <button class="bg-white text-destructive px-2 py-1 rounded text-xs hover:bg-destructive-foreground">
            Resolve
          </button>
        </div>
      `;

      tooltip.querySelector('button')?.addEventListener('click', () => {
        setShowConflictWizard(true);
        setQgendaConflicts([
          {
            local: shift,
            qgenda: {
              startDate: conflicts[0].startDate,
              endDate: conflicts[0].endDate,
              summary: `Conflicting shift with ${PROVIDERS.find(p => p.id === conflicts[0].providerId)?.name}`
            }
          }
        ]);
      });

      const eventEl = info.el;
      tooltip.style.position = 'absolute';
      tooltip.style.zIndex = '10';
      tooltip.style.left = `${eventEl.offsetLeft}px`;
      tooltip.style.top = `${eventEl.offsetTop + eventEl.offsetHeight}px`;

      eventEl.appendChild(tooltip);
      info.el._tooltip = tooltip;
    }
  };

  const handleEventMouseLeave = (info: any) => {
    setActiveConflicts(null);
    if (info.el._tooltip) {
      info.el._tooltip.remove();
      delete info.el._tooltip;
    }
  };

  const renderEventContent = (eventInfo: any) => {
    const shift: Shift = eventInfo.event.extendedProps.shift;
    if (!shift) return null;

    return (
      <ContextMenu>
        <ContextMenuTrigger className="block w-full h-full cursor-context-menu">
          <div className="p-1 select-none truncate">
            {eventInfo.event.title}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => setSwapShift(shift)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Request Swap
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => deleteShift(shift.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Shift
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const handleMoreLinkClick = (info: any) => {
    const shifts = info.allSegs
      .map((seg: any) => seg.event.extendedProps.shift)
      .filter(Boolean);

    setOverlappingShifts(shifts);
    setOverlappingShiftsOpen(true);
    return undefined;
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

  const renderToolbar = () => (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 md:gap-2 flex-shrink-0">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrev}
          className="h-9 w-9 md:h-8 md:w-8 touch-manipulation"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToday}
          className="h-9 md:h-8 touch-manipulation"
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          className="h-9 w-9 md:h-8 md:w-8 touch-manipulation"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Select
        value={view}
        onValueChange={handleViewChange}
      >
        <SelectTrigger className="h-9 md:h-8 w-[120px] touch-manipulation">
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
  );

  const renderHeader = () => (
    <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
      <div className="flex items-center space-x-4 min-w-0">
        <CardTitle className="text-lg md:text-xl font-bold truncate flex-shrink min-w-0">
          <span className="truncate block">Personal Schedule Dashboard</span>
        </CardTitle>
        {qgendaConflicts.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowConflictWizard(true)}
            className="flex items-center gap-2 animate-pulse"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>
              {qgendaConflicts.length} Calendar {qgendaConflicts.length === 1 ? 'Conflict' : 'Conflicts'} Detected
            </span>
          </Button>
        )}
        <Popover open={miniCalendarOpen} onOpenChange={setMiniCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 w-9 p-0 flex-shrink-0"
              aria-label="Open mini calendar"
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
              className="touch-manipulation"
            />
          </PopoverContent>
        </Popover>
      </div>
      {renderToolbar()}
    </CardHeader>
  );


  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-muted-foreground">Loading calendar...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      {renderHeader()}
      <CardContent className="p-0">
        <div className="h-[calc(100vh-16rem)] md:h-[600px] relative touch-manipulation">
          <div className="absolute inset-0 w-full h-full">
            {activeConflicts && (
              <ConflictVisualizer
                shift={activeConflicts.shift}
                conflicts={activeConflicts.conflicts}
              />
            )}
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
              eventSources={[
                {
                  events: backgroundEvents,
                }
              ]}
              initialDate={date}
              weekends={true}
              firstDay={0}
              dayMaxEvents={window.innerWidth < 768 ? 2 : 3}
              navLinks={true}
              editable={true}
              eventStartEditable={true}
              eventDurationEditable={true}
              selectable={true}
              selectMirror={true}
              select={handleSelect}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              eventClick={handleEventClick}
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
              eventContent={renderEventContent}
              moreLinkClick={handleMoreLinkClick}
              height="100%"
              longPressDelay={0}
              eventLongPressDelay={0}
              selectLongPressDelay={0}
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
                  multiMonthMaxColumns: window.innerWidth < 768 ? 1 : 2,
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

      {selectedShift && (
        <ShiftDetails
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onSwapRequest={() => {
            setSwapShift(selectedShift);
            setSelectedShift(null);
          }}
          onDelete={() => {
            deleteShift(selectedShift.id);
            setSelectedShift(null);
          }}
        />
      )}

      {swapShift && (
        <ShiftSwap
          shift={swapShift}
          onClose={() => setSwapShift(null)}
        />
      )}

      <OverlappingShiftsDialog
        open={overlappingShiftsOpen}
        onOpenChange={setOverlappingShiftsOpen}
        shifts={overlappingShifts}
        onShiftUpdate={(shift) => {
          updateShift(shift);
          setOverlappingShiftsOpen(false);
        }}
      />
      <ConflictResolutionWizard
        open={showConflictWizard}
        conflicts={qgendaConflicts}
        onOpenChange={setShowConflictWizard}
        onResolve={resolveQGendaConflicts}
      />
    </Card>
  );
}