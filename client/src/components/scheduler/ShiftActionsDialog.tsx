import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Shift, User } from "@/lib/types";

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

  // Fetch users for swap selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Delete shift mutation
  const { mutate: deleteShift, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      if (!shift) return;
      const res = await fetch(`/api/shifts/${shift.id}`, {
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

  // Request shift swap mutation
  const { mutate: requestSwap, isPending: isRequesting } = useMutation({
    mutationFn: async (targetUserId: number) => {
      if (!shift) return;
      const res = await fetch(`/api/shifts/${shift.id}/swap-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw new Error("Failed to request shift swap");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "Shift swap request sent successfully",
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

  const handleSwapRequest = (targetUserId: string) => {
    requestSwap(parseInt(targetUserId));
  };

  if (!shift) return null;

  const assignedUser = users.find(u => u.id === shift.userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Shift</DialogTitle>
          <DialogDescription>
            {assignedUser?.name}'s shift from {new Date(shift.startDate).toLocaleDateString()} to{" "}
            {new Date(shift.endDate).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Request Shift Swap</Label>
            <Select onValueChange={handleSwapRequest}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider to swap with" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(u => u.id !== shift.userId)
                  .map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting || isRequesting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteShift()}
            disabled={isDeleting || isRequesting}
          >
            {isDeleting ? "Deleting..." : "Delete Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
