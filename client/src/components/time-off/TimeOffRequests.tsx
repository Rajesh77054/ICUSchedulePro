import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Settings, Loader2, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { USERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";
import { TimeOffRequestForm } from "./TimeOffRequestForm";

interface TimeOffRequestListProps {
  userId?: number;
  showActions?: boolean;
}

function TimeOffRequestSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading time-off requests">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-lg border bg-card"
          role="status"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-9 w-[120px]" />
        </div>
      ))}
      <span className="sr-only">Loading time-off requests...</span>
    </div>
  );
}

export function TimeOffRequestList({ userId, showActions = true }: TimeOffRequestListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelRequestId, setCancelRequestId] = useState<number | null>(null);
  const dialogId = "cancel-dialog-description";

  const { mutate: cancelRequest, isPending: isCancelling } = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch(`/api/time-off-requests/${requestId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to cancel time-off request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Success",
        description: "Time-off request cancelled successfully",
      });
      setCancelRequestId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50 border-green-200";
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
    }
  };

  const { data: requests = [], isLoading } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", userId],
    queryFn: async ({ queryKey }) => {
      const [_, userId] = queryKey;
      const url = new URL("/api/time-off-requests", window.location.origin);
      if (userId) {
        url.searchParams.append("userId", userId.toString());
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch time-off requests");
      return res.json();
    },
  });

  if (isLoading) {
    return <TimeOffRequestSkeleton />;
  }

  if (requests.length === 0) {
    return (
      <div 
        className="text-center py-8 bg-muted/20 rounded-lg space-y-2"
        role="status"
        aria-label="No time-off requests found"
      >
        <Calendar className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">No time-off requests found</p>
        <p className="text-sm text-muted-foreground">
          Create a new request using the button above
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => {
          const user = USERS.find((u) => u.id === request.userId);
          const canCancel = showActions && (request.status === "pending" || request.status === "approved");

          return (
            <div
              key={request.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
              role="listitem"
              aria-label={`Time-off request for ${user?.name}`}
            >
              <div className="space-y-1">
                {!userId && (
                  <p className="font-medium">{user?.name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                  {format(new Date(request.endDate), "MMM d, yyyy")}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    getStatusColor(request.status)
                  )}
                  role="status"
                >
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
                {request.status === 'rejected' && request.reason && (
                  <p className="text-sm text-red-600 mt-1">
                    Reason: {request.reason}
                  </p>
                )}
              </div>
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancelRequestId(request.id)}
                  disabled={isCancelling}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  aria-label={`Cancel time-off request for ${user?.name}`}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel Request
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog 
        open={cancelRequestId !== null} 
        onOpenChange={() => setCancelRequestId(null)}
      >
        <DialogContent aria-describedby={dialogId}>
          <DialogHeader>
            <DialogTitle>Cancel Time-off Request</DialogTitle>
            <DialogDescription id={dialogId}>
              Are you sure you want to cancel this time-off request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setCancelRequestId(null)}
              disabled={isCancelling}
            >
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancelRequestId) cancelRequest(cancelRequestId);
              }}
              disabled={isCancelling}
              aria-busy={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Request"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TimeOffRequests() {
  const [dialogOpen, setDialogOpen] = useState(false);
  // Use the first user as a temporary placeholder until auth is implemented
  const defaultUserId = USERS[0]?.id;
  const dialogId = "create-dialog-description";

  const user = USERS.find(u => u.id === defaultUserId);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Time Off Requests</h2>
            {user && (
              <p className="text-sm text-muted-foreground mt-1">
                Viewing requests for {user.name}, {user.title}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setDialogOpen(true)}
              aria-label="Create new time-off request"
            >
              New Request
            </Button>
            <Link href="/admin/time-off">
              <Button 
                variant="outline" 
                size="icon" 
                title="Manage Time Off Requests"
                aria-label="Go to time off management"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent aria-describedby={dialogId}>
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
              <DialogDescription id={dialogId}>
                Submit a new time-off request for approval
              </DialogDescription>
            </DialogHeader>
            <TimeOffRequestForm
              userId={defaultUserId}
              onSuccess={() => setDialogOpen(false)}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <TimeOffRequestList userId={defaultUserId} />
      </div>
    </div>
  );
}