import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SwapRequest } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  userId?: number;
  variant?: 'dashboard' | 'sidebar';
}

export function SwapRequests({ userId, variant = 'dashboard' }: Props) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch swap requests, including ones where the user is either requestor or recipient
  const { data: swapRequests, isLoading } = useQuery<SwapRequest[]>({
    queryKey: [`/api/swap-requests${userId ? `?userId=${userId}` : ''}`],
    queryFn: async () => {
      const res = await fetch(`/api/swap-requests${userId ? `?userId=${userId}` : ''}`);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch swap requests');
      }
      return res.json();
    }
  });

  const { mutate: respondToSwap, isPending: isResponding } = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: 'accepted' | 'rejected' }) => {
      setError(null);
      const res = await fetch(`/api/swap-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to respond to swap request');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] });
      toast({
        title: 'Success',
        description: `Successfully ${variables.status} the shift swap request.`,
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { mutate: cancelSwap, isPending: isCancelling } = useMutation({
    mutationFn: async (requestId: number) => {
      setError(null);
      const res = await fetch(`/api/swap-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to cancel swap request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] });
      toast({
        title: 'Success',
        description: 'Successfully cancelled the shift swap request.',
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shift Swap Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            Loading requests...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter requests based on user role and variant
  const filteredRequests = swapRequests?.filter(request => {
    if (!userId) return true; // Show all if no userId
    if (variant === 'dashboard') {
      // For dashboard, show pending requests where user is either recipient or requestor
      return (request.recipientId === userId || request.requestorId === userId) && 
             request.status === 'pending';
    }
    // For sidebar, show all requests involving the user, regardless of status
    return request.recipientId === userId || request.requestorId === userId;
  });

  // Sort requests by creation date, most recent first
  const sortedRequests = [...(filteredRequests || [])].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (!sortedRequests?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shift Swap Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No pending swap requests
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift Swap Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          {sortedRequests.map((request) => (
            <div 
              key={request.id} 
              className="p-4 border rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {request.requestor.name} requested to swap shift with {request.recipient.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(request.shift.startDate), 'MMM d')} - {format(new Date(request.shift.endDate), 'MMM d')}
                  </p>
                  {request.status !== 'pending' && (
                    <p className="text-sm font-medium mt-1 capitalize text-muted-foreground">
                      Status: {request.status}
                    </p>
                  )}
                </div>
                {userId === request.recipientId && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => respondToSwap({ 
                        requestId: request.id,
                        status: 'accepted'
                      })}
                      disabled={isResponding || isCancelling}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {isResponding ? 'Processing...' : 'Accept'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => respondToSwap({ 
                        requestId: request.id,
                        status: 'rejected'
                      })}
                      disabled={isResponding || isCancelling}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {isResponding ? 'Processing...' : 'Decline'}
                    </Button>
                  </div>
                )}
                {userId === request.requestorId && request.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelSwap(request.id)}
                    disabled={isResponding || isCancelling}
                  >
                    <X className="h-4 w-4 mr-1" />
                    {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}