import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HolidayPreferences } from "./HolidayPreferences";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

interface ShiftPreferencesProps {
  mode: 'user' | 'admin';
  userId?: number;
}

export function ShiftPreferences({ mode, userId }: ShiftPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const effectiveUserId = mode === 'admin' ? userId : undefined;

  const [formData, setFormData] = useState({
    targetDays: '',
    toleranceDays: '',
    maxConsecutiveWeeks: '',
    preferredShiftLength: '',
    maxShiftsPerWeek: '',
    minDaysBetweenShifts: '',
    preferredDaysOfWeek: [],
    avoidedDaysOfWeek: [],
    preferredCoworkers: [],
    preferredHolidays: []
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", effectiveUserId],
    queryFn: async () => {
      const url = effectiveUserId 
        ? `/api/user-preferences/${effectiveUserId}`
        : '/api/user-preferences/me';
      const res = await fetch(url, { credentials: 'include' });
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
        preferredDaysOfWeek: preferences.preferredDaysOfWeek || [],
        avoidedDaysOfWeek: preferences.avoidedDaysOfWeek || [],
        preferredCoworkers: preferences.preferredCoworkers || [],
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
        credentials: 'include'
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
      [name]: value === '' ? '' : parseInt(value)
    }));
  };

  const handleDayChange = (type: 'preferred' | 'avoided', dayValue: string, checked: boolean) => {
    const value = parseInt(dayValue);
    const field = type === 'preferred' ? 'preferredDaysOfWeek' : 'avoidedDaysOfWeek';

    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(d => d !== value)
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
    <ScrollArea className="h-[calc(100vh-12rem)]">
      <form onSubmit={handleSubmit} className="space-y-8 px-4">
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
                max={120}
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
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Preferred Days</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {DAYS_OF_WEEK.map((day) => (
                <div key={`preferred_${day.value}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`preferred_${day.value}`}
                    checked={formData.preferredDaysOfWeek.includes(parseInt(day.value))}
                    onCheckedChange={(checked) => handleDayChange('preferred', day.value, checked)}
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
                <div key={`avoided_${day.value}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`avoided_${day.value}`}
                    checked={formData.avoidedDaysOfWeek.includes(parseInt(day.value))}
                    onCheckedChange={(checked) => handleDayChange('avoided', day.value, checked)}
                  />
                  <Label htmlFor={`avoided_${day.value}`}>{day.label}</Label>
                </div>
              ))}
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
    </ScrollArea>
  );
}