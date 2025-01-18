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
        const error = await res.text();
        throw new Error(error);
      }

      return res.json();
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

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => respondToRequest({ status: 'accepted' })}
        disabled={isPending || request.status !== 'pending'}
      >
        <Check className="h-4 w-4" />
        Accept
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => respondToRequest({ status: 'rejected' })}
        disabled={isPending || request.status !== 'pending'}
      >
        <X className="h-4 w-4" />
        Reject
      </Button>
    </div>
  );
}
