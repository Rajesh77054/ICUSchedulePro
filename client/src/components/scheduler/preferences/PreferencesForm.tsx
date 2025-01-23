
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { HolidayPreferences } from "./HolidayPreferences";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export function PreferencesForm({ userId, isAdmin }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    preferredShiftLength: 0,
    maxShiftsPerWeek: 0,
    minDaysBetweenShifts: 0,
    preferredDaysOfWeek: [],
    avoidedDaysOfWeek: [],
    preferredHolidays: []
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  useEffect(() => {
    if (preferences) {
      setFormData({
        preferredShiftLength: preferences.preferredShiftLength || 0,
        maxShiftsPerWeek: preferences.maxShiftsPerWeek || 0,
        minDaysBetweenShifts: preferences.minDaysBetweenShifts || 0,
        preferredDaysOfWeek: preferences.preferredDaysOfWeek || [],
        avoidedDaysOfWeek: preferences.avoidedDaysOfWeek || [],
        preferredHolidays: preferences.preferredHolidays || []
      });
    }
  }, [preferences]);

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data) => {
      console.log("Submitting preferences:", data);
      const res = await fetch(`/api/user-preferences/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          preferredHolidays: data.preferredHolidays || []
        }),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({ title: "Success", description: "Preferences updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleHolidayChange = (selectedHolidays) => {
    console.log('Holiday selection changed:', selectedHolidays);
    setFormData(prev => ({...prev, preferredHolidays: selectedHolidays}));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form data being submitted:", formData);
    updatePreferences(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Duration</CardTitle>
          <CardDescription>Configure your scheduling period preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Preferred Shift Length (days)</Label>
              <Input
                type="number"
                value={formData.preferredShiftLength}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  preferredShiftLength: parseInt(e.target.value)
                }))}
                min={1}
                max={14}
              />
            </div>
            <div>
              <Label>Maximum Shifts per Week</Label>
              <Input
                type="number"
                value={formData.maxShiftsPerWeek}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  maxShiftsPerWeek: parseInt(e.target.value)
                }))}
                min={1}
                max={7}
              />
            </div>
            <div>
              <Label>Minimum Days Between Shifts</Label>
              <Input
                type="number"
                value={formData.minDaysBetweenShifts}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  minDaysBetweenShifts: parseInt(e.target.value)
                }))}
                min={0}
                max={90}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Days of Week</CardTitle>
          <CardDescription>Select your preferred and avoided days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Preferred Days</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.preferredDaysOfWeek.includes(day.value)}
                    onCheckedChange={(checked) => {
                      const updated = checked
                        ? [...formData.preferredDaysOfWeek, day.value]
                        : formData.preferredDaysOfWeek.filter(d => d !== day.value);
                      setFormData(prev => ({...prev, preferredDaysOfWeek: updated}));
                    }}
                  />
                  <Label>{day.label}</Label>
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
                    checked={formData.avoidedDaysOfWeek.includes(day.value)}
                    onCheckedChange={(checked) => {
                      const updated = checked
                        ? [...formData.avoidedDaysOfWeek, day.value]
                        : formData.avoidedDaysOfWeek.filter(d => d !== day.value);
                      setFormData(prev => ({...prev, avoidedDaysOfWeek: updated}));
                    }}
                  />
                  <Label>{day.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Preferences</CardTitle>
          <CardDescription>Select your preferred holidays for scheduling</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <HolidayPreferences 
              selectedHolidays={formData.preferredHolidays} 
              onHolidayChange={handleHolidayChange}
            />
          </div>
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
