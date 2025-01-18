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
  FormDescription,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { USERS } from "@/lib/constants";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
  }).refine(data => {
    if (!data.from || !data.to) return false;
    return data.to >= data.from;
  }, {
    message: "End date must be after start date",
    path: ["to"],
  }),
});

type TimeOffRequestFormData = z.infer<typeof timeOffRequestSchema>;

interface TimeOffRequestFormProps {
  userId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  isAdmin?: boolean;
}

export function TimeOffRequestForm({ userId, onSuccess, onCancel, isAdmin = false }: TimeOffRequestFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialogId = "confirm-dialog-description";

  // Get user details for display
  const selectedUser = userId ? USERS.find(u => u.id === userId) : undefined;

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
      try {
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
      } catch (error: any) {
        setError(error.message);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Success",
        description: "Time-off request submitted successfully",
      });
      setConfirmOpen(false);
      setError(null);
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setError(error.message);
    },
  });

  const onSubmit = (data: TimeOffRequestFormData) => {
    setError(null);
    setConfirmOpen(true);
  };

  // If not admin view and no userId provided, show error
  if (!isAdmin && !userId) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg" role="alert">
        <p className="font-medium">User Context Error</p>
        <p className="text-sm">Unable to determine the current user. Please try again or contact support.</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {isAdmin ? (
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
                  <FormDescription>
                    Choose the user for whom you're creating the time-off request.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            selectedUser && (
              <div className="mb-4">
                <p className="text-sm font-medium">Requesting Time Off for:</p>
                <p className="text-sm text-muted-foreground">{selectedUser.name}, {selectedUser.title}</p>
              </div>
            )
          )}
          <input type="hidden" {...form.register("userId", { value: userId })} />
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
                <FormDescription>
                  Choose the start and end dates for your time-off request.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.formState.isValid}
              aria-disabled={isSubmitting || !form.formState.isValid}
            >
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
        <DialogContent aria-describedby={confirmDialogId}>
          <DialogHeader>
            <DialogTitle>Confirm Time-off Request</DialogTitle>
            <DialogDescription id={confirmDialogId}>
              {isAdmin ? (
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