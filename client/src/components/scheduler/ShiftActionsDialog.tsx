import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Shift } from "@/lib/types";
import { ShiftSwap } from "./ShiftSwap";

interface ShiftActionsDialogProps {
  shift: Shift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftActionsDialog({
  shift,
  open,
  onOpenChange,
}: ShiftActionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Delete shift mutation
  const { mutate: deleteShift, isPending: isDeleting } = useMutation({
    mutationFn: async (shiftId: number) => {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to delete shift");
      }
      return shiftId;
    },
    onMutate: async (shiftId: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/shifts"] });

      // Get snapshot of previous data
      const previousShifts = queryClient.getQueryData(["/api/shifts"]);

      // Optimistically update shifts cache
      queryClient.setQueryData(["/api/shifts"], (old: any[] = []) => {
        return old.filter(s => s.id !== shiftId);
      });

      return { previousShifts };
    },
    onSuccess: async () => {
      // Force immediate invalidation and refetch
      await queryClient.invalidateQueries({
        queryKey: ["/api/shifts"],
        refetchType: 'all',
        exact: false
      });

      // Clear all shift-related data from cache
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === "/api/shifts"
      });

      // Force calendar refresh
      window.dispatchEvent(new Event('forceCalendarRefresh'));

      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
      onOpenChange(false);
    },
    onError: (err: Error, _: number, context: any) => {
      // Rollback on error
      if (context?.previousShifts) {
        queryClient.setQueryData(["/api/shifts"], context.previousShifts);
      }
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!shift) return null;

  const handleDelete = () => {
    if (!shift?.id) return;
    deleteShift(shift.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Shift</DialogTitle>
          <DialogDescription>
            Shift from {new Date(shift.startDate).toLocaleDateString()} to{" "}
            {new Date(shift.endDate).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <ShiftSwap 
            shift={shift} 
            onClose={() => onOpenChange(false)} 
          />

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Shift"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}