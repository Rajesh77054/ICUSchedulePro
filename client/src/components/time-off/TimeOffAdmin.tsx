import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, X, Loader2, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeOffRequestForm } from "./TimeOffRequestForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { USERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";

export function TimeOffAdmin() {
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog IDs for accessibility
  const createDialogId = "create-dialog-description";
  const rejectDialogId = "reject-dialog-description";

  const { data: requests = [], isLoading } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", selectedUser],
    queryFn: async ({ queryKey }) => {
      const [_, userId] = queryKey;
      const url = new URL("/api/time-off-requests", window.location.origin);
      if (userId && userId !== 'all') {
        url.searchParams.append("userId", userId);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch time-off requests");
      return res.json();
    },
  });

  const { mutate: updateRequestStatus, isPending } = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: 'approved' | 'rejected'; reason?: string }) => {
      const res = await fetch(`/api/time-off-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to update request status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Success",
        description: "Request status updated successfully",
      });
      setSelectedRequest(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReject = () => {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    updateRequestStatus({
      id: selectedRequest.id,
      status: 'rejected',
      reason: rejectionReason.trim(),
    });
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading time-off requests...</span>
      </div>
    );
  }

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const otherRequests = requests.filter(req => req.status !== 'pending');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Manage Time Off Requests</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review and manage time-off requests for all users
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}, {user.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Request
            </Button>
          </div>
        </div>

        {/* Create Request Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent aria-describedby={createDialogId}>
            <DialogHeader>
              <DialogTitle>Create Time Off Request</DialogTitle>
              <DialogDescription id={createDialogId}>
                Create a time off request on behalf of a user.
              </DialogDescription>
            </DialogHeader>
            <TimeOffRequestForm
              onSuccess={() => {
                setCreateDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
                toast({
                  title: "Success",
                  description: "Time off request created successfully",
                });
              }}
              onCancel={() => setCreateDialogOpen(false)}
              isAdmin={true}
            />
          </DialogContent>
        </Dialog>

        <div className="space-y-6">
          {/* Pending Requests Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Pending Requests</h3>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 bg-muted/20 rounded-lg space-y-2">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              <div className="grid gap-4" role="list" aria-label="Pending time-off requests">
                {pendingRequests.map((request) => {
                  const user = USERS.find((u) => u.id === request.userId);
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      role="listitem"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{user?.name}</p>
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
                          Pending
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => updateRequestStatus({ id: request.id, status: 'approved' })}
                          disabled={isPending}
                          aria-label={`Approve ${user?.name}'s time-off request`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setSelectedRequest(request)}
                          disabled={isPending}
                          aria-label={`Reject ${user?.name}'s time-off request`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Requests Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Past Requests</h3>
            {otherRequests.length === 0 ? (
              <div className="text-center py-8 bg-muted/20 rounded-lg">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No past requests</p>
              </div>
            ) : (
              <div className="grid gap-4" role="list" aria-label="Past time-off requests">
                {otherRequests.map((request) => {
                  const user = USERS.find((u) => u.id === request.userId);
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      role="listitem"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{user?.name}</p>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rejection Reason Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent aria-describedby={rejectDialogId}>
            <DialogHeader>
              <DialogTitle>Reject Time Off Request</DialogTitle>
              <DialogDescription id={rejectDialogId}>
                Please provide a reason for rejecting this time off request.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
              aria-label="Rejection reason"
              required
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Reject Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}