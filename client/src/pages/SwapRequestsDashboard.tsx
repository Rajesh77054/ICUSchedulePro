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
import { PROVIDERS } from "@/lib/constants";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  X,
  Filter,
  RefreshCcw,
} from "lucide-react";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface SwapRequest {
  id: number;
  requestorId: number;
  recipientId: number;
  shiftId: number;
  status: string;
  createdAt: string;
  requestor: {
    name: string;
    title: string;
    color: string;
  };
  recipient: {
    name: string;
    title: string;
    color: string;
  };
  shift: {
    startDate: string;
    endDate: string;
    status: string;
  };
}

export function SwapRequestsDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const { data: requests, isLoading } = useQuery<SwapRequest[]>({
    queryKey: ["/api/swap-requests"],
  });

  const filteredRequests = requests?.filter(request => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false;
    if (providerFilter !== "all" && 
        request.requestorId.toString() !== providerFilter && 
        request.recipientId.toString() !== providerFilter) return false;
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
    <div className="container mx-auto py-6 space-y-6">
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
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStatusFilter("all");
                setProviderFilter("all");
              }}
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
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {PROVIDERS.map(provider => (
                    <SelectItem key={provider.id} value={provider.id.toString()}>
                      {provider.name}, {provider.title}
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
                      <p className="text-sm text-muted-foreground mt-2">
                        Shift period: {format(new Date(request.shift.startDate), "MMM d, yyyy")} - {format(new Date(request.shift.endDate), "MMM d, yyyy")}
                      </p>
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
