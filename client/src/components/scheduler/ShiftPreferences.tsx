import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DAYS_OF_WEEK } from "@/lib/constants"; // Adjusted import path
import { toast } from "@/components/ui/use-toast"; // Adjusted import path
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export default function ShiftPreferences({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState({
    preferredShiftLength: 8,
    maxShiftsPerWeek: 5,
    minDaysBetweenShifts: 1,
    preferredDaysOfWeek: [],
    avoidedDaysOfWeek: []
  });

  useEffect(() => {
    fetch(`/api/user-preferences/${userId}`, {
      credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
      if (data && !data.error) {
        setPreferences(prev => ({
          ...prev,
          ...data
        }));
      }
    })
    .catch(error => console.error('Failed to fetch preferences:', error));
  }, [userId]);

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data: typeof preferences) => {
      const res = await fetch(`/api/user-preferences/${userId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      const responseData = await res.json();
      if (!res.ok) {
        console.error('Preferences update failed:', responseData);
        throw new Error(responseData.error || "Failed to update preferences");
      }
      return responseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({
        title: "Success",
        description: "Preferences updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updatePreferences(preferences);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? (prev[name] as any[]).concat(parseInt(value)) : (prev[name] as any[]).filter(v => v !== parseInt(value))) : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    const dayValue = parseInt(name.split('_')[1]);
    setPreferences((prev) => ({
      ...prev,
      [name.split('_')[0] + 'DaysOfWeek']: checked ? [...(prev[name.split('_')[0] + 'DaysOfWeek'] as number[]), dayValue] : (prev[name.split('_')[0] + 'DaysOfWeek'] as number[]).filter(day => day !== dayValue)
    }));
  };

  if (isUpdating) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            defaultValue={preferences.preferredShiftLength.toString()}
            onChange={handleInputChange}
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
            defaultValue={preferences.maxShiftsPerWeek.toString()}
            onChange={handleInputChange}
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
            defaultValue={preferences.minDaysBetweenShifts.toString()}
            onChange={handleInputChange}
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
                  onChange={handleCheckboxChange}
                  defaultChecked={preferences.preferredDaysOfWeek.includes(parseInt(day.value))}
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
                  onChange={handleCheckboxChange}
                  defaultChecked={preferences.avoidedDaysOfWeek.includes(parseInt(day.value))}
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