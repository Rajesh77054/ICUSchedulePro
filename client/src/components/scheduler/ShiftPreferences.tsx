import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

interface UserPreference {
  id: number;
  userId: number;
  preferredShiftLength: number;
  preferredDaysOfWeek: number[];
  preferredCoworkers: number[];
  avoidedDaysOfWeek: number[];
  maxShiftsPerWeek: number;
  minDaysBetweenShifts: number;
  createdAt: string;
  updatedAt: string;
}

interface ShiftPreferencesProps {
  userId: number;
}

export function ShiftPreferences({ userId }: ShiftPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<UserPreference>({
    queryKey: ["/api/user-preferences", userId],
    enabled: !!userId,
  });

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data: Partial<UserPreference>) => {
      const res = await fetch(`/api/user-preferences/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({
        title: "Success",
        description: "Shift preferences updated successfully",
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const preferredDaysOfWeek = DAYS_OF_WEEK
      .filter(day => formData.get(`preferred_${day.value}`))
      .map(day => parseInt(day.value));

    const avoidedDaysOfWeek = DAYS_OF_WEEK
      .filter(day => formData.get(`avoided_${day.value}`))
      .map(day => parseInt(day.value));

    const data = {
      preferredShiftLength: parseInt(formData.get("preferredShiftLength") as string),
      maxShiftsPerWeek: parseInt(formData.get("maxShiftsPerWeek") as string),
      minDaysBetweenShifts: parseInt(formData.get("minDaysBetweenShifts") as string),
      preferredDaysOfWeek,
      avoidedDaysOfWeek,
    };

    updatePreferences(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No preferences found for this user
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="preferredShiftLength">Preferred Shift Length (days)</Label>
          <Input
            id="preferredShiftLength"
            name="preferredShiftLength"
            type="number"
            defaultValue={preferences.preferredShiftLength}
            min={1}
            max={14}
            required
          />
        </div>

        <div>
          <Label htmlFor="maxShiftsPerWeek">Maximum Shifts per Week</Label>
          <Input
            id="maxShiftsPerWeek"
            name="maxShiftsPerWeek"
            type="number"
            defaultValue={preferences.maxShiftsPerWeek}
            min={1}
            max={7}
            required
          />
        </div>

        <div>
          <Label htmlFor="minDaysBetweenShifts">Minimum Days Between Shifts</Label>
          <Input
            id="minDaysBetweenShifts"
            name="minDaysBetweenShifts"
            type="number"
            defaultValue={preferences.minDaysBetweenShifts}
            min={0}
            max={90}
            required
          />
        </div>

        <div>
          <Label className="mb-2 block">Preferred Days of Week</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`preferred_${day.value}`}
                  name={`preferred_${day.value}`}
                  defaultChecked={preferences.preferredDaysOfWeek.includes(
                    parseInt(day.value)
                  )}
                />
                <Label htmlFor={`preferred_${day.value}`}>{day.label}</Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Days to Avoid</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`avoided_${day.value}`}
                  name={`avoided_${day.value}`}
                  defaultChecked={preferences.avoidedDaysOfWeek.includes(
                    parseInt(day.value)
                  )}
                />
                <Label htmlFor={`avoided_${day.value}`}>{day.label}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

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
