import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { USERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";

interface OverlappingShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: Shift[];
  onShiftUpdate: (shift: Shift) => void;
}

export function OverlappingShiftsDialog({
  open,
  onOpenChange,
  shifts,
  onShiftUpdate,
}: OverlappingShiftsDialogProps) {
  const [editingShift, setEditingShift] = useState<{
    shift: Shift;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  const handleEdit = (shift: Shift) => {
    setEditingShift({
      shift,
      startDate: new Date(shift.startDate),
      endDate: new Date(shift.endDate),
    });
  };

  const handleUpdate = () => {
    if (!editingShift) return;

    onShiftUpdate({
      ...editingShift.shift,
      startDate: format(editingShift.startDate, 'yyyy-MM-dd'),
      endDate: format(editingShift.endDate, 'yyyy-MM-dd'),
    });
    setEditingShift(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Overlapping Shifts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {shifts.map((shift) => {
            const user = USERS.find(u => u.id === shift.userId);
            const isEditing = editingShift?.shift.id === shift.id;

            return (
              <div
                key={shift.id}
                className="p-4 border rounded-lg space-y-2"
                style={{ borderColor: user?.color }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {user?.name}, {user?.title}
                  </span>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(shift)}
                    >
                      Edit Dates
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Start Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !editingShift.startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingShift.startDate ? (
                              format(editingShift.startDate, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editingShift.startDate}
                            onSelect={(date) =>
                              date && setEditingShift({
                                ...editingShift,
                                startDate: date
                              })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">End Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !editingShift.endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingShift.endDate ? (
                              format(editingShift.endDate, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editingShift.endDate}
                            onSelect={(date) =>
                              date && setEditingShift({
                                ...editingShift,
                                endDate: date
                              })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditingShift(null)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleUpdate}>
                        Update
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(shift.startDate), 'MMM d, yyyy')} -{' '}
                    {format(new Date(shift.endDate), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}