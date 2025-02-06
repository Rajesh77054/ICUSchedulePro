import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import type { SwapRequest } from "@/lib/types";

interface SwapRequestActionsProps {
  request: SwapRequest;
  onClose?: () => void;
}

export function SwapRequestActions({ request, onClose }: SwapRequestActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: respondToRequest, isPending } = useMutation({
    mutationFn: async ({ status }: { status: 'accepted' | 'rejected' }) => {
      const res = await fetch(`/api/swap-requests/${request.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        // Try to parse error as JSON first
        const errorText = await res.text();
        let errorMessage = 'Failed to respond to swap request';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use the raw error text
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      // Only try to parse JSON if response is ok
      try {
        return await res.json();
      } catch (e) {
        throw new Error('Invalid response format from server');
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] });

      toast({
        title: 'Success',
        description: `Swap request ${status === 'accepted' ? 'accepted' : 'rejected'} successfully`,
      });

      if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { mutate: cancelRequest, isPending: isCanceling } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/swap-requests/${request.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Try to parse error as JSON first
        const errorText = await res.text();
        let errorMessage = 'Failed to cancel request';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use the raw error text
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      // Only try to parse JSON if response is ok
      try {
        return await res.json();
      } catch (e) {
        throw new Error('Invalid response format from server');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] });

      toast({
        title: 'Success',
        description: 'Swap request cancelled successfully',
      });

      if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="flex items-center gap-2">
      {request.status === 'pending' && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => respondToRequest({ status: 'accepted' })}
            disabled={isPending || isCanceling}
          >
            <Check className="h-4 w-4" />
            {isPending ? 'Processing...' : 'Accept'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => respondToRequest({ status: 'rejected' })}
            disabled={isPending || isCanceling}
          >
            <X className="h-4 w-4" />
            {isPending ? 'Processing...' : 'Reject'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1"
            onClick={() => {
              if (confirm('Are you sure you want to cancel this swap request?')) {
                cancelRequest();
              }
            }}
            disabled={isPending || isCanceling}
          >
            <X className="h-4 w-4" />
            {isCanceling ? 'Canceling...' : 'Cancel'}
          </Button>
        </>
      )}
    </div>
  );
}