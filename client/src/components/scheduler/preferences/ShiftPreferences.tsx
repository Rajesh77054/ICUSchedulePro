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
    const data = {
      targetDays: parseInt(formData.get("targetDays")),
      toleranceDays: parseInt(formData.get("toleranceDays")),
      maxConsecutiveWeeks: parseInt(formData.get("maxConsecutiveWeeks")),
      preferredShiftLength: parseInt(formData.get("preferredShiftLength")),
      maxShiftsPerWeek: parseInt(formData.get("maxShiftsPerWeek")),
      minDaysBetweenShifts: parseInt(formData.get("minDaysBetweenShifts")),
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
          <CardDescription>Configure your scheduling period preferences</CardDescription>
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
                defaultValue={preferences?.maxConsecutiveWeeks}
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
                defaultValue={preferences?.maxShiftsPerWeek}
                min={1}
                max={7}
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