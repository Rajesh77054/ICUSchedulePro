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
      console.log('Responding to swap request:', { requestId: request.id, status });
      const res = await fetch(`/api/swap-requests/${request.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const text = await res.text();
      console.log('Server response:', text);

      if (!res.ok) {
        let error;
        try {
          const json = JSON.parse(text);
          error = json.message || 'Failed to respond to swap request';
        } catch (e) {
          error = text || 'Failed to respond to swap request';
        }
        throw new Error(error);
      }

      if (!text) {
        return { success: true };
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        return { message: text };
      }
    },
    onSuccess: (_, { status }) => {
      // Invalidate all related queries to force refetch
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] });

      // Force immediate refetch
      Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/shifts'] }),
        queryClient.refetchQueries({ queryKey: ['/api/swap-requests'] }),
      ]).then(() => {
        toast({
          title: 'Success',
          description: `Swap request ${status === 'accepted' ? 'accepted' : 'rejected'} successfully`,
        });
      });

      if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      console.error('Swap request action error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { mutate: cancelRequest, isPending: isCanceling } = useMutation({
    mutationFn: async () => {
      console.log('Canceling swap request:', request.id);
      const res = await fetch(`/api/swap-requests/${request.id}`, {
        method: 'DELETE',
      });

      const text = await res.text();
      console.log('Server response:', text);

      if (!res.ok) {
        let error;
        try {
          const json = JSON.parse(text);
          error = json.message || 'Failed to cancel request';
        } catch (e) {
          error = text || 'Failed to cancel request';
        }
        throw new Error(error);
      }

      if (!text) {
        return { success: true };
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        return { message: text };
      }
    },
    onSuccess: () => {
      // Invalidate and force immediate refetch of all related queries
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] }),
        queryClient.refetchQueries({ queryKey: ['/api/shifts'] }),
        queryClient.refetchQueries({ queryKey: ['/api/swap-requests'] }),
      ]).then(() => {
        toast({
          title: 'Success',
          description: 'Swap request cancelled successfully',
        });
      });

      if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      console.error('Cancel request error:', error);
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