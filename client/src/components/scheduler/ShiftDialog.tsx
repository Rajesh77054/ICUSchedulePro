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
import { detectShiftConflicts } from "@/lib/utils";
import type { Shift, User } from "@/lib/types";
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

  // Fetch users from API
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  // Get existing shifts for conflict detection
  const { data: existingShifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    queryFn: async () => {
      const res = await fetch("/api/shifts");
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    }
  });

  const { mutate: createShift } = useMutation({
    mutationFn: async (data: Partial<Shift>) => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const jsonResponse = await res.json();

      if (!res.ok) {
        // Handle detailed error response
        if (jsonResponse.details) {
          if (typeof jsonResponse.details === 'object') {
            // Handle field-specific errors
            const errorMessages = Object.entries(jsonResponse.details)
              .filter(([_, message]) => message !== null)
              .map(([field, message]) => `${field}: ${message}`)
              .join('\n');
            throw new Error(errorMessages);
          } else {
            throw new Error(jsonResponse.details);
          }
        }
        throw new Error(jsonResponse.error || 'Failed to create shift');
      }

      return jsonResponse;
    },
    onSuccess: async (response) => {
      // Handle the new success response format
      if (response.success && response.shift) {
        // Cancel any outgoing queries first
        await queryClient.cancelQueries({ queryKey: ["/api/shifts"] });

        // Update the cache immediately
        queryClient.setQueryData(["/api/shifts"], (oldData: Shift[] = []) => {
          return [...oldData, response.shift];
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
          description: response.message || "Shift created successfully",
        });
      }
    },
    onError: (error: Error) => {
      console.error('Shift creation error:', error);
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

    const newShift: Partial<Shift> = {
      userId: parseInt(userId),
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      status: 'confirmed' as const,
      source: 'manual',
      schedulingNotes: {}
    };

    // Check for schedule rule violations
    const conflicts = detectShiftConflicts(
      newShift as Shift, 
      existingShifts,
      undefined,
      {
        preferredStrategy: 'minimize-changes',
        allowSplitShifts: false,
        maxShiftAdjustment: 2
      }
    );

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
                {users.map(user => (
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