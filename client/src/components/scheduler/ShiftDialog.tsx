import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
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
import { useToast } from "@/hooks/use-toast";
import { PROVIDERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";
import { format } from "date-fns";

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date;
  endDate: Date;
}

export function ShiftDialog({ open, onOpenChange, startDate, endDate }: ShiftDialogProps) {
  const [providerId, setProviderId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: createShift } = useMutation({
    mutationFn: async (data: Partial<Shift>) => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "Shift created successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateShift = () => {
    if (!providerId) return;
    createShift({
      providerId: parseInt(providerId),
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Date Range</p>
            <p className="text-sm text-muted-foreground">
              {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Provider</label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(provider => (
                  <SelectItem key={provider.id} value={provider.id.toString()}>
                    {provider.name}, {provider.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreateShift} disabled={!providerId} className="w-full">
            Create Shift
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
