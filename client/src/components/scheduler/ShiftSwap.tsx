import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Shift, SwapRequest } from "@/lib/types";

interface ShiftSwapProps {
  shift: Shift;
}

export function ShiftSwap({ shift }: ShiftSwapProps) {
  const [recipientId, setRecipientId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: requestSwap } = useMutation({
    mutationFn: async (data: Partial<SwapRequest>) => {
      const res = await fetch("/api/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to request swap");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "Shift swap requested successfully",
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

  const handleSwapRequest = () => {
    if (!recipientId) return;
    requestSwap({
      shiftId: shift.id,
      requestorId: shift.providerId,
      recipientId: parseInt(recipientId),
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Request Swap
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={recipientId} onValueChange={setRecipientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.filter(p => p.id !== shift.providerId).map(provider => (
                <SelectItem key={provider.id} value={provider.id.toString()}>
                  {provider.name}, {provider.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSwapRequest} disabled={!recipientId}>
            Send Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
