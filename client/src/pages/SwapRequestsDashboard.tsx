import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { USERS } from "@/lib/constants";
import { useState } from "react";
import {
  ArrowLeft,
  Filter,
  RefreshCcw,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { SwapRequest } from "@/lib/types";
import { SwapRequestActions } from "@/components/scheduler/SwapRequestActions";

export function SwapRequestsDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all swap requests (no userId filter for admin view)
  const { data: requests, isLoading } = useQuery<SwapRequest[]>({
    queryKey: ["/api/swap-requests"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/swap-requests");
        const text = await res.text();
        console.log('Raw server response:', text);

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Failed to fetch swap requests");
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

          // Verify shift data for each request
          data.forEach((request: SwapRequest) => {
            console.log('Request shift data:', {
              id: request.id,
              shiftId: request.shiftId,
              shift: request.shift,
              startDate: request.shift?.startDate,
              endDate: request.shift?.endDate
            });
          });

          return data;
        } catch (e) {
          console.error('Error parsing swap requests:', e);
          return [];
        }
      } catch (error) {
        console.error("Error fetching swap requests:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch swap requests");
        return [];
      }
    },
    staleTime: 1000,
    refetchInterval: 5000,
  });

  const filteredRequests = requests?.filter(request => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false;
    if (userFilter !== "all" &&
        request.requestorId.toString() !== userFilter &&
        request.recipientId.toString() !== userFilter) return false;
    return true;
  });

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
      return '(Shift dates not available)';
    }

    try {
      return `(${format(new Date(request.shift.startDate), 'MMM d, yyyy')} - ${format(new Date(request.shift.endDate), 'MMM d, yyyy')})`;
    } catch (error) {
      console.error('Error formatting shift dates:', error);
      return '(Invalid dates)';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Shift Swap Requests</h1>
          <p className="text-muted-foreground">
            Manage and track all shift swap requests
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schedule
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStatusFilter("all");
                setUserFilter("all");
              }}
              title="Reset filters"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-64">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <label className="text-sm font-medium mb-2 block">Staff Member</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {USERS.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}, {user.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-4">Loading requests...</div>
          ) : !filteredRequests?.length ? (
            <div className="text-center py-4 text-muted-foreground">
              No swap requests found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map(request => (
                <div
                  key={request.id}
                  className="p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-muted-foreground">
                          Requested on {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {getRequestorName(request)} requested to swap shift with {getRecipientName(request)} {formatShiftDates(request)}
                        </p>
                        <p className="text-sm font-medium capitalize">
                          Status: {request.status || 'pending'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <SwapRequestActions 
                        request={request}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}