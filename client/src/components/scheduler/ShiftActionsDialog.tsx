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
import { useState } from "react";

interface ShiftActionsDialogProps {
  shift: Shift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (shiftId: number) => Promise<void>;
}

export function ShiftActionsDialog({
  shift,
  open,
  onOpenChange,
  onDelete,
}: ShiftActionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!shift) return;

    setIsDeleting(true);
    try {
      await onDelete(shift.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error in handleDelete:', error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

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