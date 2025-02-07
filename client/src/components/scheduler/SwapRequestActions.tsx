import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import type { SwapRequest } from "@/lib/types";

interface SwapRequestActionsProps {
  request: SwapRequest;
  currentUserId?: number; // Add currentUserId prop to determine user role
  onClose?: () => void;
}

export function SwapRequestActions({ request, currentUserId, onClose }: SwapRequestActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to invalidate and refetch all related queries
  const invalidateAndRefetchQueries = async () => {
    const queryKeys = [
      ['/api/shifts'],
      ['/api/swap-requests'],
      ['/api/swap-requests', request.requestorId],
      ['/api/swap-requests', request.recipientId],
      ['/api/shifts', request.requestorId],
      ['/api/shifts', request.recipientId],
    ];

    await Promise.all(
      queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
    );

    await Promise.all(
      queryKeys.map(key => queryClient.refetchQueries({ queryKey: key }))
    );
  };

  const { mutate: respondToRequest, isPending } = useMutation({
    mutationFn: async ({ status }: { status: 'accepted' | 'rejected' }) => {
      console.log('Responding to swap request:', { requestId: request.id, status });
      const res = await fetch(`/api/swap-requests/${request.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const text = await res.text();
        let error;
        try {
          const json = JSON.parse(text);
          error = json.message || 'Failed to respond to swap request';
        } catch (e) {
          error = text || 'Failed to respond to swap request';
        }
        throw new Error(error);
      }

      return res.json().catch(() => ({ success: true }));
    },
    onSuccess: async (_, { status }) => {
      await invalidateAndRefetchQueries();

      toast({
        title: 'Success',
        description: `Successfully ${status} the shift swap request.`,
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

      if (!res.ok) {
        const text = await res.text();
        let error;
        try {
          const json = JSON.parse(text);
          error = json.message || 'Failed to cancel request';
        } catch (e) {
          error = text || 'Failed to cancel request';
        }
        throw new Error(error);
      }

      return res.json().catch(() => ({ success: true }));
    },
    onSuccess: async () => {
      await invalidateAndRefetchQueries();

      toast({
        title: 'Success',
        description: 'Swap request cancelled successfully',
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

  // Check if current user is the requestor
  const isRequestor = currentUserId === request.requestorId;
  // Check if current user is the requestee
  const isRequestee = currentUserId === request.recipientId;
  // If no currentUserId is provided, assume it's admin view
  const isAdminView = !currentUserId;

  if (request.status !== 'pending') {
    return null; // Don't show any actions for non-pending requests
  }

  return (
    <div className="flex items-center gap-2">
      {/* Show Cancel button only for requestor */}
      {isRequestor && (
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
          {isCanceling ? 'Canceling...' : 'Cancel Request'}
        </Button>
      )}

      {/* Show Accept/Reject buttons only for requestee or admin */}
      {(isRequestee || isAdminView) && (
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
        </>
      )}
    </div>
  );
}