import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PROVIDERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";

interface TimeOffRequestDialogProps {
  onClose: () => void;
}

function TimeOffRequestDialog({ onClose }: TimeOffRequestDialogProps) {
  const [providerId, setProviderId] = useState<string>();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: createRequest } = useMutation({
    mutationFn: async (data: Partial<TimeOffRequest>) => {
      const res = await fetch("/api/time-off-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create time-off request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Success",
        description: "Time-off request submitted successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!providerId) {
      toast({
        title: "Error",
        description: "Please select a provider",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    createRequest({
      providerId: parseInt(providerId),
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      status: "pending",
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogDescription>
            Select the provider and date range for your time off request.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Provider</label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id.toString()}>
                    {provider.name}, {provider.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) =>
                      date < new Date() || (endDate ? date > endDate : false)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) =>
                      date < new Date() || (startDate ? date < startDate : false)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Button onClick={handleSubmit}>Submit Request</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TimeOffRequests() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
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

  const { mutate: cancelRequest } = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch(`/api/time-off-requests/${requestId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel time-off request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Success",
        description: "Time-off request cancelled successfully",
      });
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Time Off Requests</h2>
          <div className="flex items-center gap-4">
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
            <Button onClick={() => setDialogOpen(true)}>New Request</Button>
          </div>
        </div>

        <div className="grid gap-4">
          {requests.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-lg">
              <p className="text-muted-foreground">
                No time-off requests found
              </p>
            </div>
          ) : (
            requests.map((request) => {
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
                      {request.status.charAt(0).toUpperCase() +
                        request.status.slice(1)}
                    </span>
                  </div>
                  {request.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelRequest(request.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {dialogOpen && (
          <TimeOffRequestDialog
            onClose={() => setDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
}