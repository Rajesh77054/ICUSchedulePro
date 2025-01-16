import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Shift } from "@/lib/types";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { USERS } from "@/lib/constants";

interface DuplicateShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
}

export function DuplicateShiftsDialog({
  open,
  onOpenChange,
  userId,
}: DuplicateShiftsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: duplicates, isLoading } = useQuery<Shift[]>({
    queryKey: [`/api/shifts/duplicates/${userId}`],
    enabled: open,
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
      queryClient.invalidateQueries({ queryKey: [`/api/shifts/duplicates/${userId}`] });
      toast({
        title: "Success",
        description: "Duplicate shift removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return null;
  }

  const user = USERS.find(u => u.id === userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Shifts for {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!duplicates?.length ? (
            <p className="text-sm text-muted-foreground">No duplicate shifts found.</p>
          ) : (
            duplicates.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between p-4 border rounded-lg"
                style={{ borderColor: user?.color }}
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {format(new Date(shift.startDate), 'MMM d, yyyy')} -{' '}
                    {format(new Date(shift.endDate), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Shift ID: {shift.id}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => deleteShift(shift.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}