import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { USERS } from "@/lib/constants";
import type { Shift, SwapRequest, User, Preference } from "@/lib/types";
import { format } from "date-fns";
import { getSwapRecommendations } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Info } from "lucide-react";
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
  const currentUser = USERS.find(u => u.id === shift.userId);

  const { data: shifts = [], isLoading: isLoadingShifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: timeOffRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests"],
  });

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  const { data: swapHistory = [] } = useQuery<SwapRequest[]>({
    queryKey: ["/api/swap-requests"],
  });

  const { data: preferences = [] } = useQuery<Preference[]>({
    queryKey: ["/api/provider-preferences"],
  });

  const recommendations = getSwapRecommendations(
    shift,
    shifts,
    timeOffRequests,
    holidays,
    swapHistory,
    preferences || []
  );

  const { mutate: requestSwap, isPending: isSubmitting } = useMutation({
    mutationFn: async (data: Partial<SwapRequest>) => {
      const recipient = USERS.find(u => u.id === parseInt(recipientId!));

      if (!recipient || !currentUser) {
        throw new Error('Invalid user selection');
      }

      // Validate user types match
      if (recipient.userType !== currentUser.userType) {
        throw new Error(`Cannot swap shifts between different provider types (${currentUser.userType} and ${recipient.userType})`);
      }

      const res = await fetch("/api/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          requestorId: shift.userId,
          recipientId: parseInt(recipientId!),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to request swap");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] });

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
    if (!recipientId || !shift) {
      toast({
        title: "Error",
        description: "Please select a user to swap with",
        variant: "destructive",
      });
      return;
    }

    requestSwap({
      shiftId: shift.id,
      requestorId: shift.userId,
      recipientId: parseInt(recipientId),
    });
  };

  const getProviderRecommendation = (userId: number) => {
    return recommendations?.find(r => r.userId === userId);
  };

  // Filter users to only show those of the same type
  const eligibleUsers = USERS.filter(user => 
    user.id !== shift.userId && 
    currentUser && user.userType === currentUser.userType
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Swap with {currentUser?.userType.toUpperCase()}</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">Only providers of the same type ({currentUser?.userType.toUpperCase()}) are shown to ensure proper coverage</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {isLoadingShifts ? (
          <div className="text-sm text-muted-foreground">Loading users...</div>
        ) : (
          <Select value={recipientId} onValueChange={setRecipientId}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${currentUser?.userType.toUpperCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {eligibleUsers.map(user => {
                const recommendation = getProviderRecommendation(user.id);
                return (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span>{user.name}, {user.title}</span>
                        <span className="text-xs text-muted-foreground">
                          Match Score: {recommendation?.score || 0}%
                        </span>
                      </div>
                      <Progress 
                        value={recommendation?.score || 0} 
                        className="h-1"
                        style={{
                          backgroundColor: `${user.color}40`,
                          "--progress-background": user.color,
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

      {eligibleUsers.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No eligible {currentUser?.userType.toUpperCase()}s available for swap. Shifts can only be swapped between providers of the same type.
          </AlertDescription>
        </Alert>
      )}

      <Button 
        onClick={handleSwapRequest} 
        disabled={!recipientId || isSubmitting || eligibleUsers.length === 0} 
        className="w-full"
      >
        {isSubmitting ? "Sending Request..." : "Request Swap"}
      </Button>
    </div>
  );
}