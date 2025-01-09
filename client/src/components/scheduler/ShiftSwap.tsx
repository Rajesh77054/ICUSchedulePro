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

interface ShiftSwapProps {
  shift: Shift;
  onClose: () => void;
}

export function ShiftSwap({ shift, onClose }: ShiftSwapProps) {
  const [recipientId, setRecipientId] = useState<string>();
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading: isLoadingShifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const recommendations = getSwapRecommendations(shift, shifts);

  const { mutate: requestSwap, isLoading } = useMutation({
    mutationFn: async (data: Partial<SwapRequest>) => {
      const res = await fetch("/api/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();
      if (!res.ok) {
        if (responseData.existingRequest) {
          setExistingRequest(responseData.existingRequest);
        }
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
      if (!existingRequest) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const { mutate: cancelSwap, isLoading: isCancelling } = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch(`/api/swap-requests/${requestId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to cancel swap request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] });
      toast({
        title: "Success",
        description: "Swap request cancelled successfully",
      });
      setExistingRequest(null);
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

  const handleCancelRequest = () => {
    if (existingRequest) {
      cancelSwap(existingRequest.id);
    }
  };

  const getProviderRecommendation = (providerId: number) => {
    return recommendations.find(r => r.providerId === providerId);
  };

  if (existingRequest) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Existing Swap Request</DialogTitle>
            <DialogDescription>
              There is already a pending swap request for this shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Requestor:</span>
                  <span>{existingRequest.requestor.name}, {existingRequest.requestor.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Recipient:</span>
                  <span>{existingRequest.recipient.name}, {existingRequest.recipient.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Shift Period:</span>
                  <span>
                    {format(new Date(existingRequest.shift.startDate), 'MMM d, yyyy')} - {format(new Date(existingRequest.shift.endDate), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                onClick={handleCancelRequest}
                disabled={isCancelling}
              >
                <X className="h-4 w-4 mr-2" />
                {isCancelling ? "Cancelling..." : "Cancel Request"}
              </Button>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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