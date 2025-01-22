import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface ShiftPreferencesProps {
  userId: number;
}

export function ShiftPreferences({ userId }: ShiftPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    preferredShiftLength: 0,
    maxShiftsPerWeek: 0,
    minDaysBetweenShifts: 0
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
        minDaysBetweenShifts: preferences.minDaysBetweenShifts || 0
      });
    }
  }, [preferences]);

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data: typeof formData) => {
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value, 10) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          <CardTitle>Shift Preferences</CardTitle>
          <CardDescription>Set your preferred shift schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="preferredShiftLength">Preferred Shift Length (days)</Label>
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