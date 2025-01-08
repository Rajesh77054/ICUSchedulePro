import { useState, useRef } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRightLeft, Trash2 } from "lucide-react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { PROVIDERS, HOLIDAYS_2024_2025 } from "@/lib/constants";
import type { Shift } from "@/lib/types";
import { ShiftDialog } from "./ShiftDialog";
import { useToast } from "@/hooks/use-toast";
import { detectShiftConflicts } from "@/lib/utils";
import { ConflictVisualizer } from "./ConflictVisualizer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ShiftSwap } from "./ShiftSwap";
import { OverlappingShiftsDialog } from "./OverlappingShiftsDialog";

type CalendarView = 'dayGridWeek' | 'dayGridMonth' | 'multiMonth';

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
                  onClose();
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
  const [view, setView] = useState<CalendarView>('dayGridWeek');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date }>();
  const [activeConflicts, setActiveConflicts] = useState<{
    shift: Shift;
    conflicts: ReturnType<typeof detectShiftConflicts>;
  } | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [overlappingShifts, setOverlappingShifts] = useState<Shift[]>([]);
  const [overlappingShiftsOpen, setOverlappingShiftsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

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
      setActiveConflicts(null);
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
      setDeleteConfirmOpen(false);
      setShiftToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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

    // If there's an active conflict, clear it and revert
    if (activeConflicts) {
      setActiveConflicts(null);
      dropInfo.revert();
      return;
    }

    const updatedShift: Shift = {
      ...shift,
      startDate: format(dropInfo.event.start, 'yyyy-MM-dd'),
      endDate: format(dropInfo.event.end || dropInfo.event.start, 'yyyy-MM-dd'),
    };

    // Check for conflicts with other shifts, excluding the current shift
    const conflicts = detectShiftConflicts(updatedShift, (shifts || []).filter(s => s.id !== shift.id));
    if (conflicts.length > 0) {
      setActiveConflicts({ shift: updatedShift, conflicts });
      dropInfo.revert();
      return;
    }

    setActiveConflicts(null);

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

    // If there's an active conflict, clear it and revert
    if (activeConflicts) {
      setActiveConflicts(null);
      resizeInfo.revert();
      return;
    }

    if (
      format(resizeInfo.event.start, 'yyyy-MM-dd') === shift.startDate &&
      format(resizeInfo.event.end, 'yyyy-MM-dd') === shift.endDate
    ) {
      resizeInfo.revert();
      return;
    }

    const updatedShift: Shift = {
      ...shift,
      startDate: format(resizeInfo.event.start, 'yyyy-MM-dd'),
      endDate: format(resizeInfo.event.end || resizeInfo.event.start, 'yyyy-MM-dd'),
    };

    // Check for conflicts with other shifts, excluding the current shift
    const conflicts = detectShiftConflicts(updatedShift, (shifts || []).filter(s => s.id !== shift.id));
    if (conflicts.length > 0) {
      setActiveConflicts({ shift: updatedShift, conflicts });
      resizeInfo.revert();
      return;
    }

    setActiveConflicts(null);

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
    }
  };

  const handleEventMouseLeave = () => {
    setActiveConflicts(null);
  };

  const handleDelete = (shift: Shift) => {
    setShiftToDelete(shift);
    setDeleteConfirmOpen(true);
  };

  const renderEventContent = (eventInfo: any) => {
    const shift: Shift = eventInfo.event.extendedProps.shift;
    return (
      <ContextMenu>
        <ContextMenuTrigger
          className="block w-full h-full cursor-context-menu"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onAuxClick={(e) => {
            if (e.button === 2) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div
            className="p-1 select-none"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onAuxClick={(e) => {
              if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {eventInfo.event.title}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="w-48 z-50"
          onContextMenu={(e) => e.preventDefault()}
        >
          <ContextMenuItem onClick={() => setSwapShift(shift)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Request Swap
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleDelete(shift)}
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
    return false;
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
        <div className="h-[600px] relative [&_.fc-toolbar-title]:text-base [&_.fc-col-header-cell-cushion]:text-sm [&_.fc-daygrid-day-number]:text-sm [&_.fc-multimonth-title]:font-medium [&_.fc-multimonth-title]:!py-2 [&_.fc-multimonth-title]:!px-4 [&_.fc-multimonth-title]:!text-base [&_.fc-multimonth]:gap-6">
          {activeConflicts && (
            <ConflictVisualizer
              shift={activeConflicts.shift}
              conflicts={activeConflicts.conflicts}
            />
          )}
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
            eventSources={[
              {
                events: backgroundEvents,
              }
            ]}
            initialDate={date}
            weekends={true}
            firstDay={0}
            height="100%"
            dayMaxEvents={true}
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
            businessHours={{
              dows: [0, 1, 2, 3, 4, 5, 6],
              startTime: '07:00',
              endTime: '19:00',
            }}
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
      {selectedShift && (
        <ShiftDetails
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onSwapRequest={() => setSwapShift(selectedShift)}
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
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
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
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setShiftToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => shiftToDelete && deleteShift(shiftToDelete.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}