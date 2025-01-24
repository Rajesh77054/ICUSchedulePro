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
        const errorData = await res.json().catch(() => ({ error: "Failed to delete shift" }));
        throw new Error(errorData.error || "Failed to delete shift");
      }
      await res.json();
      return shift.id;
    },
    onSuccess: (deletedShiftId) => {
      queryClient.setQueryData(["/api/shifts"], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((s: any) => s.id !== deletedShiftId);
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.refetchQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
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