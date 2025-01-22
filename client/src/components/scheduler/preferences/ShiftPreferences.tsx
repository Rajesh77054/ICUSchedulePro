
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

export function ShiftPreferences({ userId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data) => {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const preferredDaysOfWeek = DAYS_OF_WEEK
      .filter(day => formData.get(`preferred_${day.value}`))
      .map(day => parseInt(day.value));

    const avoidedDaysOfWeek = DAYS_OF_WEEK
      .filter(day => formData.get(`avoided_${day.value}`))
      .map(day => parseInt(day.value));

    const data = {
      targetDays: parseInt(formData.get("targetDays")),
      toleranceDays: parseInt(formData.get("toleranceDays")),
      maxConsecutiveWeeks: parseInt(formData.get("maxConsecutiveWeeks")),
      preferredShiftLength: parseInt(formData.get("preferredShiftLength")),
      maxShiftsPerWeek: parseInt(formData.get("maxShiftsPerWeek")),
      minDaysBetweenShifts: parseInt(formData.get("minDaysBetweenShifts")),
      preferredDaysOfWeek,
      avoidedDaysOfWeek,
    };

    updatePreferences(data);
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
          <CardDescription>Configure your scheduling period and shift length preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="targetDays">Target Days</Label>
              <Input
                id="targetDays"
                name="targetDays"
                type="number"
                defaultValue={preferences?.targetDays}
                min={1}
                max={90}
              />
            </div>
            <div>
              <Label htmlFor="toleranceDays">Tolerance Days</Label>
              <Input
                id="toleranceDays"
                name="toleranceDays"
                type="number"
                defaultValue={preferences?.toleranceDays}
                min={0}
                max={14}
              />
            </div>
            <div>
              <Label htmlFor="maxConsecutiveWeeks">Maximum Consecutive Weeks</Label>
              <Input
                id="maxConsecutiveWeeks"
                name="maxConsecutiveWeeks"
                type="number"
                defaultValue={preferences?.maxConsecutiveWeeks}
                min={1}
                max={52}
              />
            </div>
            <div>
              <Label htmlFor="preferredShiftLength">Preferred Shift Length</Label>
              <Input
                id="preferredShiftLength"
                name="preferredShiftLength"
                type="number"
                defaultValue={preferences?.preferredShiftLength}
                min={1}
                max={14}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Constraints</CardTitle>
          <CardDescription>Set your scheduling limits and consecutive work preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="maxShiftsPerWeek">Maximum Shifts per Week</Label>
              <Input
                id="maxShiftsPerWeek"
                name="maxShiftsPerWeek"
                type="number"
                defaultValue={preferences?.maxShiftsPerWeek}
                min={1}
                max={7}
              />
            </div>
            <div>
              <Label htmlFor="minDaysBetweenShifts">Minimum Days Between Shifts</Label>
              <Input
                id="minDaysBetweenShifts"
                name="minDaysBetweenShifts"
                type="number"
                defaultValue={preferences?.minDaysBetweenShifts}
                min={0}
                max={90}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Day Preferences</CardTitle>
          <CardDescription>Select your preferred and avoided days of the week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Preferred Days</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={`pref_${day.value}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`preferred_${day.value}`}
                      name={`preferred_${day.value}`}
                      defaultChecked={preferences?.preferredDaysOfWeek?.includes(parseInt(day.value))}
                    />
                    <Label htmlFor={`preferred_${day.value}`}>{day.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <Label className="mb-2 block">Days to Avoid</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={`avoid_${day.value}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`avoided_${day.value}`}
                      name={`avoided_${day.value}`}
                      defaultChecked={preferences?.avoidedDaysOfWeek?.includes(parseInt(day.value))}
                    />
                    <Label htmlFor={`avoided_${day.value}`}>{day.label}</Label>
                  </div>
                ))}
              </div>
            </div>
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
