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
import type { Shift, SwapRequest } from "@/lib/types";
import { format } from "date-fns";
import { getSwapRecommendations } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";

interface ShiftSwapProps {
  shift: Shift;
  onClose: () => void;
}

export function ShiftSwap({ shift, onClose }: ShiftSwapProps) {
  const [recipientId, setRecipientId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const recommendations = shifts ? getSwapRecommendations(shift, shifts) : [];

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
      onClose();
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

  const getProviderRecommendation = (providerId: number) => {
    return recommendations.find(r => r.providerId === providerId);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Shift Period</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(shift.startDate), 'MMM d, yyyy')} - {format(new Date(shift.endDate), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Swap with Provider</label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Providers are ranked based on workload balance, schedule compatibility, and policy compliance</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.filter(p => p.id !== shift.providerId).map(provider => {
                  const recommendation = getProviderRecommendation(provider.id);
                  return (
                    <SelectItem key={provider.id} value={provider.id.toString()}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span>{provider.name}, {provider.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Score: {recommendation?.score || 0}%
                          </span>
                        </div>
                        <Progress 
                          value={recommendation?.score || 0} 
                          className="h-1"
                          style={{
                            backgroundColor: `${provider.color}40`,
                            "--progress-background": provider.color,
                          } as any}
                        />
                        {recommendation?.reasons && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {recommendation.reasons.join(" • ")}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSwapRequest} disabled={!recipientId} className="w-full">
            Send Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}