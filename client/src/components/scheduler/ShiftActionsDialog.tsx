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
    mutationFn: async () => {
      if (!shift) throw new Error("No shift selected");
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to delete shift");
      }
      return shift.id;
    },
    onMutate: async () => {
      if (!shift) return;
      
      // Cancel any ongoing queries
      await queryClient.cancelQueries({ queryKey: ["/api/shifts"] });
      
      // Get the current shifts
      const previousShifts = queryClient.getQueryData(["/api/shifts"]);
      
      // Optimistically remove the shift
      queryClient.setQueryData(["/api/shifts"], (old: any[]) => 
        old?.filter(s => s.id !== shift.id) ?? []
      );
      
      return { previousShifts };
    },
    onSuccess: async () => {
      // Clear cache and force refetch
      queryClient.removeQueries({ queryKey: ["/api/shifts"] });
      await queryClient.fetchQuery({ 
        queryKey: ["/api/shifts"],
        options: { 
          cacheTime: 0,
          staleTime: 0
        }
      });
      
      // Dispatch a custom event to force calendar refresh
      window.dispatchEvent(new Event('forceCalendarRefresh'));
      
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
      onOpenChange(false);
    },
    onError: (err: Error, shiftId: number, context: any) => {
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
              onClick={() => deleteShift()}
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