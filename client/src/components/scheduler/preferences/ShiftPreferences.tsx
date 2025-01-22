
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export function ShiftPreferences({ userId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    targetDays: "",
    toleranceDays: "",
    maxConsecutiveWeeks: "",
    preferredShiftLength: "",
    maxShiftsPerWeek: "",
    minDaysBetweenShifts: "",
    preferredDaysOfWeek: [],
    avoidedDaysOfWeek: []
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      const data = await res.json();
      setFormData({
        targetDays: data.targetDays || "",
        toleranceDays: data.toleranceDays || "",
        maxConsecutiveWeeks: data.maxConsecutiveWeeks || "",
        preferredShiftLength: data.preferredShiftLength || "",
        maxShiftsPerWeek: data.maxShiftsPerWeek || "",
        minDaysBetweenShifts: data.minDaysBetweenShifts || "",
        preferredDaysOfWeek: data.preferredDaysOfWeek || [],
        avoidedDaysOfWeek: data.avoidedDaysOfWeek || []
      });
      return data;
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updatePreferences({
      ...formData,
      targetDays: parseInt(formData.targetDays),
      toleranceDays: parseInt(formData.toleranceDays),
      maxConsecutiveWeeks: parseInt(formData.maxConsecutiveWeeks),
      preferredShiftLength: parseInt(formData.preferredShiftLength),
      maxShiftsPerWeek: parseInt(formData.maxShiftsPerWeek),
      minDaysBetweenShifts: parseInt(formData.minDaysBetweenShifts),
    });
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
                value={formData.targetDays}
                onChange={handleInputChange}
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
                value={formData.toleranceDays}
                onChange={handleInputChange}
                min={0}
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
              <Label htmlFor="maxConsecutiveWeeks">Maximum Consecutive Weeks</Label>
              <Input
                id="maxConsecutiveWeeks"
                name="maxConsecutiveWeeks"
                type="number"
                value={formData.maxConsecutiveWeeks}
                onChange={handleInputChange}
                min={1}
                max={52}
              />
            </div>
            <div>
              <Label htmlFor="maxShiftsPerWeek">Maximum Shifts per Week</Label>
              <Input
                id="maxShiftsPerWeek"
                name="maxShiftsPerWeek"
                type="number"
                value={formData.maxShiftsPerWeek}
                onChange={handleInputChange}
                min={1}
                max={7}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shift Preferences</CardTitle>
          <CardDescription>Configure your shift length and spacing preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="preferredShiftLength">Preferred Shift Length</Label>
              <Input
                id="preferredShiftLength"
                name="preferredShiftLength"
                type="number"
                value={formData.preferredShiftLength}
                onChange={handleInputChange}
                min={1}
                max={14}
              />
            </div>
            <div>
              <Label htmlFor="minDaysBetweenShifts">Minimum Days Between Shifts</Label>
              <Input
                id="minDaysBetweenShifts"
                name="minDaysBetweenShifts"
                type="number"
                value={formData.minDaysBetweenShifts}
                onChange={handleInputChange}
                min={0}
                max={90}
              />
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
