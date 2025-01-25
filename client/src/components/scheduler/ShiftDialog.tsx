import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { USERS } from "@/lib/constants";
import { detectShiftConflicts } from "@/lib/utils";
import type { Shift } from "@/lib/types";
import { format } from "date-fns";

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date;
  endDate: Date;
}

export function ShiftDialog({ open, onOpenChange, startDate, endDate }: ShiftDialogProps) {
  const [userId, setUserId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: createShift } = useMutation({
    mutationFn: async (data: Partial<Shift>) => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create shift');
      }

      return res.json();
    },
    onSuccess: async (newShift) => {
      // Cancel any outgoing queries first
      await queryClient.cancelQueries({ queryKey: ["/api/shifts"] });

      // Update the cache immediately
      queryClient.setQueryData(["/api/shifts"], (oldData: Shift[] = []) => {
        return [...oldData, newShift];
      });

      // Force a refresh of all shift-related queries
      await queryClient.invalidateQueries({
        queryKey: ["/api/shifts"],
        refetchType: 'all',
        exact: false
      });

      // Trigger calendar refresh
      window.dispatchEvent(new Event('forceCalendarRefresh'));

      onOpenChange(false);
      toast({
        title: "Success",
        description: "Shift created successfully",
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

  const handleCreateShift = () => {
    if (!userId) {
      toast({
        title: "Validation Error",
        description: "Please select a healthcare provider",
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    // Get existing shifts for conflict detection
    const existingShifts = queryClient.getQueryData<Shift[]>(["/api/shifts"]) || [];

    const newShift = {
      userId: parseInt(userId),
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      status: 'confirmed',
      source: 'manual',
      schedulingNotes: {}
    };

    const { data: userPrefs } = useQuery({
      queryKey: ["/api/user-preferences", newShift.userId],
      queryFn: async () => {
        const res = await fetch(`/api/user-preferences/${newShift.userId}`);
        if (!res.ok) throw new Error("Failed to fetch preferences");
        return res.json();
      },
      enabled: !!newShift.userId
    });

    // Check for schedule rule violations
    const conflicts = detectShiftConflicts(newShift, existingShifts, userPrefs);

    if (conflicts.length > 0) {
      toast({
        title: "Schedule Rule Violation",
        description: conflicts.map(c => c.message).join("\n"),
        variant: "destructive"
      });
      return;
    }

    // Create shift if no conflicts
    createShift(newShift);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Shift</DialogTitle>
          <DialogDescription>
            Select a healthcare provider for this shift period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Date Range</p>
            <p className="text-sm text-muted-foreground">
              {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Healthcare Provider</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select healthcare provider" />
              </SelectTrigger>
              <SelectContent>
                {USERS.map(user => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}, {user.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreateShift} disabled={!userId} className="w-full">
            Create Shift
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}