
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { HolidayPreferences } from "./HolidayPreferences";

interface ShiftPreferencesProps {
  mode: 'user' | 'admin';
  userId?: number;
}

export function ShiftPreferences({ mode, userId }: ShiftPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const effectiveUserId = mode === 'admin' ? userId : undefined;
  
  const [formData, setFormData] = useState({
    targetDays: 0,
    toleranceDays: 0,
    maxConsecutiveWeeks: 0,
    preferredShiftLength: 0,
    maxShiftsPerWeek: 0,
    minDaysBetweenShifts: 0,
    preferredHolidays: []
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", effectiveUserId],
    queryFn: async () => {
      const url = effectiveUserId 
        ? `/api/user-preferences/${effectiveUserId}`
        : '/api/user-preferences/me';
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  useEffect(() => {
    if (preferences) {
      setFormData({
        targetDays: preferences.targetDays || 0,
        toleranceDays: preferences.toleranceDays || 0,
        maxConsecutiveWeeks: preferences.maxConsecutiveWeeks || 0,
        preferredShiftLength: preferences.preferredShiftLength || 0,
        maxShiftsPerWeek: preferences.maxShiftsPerWeek || 0,
        minDaysBetweenShifts: preferences.minDaysBetweenShifts || 0,
        preferredHolidays: preferences.preferredHolidays || []
      });
    }
  }, [preferences]);

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data) => {
      const url = effectiveUserId 
        ? `/api/user-preferences/${effectiveUserId}`
        : '/api/user-preferences/me';
      const res = await fetch(url, {
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
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };

  const handleHolidayChange = (selectedHolidays) => {
    setFormData(prev => ({...prev, preferredHolidays: selectedHolidays}));
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (mode === 'user') {
      const conflicts = validateAgainstAdminConstraints(formData);
      if (conflicts.length > 0) {
        toast({
          title: "Cannot save preferences",
          description: conflicts.join(". "),
          variant: "destructive"
        });
        return;
      }
    }

    updatePreferences(formData);
  };

  const validateAgainstAdminConstraints = (data) => {
    if (mode === 'admin') return [];
    
    const conflicts = [];
    if (data.maxShiftsPerWeek > preferences?.adminConstraints?.maxShiftsPerWeek) {
      conflicts.push(`Cannot exceed admin-set maximum of ${preferences.adminConstraints.maxShiftsPerWeek} shifts per week`);
    }
    if (data.minDaysBetweenShifts < preferences?.adminConstraints?.minDaysBetweenShifts) {
      conflicts.push(`Must maintain at least ${preferences.adminConstraints.minDaysBetweenShifts} days between shifts`);
    }
    return conflicts;
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
      {mode === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Duration</CardTitle>
            <CardDescription>Configure scheduling period preferences</CardDescription>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Schedule Constraints</CardTitle>
          <CardDescription>Set scheduling limits and consecutive work preferences</CardDescription>
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
              <Label htmlFor="minDaysBetweenShifts">Minimum Days Between Shifts</Label>
              <Input
                id="minDaysBetweenShifts"
                name="minDaysBetweenShifts"
                type="number"
                value={formData.minDaysBetweenShifts}
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
          <CardTitle>Holiday Preferences</CardTitle>
          <CardDescription>Select holidays you prefer to have off from work</CardDescription>
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
