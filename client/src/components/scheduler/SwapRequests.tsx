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

  // Fetch swap requests with consistent error handling
  const { data: swapRequests, isLoading } = useQuery<SwapRequest[]>({
    queryKey: ['/api/swap-requests', userId],
    queryFn: async () => {
      try {
        const url = new URL('/api/swap-requests', window.location.origin);
        if (userId) {
          url.searchParams.append('userId', userId.toString());
        }

        console.log('Fetching swap requests:', url.toString());
        const res = await fetch(url);

        // Check content type to ensure we're getting JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Invalid content type:', contentType);
          const text = await res.text();
          console.error('Response body:', text);
          throw new Error('Server returned invalid content type');
        }

        if (!res.ok) {
          const text = await res.text();
          let error;
          try {
            const json = JSON.parse(text);
            error = json.message;
          } catch (e) {
            error = text;
          }
          throw new Error(error || 'Failed to fetch swap requests');
        }

        const data = await res.json();
        console.log('Received swap requests:', data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching swap requests:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch swap requests');
        return [];
      }
    },
    staleTime: 1000,
    refetchInterval: 5000,
    retry: false // Disable retries to prevent flooding on error
  });

  // Filter requests based on user role and variant
  const filteredRequests = swapRequests?.filter(request => {
    if (!userId) return true; // Show all for admin view
    const isParticipant = request.recipientId === userId || request.requestorId === userId;
    return isParticipant;
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

  const getRequestorName = (request: SwapRequest) => {
    return request.requestor?.name || `User ${request.requestorId}`;
  };

  const getRecipientName = (request: SwapRequest) => {
    return request.recipient?.name || `User ${request.recipientId}`;
  };

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

        {!sortedRequests?.length ? (
          <div className="text-center text-muted-foreground">
            No swap requests found
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRequests.map((request) => (
              <div 
                key={request.id} 
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {getRequestorName(request)} requested to swap shift with {getRecipientName(request)}
                    </p>
                    {request.shift && (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.shift.startDate), 'MMM d')} - {format(new Date(request.shift.endDate), 'MMM d')}
                      </p>
                    )}
                    <p className="text-sm font-medium mt-1 capitalize text-muted-foreground">
                      Status: {request.status || 'pending'}
                    </p>
                  </div>
                  <SwapRequestActions 
                    request={request} 
                    currentUserId={userId} // Pass the userId as currentUserId
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}