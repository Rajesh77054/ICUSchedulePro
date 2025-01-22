
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

export function UserPreferences({ userId, isAdmin = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    preferredShiftLength: 0,
    maxShiftsPerWeek: 0,
    minDaysBetweenShifts: 0,
    preferredDaysOfWeek: [],
    avoidedDaysOfWeek: [],
    // Admin-only fields
    targetDays: 0,
    toleranceDays: 0,
    maxConsecutiveWeeks: 0,
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
      setFormData(prev => ({
        ...prev,
        ...preferences,
      }));
    }
  }, [preferences]);

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
      toast({
        title: "Success",
        description: "Preferences updated successfully",
      });
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
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };

  const handleSubmit = (e) => {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {isAdmin && (
          <>
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
          </>
        )}

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

        <div>
          <Label className="mb-2 block">Preferred Days</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`preferred_${day.value}`}
                  name={`preferred_${day.value}`}
                  checked={formData.preferredDaysOfWeek.includes(parseInt(day.value))}
                  onCheckedChange={(checked) => {
                    const value = parseInt(day.value);
                    setFormData(prev => ({
                      ...prev,
                      preferredDaysOfWeek: checked 
                        ? [...prev.preferredDaysOfWeek, value]
                        : prev.preferredDaysOfWeek.filter(d => d !== value)
                    }));
                  }}
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
                  checked={formData.avoidedDaysOfWeek.includes(parseInt(day.value))}
                  onCheckedChange={(checked) => {
                    const value = parseInt(day.value);
                    setFormData(prev => ({
                      ...prev,
                      avoidedDaysOfWeek: checked
                        ? [...prev.avoidedDaysOfWeek, value]
                        : prev.avoidedDaysOfWeek.filter(d => d !== value)
                    }));
                  }}
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
