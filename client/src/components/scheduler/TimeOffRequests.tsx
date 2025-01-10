import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PROVIDERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DateRange } from "react-day-picker";

const timeOffRequestSchema = z.object({
  providerId: z.number(),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }).refine(data => data.to >= data.from, {
    message: "End date must be after start date",
    path: ["to"],
  }),
});

type TimeOffRequestFormData = z.infer<typeof timeOffRequestSchema>;

interface TimeOffRequestFormProps {
  providerId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TimeOffRequestForm({ providerId, onSuccess, onCancel }: TimeOffRequestFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TimeOffRequestFormData>({
    resolver: zodResolver(timeOffRequestSchema),
    defaultValues: {
      providerId: providerId,
      dateRange: {
        from: undefined,
        to: undefined,
      },
    },
  });

  const { mutate: createRequest, isLoading: isSubmitting } = useMutation({
    mutationFn: async (data: TimeOffRequestFormData) => {
      const res = await fetch("/api/time-off-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: data.providerId,
          startDate: format(data.dateRange.from, "yyyy-MM-dd"),
          endDate: format(data.dateRange.to, "yyyy-MM-dd"),
          status: "pending",
        }),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to create time-off request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Success",
        description: "Time-off request submitted successfully",
      });
      setConfirmOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TimeOffRequestFormData) => {
    setConfirmOpen(true);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="dateRange"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Select dates</FormLabel>
                <DatePickerWithRange
                  selected={field.value}
                  onSelect={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Request Time Off"
              )}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Time-off Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this time-off request?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              From: {form.getValues().dateRange?.from && format(form.getValues().dateRange.from, "MMMM d, yyyy")}
              <br />
              To: {form.getValues().dateRange?.to && format(form.getValues().dateRange.to, "MMMM d, yyyy")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createRequest(form.getValues())}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Confirm Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TimeOffRequestListProps {
  providerId?: number;
  showActions?: boolean;
}

export function TimeOffRequestList({ providerId, showActions = true }: TimeOffRequestListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", providerId],
    queryFn: async ({ queryKey }) => {
      const [_, providerId] = queryKey;
      const url = new URL("/api/time-off-requests", window.location.origin);
      if (providerId) {
        url.searchParams.append("providerId", providerId.toString());
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
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No time-off requests found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const provider = PROVIDERS.find((p) => p.id === request.providerId);
        return (
          <div
            key={request.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="space-y-1">
              {!providerId && (
                <p className="font-medium">{provider?.name}</p>
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
              >
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>
            </div>
            {showActions && request.status === "pending" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Are you sure you want to cancel this request?")) {
                    cancelRequest(request.id);
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TimeOffRequests() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);

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
                <SelectItem value={null}>All Providers</SelectItem>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}, {provider.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setDialogOpen(true)}>New Request</Button>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
            </DialogHeader>
            <TimeOffRequestForm
              onSuccess={() => setDialogOpen(false)}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <TimeOffRequestList providerId={selectedProvider} />
      </div>
    </div>
  );
}