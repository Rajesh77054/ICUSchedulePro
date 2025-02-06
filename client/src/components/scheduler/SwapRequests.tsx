import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SwapRequest } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SwapRequestActions } from "./SwapRequestActions";

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
    queryKey: ['/api/swap-requests', userId],
    queryFn: async () => {
      try {
        const url = new URL('/api/swap-requests', window.location.origin);
        if (userId) {
          url.searchParams.append('userId', userId.toString());
        }

        const res = await fetch(url);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || 'Failed to fetch swap requests');
        }
        return res.json();
      } catch (error) {
        console.error('Error fetching swap requests:', error);
        throw error;
      }
    },
    staleTime: 1000, // Consider data fresh for 1 second
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  // Filter requests based on user role and variant
  const filteredRequests = swapRequests?.filter(request => {
    if (!userId) return true; // Show all if no userId
    if (variant === 'dashboard') {
      // For dashboard, show pending requests where user is either recipient or requestor
      const isParticipant = request.recipientId === userId || request.requestorId === userId;
      const isPending = request.status === 'pending';
      return isParticipant && isPending;
    }
    // For sidebar, show all requests involving the user, regardless of status
    return request.recipientId === userId || request.requestorId === userId;
  });

  // Sort requests by creation date, most recent first
  const sortedRequests = [...(filteredRequests || [])].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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
                {/* Use SwapRequestActions component for all actions */}
                <SwapRequestActions request={request} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}