import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { HolidayPreferences } from "./HolidayPreferences";

interface ShiftPreferencesProps {
  mode: 'user' | 'admin';
  userId?: number;
}

const defaultValues = {
  targetDays: 0,
  toleranceDays: 0,
  maxConsecutiveWeeks: 0,
  preferredShiftLength: 7,
  maxShiftsPerWeek: 1,
  minDaysBetweenShifts: 0,
  preferredHolidays: [],
};

export function ShiftPreferences({ mode, userId }: ShiftPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset } = useForm({
    defaultValues
  });

  const targetUserId = mode === 'admin' ? userId : undefined;
  const apiEndpoint = `/api/user-preferences/${targetUserId || ''}`;

  const { data: preferences, isLoading } = useQuery({
    queryKey: [apiEndpoint, targetUserId],
    queryFn: async () => {
      const res = await fetch(apiEndpoint);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  useEffect(() => {
    if (preferences) {
      reset(preferences);
    }
  }, [preferences, reset]);

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      toast({
        title: "Success",
        description: "Preferences updated successfully",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const onSubmit = (data) => {
    updatePreferences(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Duration</CardTitle>
          <CardDescription>Configure scheduling period preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="preferredShiftLength"
              control={control}
              rules={{ required: true, min: 1, max: 14 }}
              render={({ field }) => (
                <div>
                  <Label>Preferred Shift Length (days)</Label>
                  <Input type="number" {...field} min={1} max={14} />
                </div>
              )}
            />
            <Controller
              name="maxShiftsPerWeek"
              control={control}
              rules={{ required: true, min: 1, max: 7 }}
              render={({ field }) => (
                <div>
                  <Label>Maximum Shifts per Week</Label>
                  <Input type="number" {...field} min={1} max={7} />
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {mode === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Settings</CardTitle>
            <CardDescription>Additional settings for administrators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="targetDays"
                control={control}
                rules={{ required: true, min: 1 }}
                render={({ field }) => (
                  <div>
                    <Label>Target Days</Label>
                    <Input type="number" {...field} min={1} />
                  </div>
                )}
              />
              <Controller
                name="toleranceDays"
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field }) => (
                  <div>
                    <Label>Tolerance Days</Label>
                    <Input type="number" {...field} min={0} />
                  </div>
                )}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Holiday Preferences</CardTitle>
          <CardDescription>Select preferred holidays for scheduling</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            name="preferredHolidays"
            control={control}
            render={({ field }) => (
              <HolidayPreferences
                selectedHolidays={field.value}
                onHolidayChange={field.onChange}
              />
            )}
          />
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={isUpdating}>
        {isUpdating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Preferences"
        )}
      </Button>
    </form>
  );
}