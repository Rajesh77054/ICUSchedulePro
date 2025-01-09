import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PROVIDERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";

export function TimeOffAdmin() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", selectedProvider],
    queryFn: async ({ queryKey }) => {
      const [_, providerId] = queryKey;
      const url = new URL("/api/time-off-requests", window.location.origin);
      if (providerId && providerId !== 'all') {
        url.searchParams.append("providerId", providerId);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch time-off requests");
      return res.json();
    },
  });

  const { mutate: updateRequestStatus } = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: 'approved' | 'rejected'; reason?: string }) => {
      const res = await fetch(`/api/time-off-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) throw new Error("Failed to update request status");
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
        return "text-green-600 bg-green-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      default:
        return "text-yellow-600 bg-yellow-50";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const otherRequests = requests.filter(req => req.status !== 'pending');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Manage Time Off Requests</h2>
          <Select value={selectedProvider ?? undefined} onValueChange={setSelectedProvider}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.id} value={provider.id.toString()}>
                  {provider.name}, {provider.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6">
          {/* Pending Requests Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Pending Requests</h3>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 bg-muted/20 rounded-lg">
                <p className="text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => {
                  const provider = PROVIDERS.find((p) => p.id === request.providerId);
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{provider?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                          {format(new Date(request.endDate), "MMM d, yyyy")}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                            getStatusColor(request.status)
                          )}
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
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setSelectedRequest(request)}
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
                <p className="text-muted-foreground">No past requests</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {otherRequests.map((request) => {
                  const provider = PROVIDERS.find((p) => p.id === request.providerId);
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{provider?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                          {format(new Date(request.endDate), "MMM d, yyyy")}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                            getStatusColor(request.status)
                          )}
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
      </div>

      {/* Rejection Reason Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Time Off Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this time off request.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
            >
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}