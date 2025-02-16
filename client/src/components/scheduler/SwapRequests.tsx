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
        const text = await res.text();
        console.log('Raw server response:', text);

        if (!res.ok) {
          throw new Error(text || 'Failed to fetch swap requests');
        }

        // Handle empty response
        if (!text) {
          console.log('Empty response from server');
          return [];
        }

        // Try to parse JSON response
        try {
          const data = JSON.parse(text);
          console.log('Parsed swap requests:', data);

          // Verify and format shift data for each request
          const formattedData = data.map((request: SwapRequest) => {
            console.log('Processing request:', request);

            // Ensure shift data is present and properly formatted
            if (request.shift) {
              console.log('Shift data found:', request.shift);
              try {
                // Parse dates to ensure they're valid
                const startDate = new Date(request.shift.startDate);
                const endDate = new Date(request.shift.endDate);

                return {
                  ...request,
                  shift: {
                    ...request.shift,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                  }
                };
              } catch (e) {
                console.error('Error parsing shift dates:', e);
                return request;
              }
            } else {
              console.log('No shift data found for request:', request.id);
              return request;
            }
          });

          console.log('Formatted swap requests:', formattedData);
          return formattedData;
        } catch (e) {
          console.error('Error parsing swap requests:', e);
          return [];
        }
      } catch (error) {
        console.error('Error fetching swap requests:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch swap requests');
        return [];
      }
    },
    staleTime: 1000,
    refetchInterval: 5000,
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

  const getRequestorName = (request: SwapRequest) => {
    return request.requestor?.name || `User ${request.requestorId}`;
  };

  const getRecipientName = (request: SwapRequest) => {
    return request.recipient?.name || `User ${request.recipientId}`;
  };

  const formatShiftDates = (request: SwapRequest) => {
    if (!request.shift?.startDate || !request.shift?.endDate) {
      console.log('Missing shift dates for request:', {
        requestId: request.id,
        shiftId: request.shiftId,
        shift: request.shift,
        startDate: request.shift?.startDate,
        endDate: request.shift?.endDate
      });
      return '(Shift dates unavailable)';
    }

    try {
      // Try to format the dates
      const formattedStart = format(new Date(request.shift.startDate), 'MMM d, yyyy');
      const formattedEnd = format(new Date(request.shift.endDate), 'MMM d, yyyy');
      console.log('Formatted dates:', { formattedStart, formattedEnd });
      return `(${formattedStart} - ${formattedEnd})`;
    } catch (error) {
      console.error('Error formatting dates:', error);
      return '(Invalid dates)';
    }
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

        {isLoading ? (
          <div className="text-center py-4">Loading requests...</div>
        ) : !sortedRequests?.length ? (
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
                      {getRequestorName(request)} requested to swap shift with {getRecipientName(request)} {formatShiftDates(request)}
                    </p>
                    <p className="text-sm font-medium mt-1 capitalize text-muted-foreground">
                      Status: {request.status || 'pending'}
                    </p>
                  </div>
                  <SwapRequestActions 
                    request={request} 
                    currentUserId={userId}
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