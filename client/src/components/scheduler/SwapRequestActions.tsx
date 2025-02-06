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

      let responseData;
      try {
        // Try to get response as text first
        const text = await res.text();

        // Then try to parse it as JSON if possible
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          // If it's not JSON, use the text as is
          responseData = { message: text };
        }
      } catch (e) {
        throw new Error('Could not read server response');
      }

      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to respond to swap request');
      }

      return responseData;
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

      let responseData;
      try {
        // Try to get response as text first
        const text = await res.text();

        // Then try to parse it as JSON if possible
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          // If it's not JSON, use the text as is
          responseData = { message: text };
        }
      } catch (e) {
        throw new Error('Could not read server response');
      }

      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to cancel request');
      }

      return responseData;
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