import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Check,
  Clock,
  X,
  Filter,
  RefreshCcw,
  Calendar,
} from "lucide-react";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { SwapRequest } from "@/lib/types";
import { SwapRequestActions } from "@/components/scheduler/SwapRequestActions";
import { ChatDialog } from "@/components/scheduler/ChatDialog";

export function SwapRequestsDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Update to use consistent query key format
  const { data: requests, isLoading } = useQuery<SwapRequest[]>({
    queryKey: ["/api/swap-requests"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/swap-requests");
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Failed to fetch swap requests");
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching swap requests:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch swap requests");
        return [];
      }
    },
  });

  const filteredRequests = requests?.filter(request => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false;
    if (userFilter !== "all" &&
        request.requestorId.toString() !== userFilter &&
        request.recipientId.toString() !== userFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <X className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
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
                queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] });
              }}
              title="Reset filters and refresh"
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

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-4">Loading requests...</div>
          ) : filteredRequests?.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No swap requests found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests?.map(request => (
                <div
                  key={request.id}
                  className="p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(request.status)}
                        <span className="text-sm text-muted-foreground">
                          Requested on {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="inline-block w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: request.requestor.color }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>Requestor</TooltipContent>
                          </Tooltip>
                          <span className="font-medium">
                            {request.requestor.name}, {request.requestor.title}
                          </span>
                        </div>
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="inline-block w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: request.recipient.color }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>Recipient</TooltipContent>
                          </Tooltip>
                          <span className="font-medium">
                            {request.recipient.name}, {request.recipient.title}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Shift period: {format(new Date(request.shift.startDate), "MMM d, yyyy")} - {format(new Date(request.shift.endDate), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <SwapRequestActions request={request} />
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