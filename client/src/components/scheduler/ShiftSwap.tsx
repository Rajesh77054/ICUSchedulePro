import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { AlertCircle, Info, X } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import type { TimeOffRequest, Holiday } from "@/lib/types";

interface ShiftSwapProps {
  shift: Shift;
  onClose: () => void;
}

export function ShiftSwap({ shift, onClose }: ShiftSwapProps) {
  const [recipientId, setRecipientId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading: isLoadingShifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: timeOffRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests"],
  });

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  const { data: swapHistory = [] } = useQuery({
    queryKey: ["/api/swap-requests"],
  });

  const recommendations = getSwapRecommendations(
    shift,
    shifts,
    timeOffRequests,
    holidays,
    swapHistory
  );

  const { mutate: requestSwap, isLoading } = useMutation({
    mutationFn: async (data: Partial<SwapRequest>) => {
      const res = await fetch("/api/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.message || "Failed to request swap");
      }
      return responseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "Shift swap requested successfully. The recipient will be notified.",
      });
      onClose();
    },
    onError: (error: Error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
    },
  });

  const handleSwapRequest = () => {
    if (!recipientId) {
      toast({
        title: "Error",
        description: "Please select a provider to swap with",
        variant: "destructive",
      });
      return;
    }
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
          <DialogDescription>
            Select a provider to swap shifts with. Providers are ranked based on workload balance and schedule compatibility.
          </DialogDescription>
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
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Providers are ranked based on workload balance, schedule compatibility, and policy compliance</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {isLoadingShifts ? (
              <div className="text-sm text-muted-foreground">Loading providers...</div>
            ) : (
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
                          {recommendation?.warnings && recommendation.warnings.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{recommendation.warnings.join(" • ")}</span>
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button 
            onClick={handleSwapRequest} 
            disabled={!recipientId || isLoading} 
            className="w-full"
          >
            {isLoading ? "Sending Request..." : "Send Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}