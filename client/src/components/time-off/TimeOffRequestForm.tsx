import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import { USERS } from "@/lib/constants";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DateRange } from "react-day-picker";

const timeOffRequestSchema = z.object({
  userId: z.number({
    required_error: "Please select a user",
    invalid_type_error: "Please select a user",
  }),
  dateRange: z.object({
    from: z.date({
      required_error: "Please select a start date",
      invalid_type_error: "Please select a valid start date",
    }),
    to: z.date({
      required_error: "Please select an end date",
      invalid_type_error: "Please select a valid end date",
    }),
  }).refine(data => data.to >= data.from, {
    message: "End date must be after start date",
    path: ["to"],
  }),
});

type TimeOffRequestFormData = z.infer<typeof timeOffRequestSchema>;

interface TimeOffRequestFormProps {
  userId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  showUserSelect?: boolean;
}

export function TimeOffRequestForm({ userId, onSuccess, onCancel, showUserSelect = false }: TimeOffRequestFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TimeOffRequestFormData>({
    resolver: zodResolver(timeOffRequestSchema),
    defaultValues: {
      userId: userId,
      dateRange: {
        from: undefined,
        to: undefined,
      },
    },
  });

  const { mutate: createRequest, isPending: isSubmitting } = useMutation({
    mutationFn: async (data: TimeOffRequestFormData) => {
      const res = await fetch("/api/time-off-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.userId,
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

  const selectedUser = USERS.find(u => u.id === form.getValues().userId);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {showUserSelect ? (
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select User</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {USERS.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name}, {user.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <input type="hidden" {...form.register("userId", { value: userId })} />
          )}
          <FormField
            control={form.control}
            name="dateRange"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Select dates</FormLabel>
                <FormControl>
                  <DatePickerWithRange
                    selected={field.value}
                    onSelect={field.onChange}
                  />
                </FormControl>
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
              {showUserSelect ? (
                "Please review the time-off request details before submitting."
              ) : (
                "Are you sure you want to submit this time-off request?"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {selectedUser && (
                <>
                  User: {selectedUser.name}, {selectedUser.title}
                  <br />
                </>
              )}
              From: {form.getValues().dateRange?.from && format(form.getValues().dateRange.from, "MMM d, yyyy")}
              <br />
              To: {form.getValues().dateRange?.to && format(form.getValues().dateRange.to, "MMM d, yyyy")}
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