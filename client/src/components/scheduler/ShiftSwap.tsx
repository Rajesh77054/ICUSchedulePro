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
import type { Shift, SwapRequest } from "@/lib/types";
import { AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { getSwapRecommendations } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";


interface ShiftSwapProps {
  shift: Shift;
  onClose: () => void;
}

export function ShiftSwap({ shift, onClose }: ShiftSwapProps) {
  const [recipientId, setRecipientId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = USERS.find(u => u.id === shift.userId);

  // Use consistent query keys
  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: swapHistory = [] } = useQuery<SwapRequest[]>({
    queryKey: ["/api/swap-requests"],
  });

  const { mutate: requestSwap, isPending: isSubmitting } = useMutation({
    mutationFn: async () => {
      if (!recipientId || !shift) {
        throw new Error("Missing required data for swap request");
      }

      const recipient = USERS.find(u => u.id === parseInt(recipientId));

      if (!recipient || !currentUser) {
        throw new Error('Invalid user selection');
      }

      // Validate user types match
      if (recipient.userType !== currentUser.userType) {
        throw new Error(`Cannot swap shifts between different provider types (${currentUser.userType} and ${recipient.userType})`);
      }

      console.log('Submitting swap request:', {
        shiftId: shift.id,
        requestorId: shift.userId,
        recipientId: parseInt(recipientId),
        shift: {
          id: shift.id,
          startDate: shift.startDate,
          endDate: shift.endDate,
          userId: shift.userId
        }
      });

      const res = await fetch("/api/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          requestorId: shift.userId,
          recipientId: parseInt(recipientId),
          shift: {
            id: shift.id,
            startDate: shift.startDate,
            endDate: shift.endDate,
            userId: shift.userId
          }
        }),
      });

      const text = await res.text();
      console.log('Server response:', text);

      if (!res.ok) {
        let error;
        try {
          const json = JSON.parse(text);
          error = json.message || 'Failed to request swap';
        } catch (e) {
          error = text || 'Failed to request swap';
        }
        throw new Error(error);
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        return { message: text };
      }
    },
    onSuccess: (data) => {
      console.log('Swap request successful:', data);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] });

      // Force refetch to ensure data is fresh
      queryClient.refetchQueries({ queryKey: ["/api/swap-requests"] });

      toast({
        title: "Success",
        description: "Shift swap requested successfully. The recipient will be notified.",
      });
      onClose();
    },
    onError: (error: Error) => {
      console.error('Swap request error:', error);
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

    requestSwap();
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

        <Select value={recipientId} onValueChange={setRecipientId}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${currentUser?.userType.toUpperCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {eligibleUsers.map(user => (
              <SelectItem key={user.id} value={user.id.toString()}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>{user.name}, {user.title}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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