import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { HOLIDAYS_2024_2025 } from "@/lib/constants";

const HOLIDAYS = [
  { id: 'new_year', name: "New Year's Day" },
  { id: 'easter', name: "Easter Weekend" },
  { id: 'memorial', name: "Memorial Day" },
  { id: 'independence', name: "Independence Day" },
  { id: 'labor', name: "Labor Day" },
  { id: 'thanksgiving', name: "Thanksgiving" },
  { id: 'christmas', name: "Christmas Day" },
];

interface ShiftPreferencesProps {
  userId: number;
}

export function ShiftPreferences({ userId }: ShiftPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    preferredShiftLength: 0,
    maxShiftsPerWeek: 0,
    minDaysBetweenShifts: 0,
    holidayPreferences: [] as string[]
  });

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  const { data: holidayAssignments, isLoading: holidaysLoading } = useQuery({
    queryKey: ["/api/holiday-assignments", userId],
    queryFn: async () => {
      const res = await fetch(`/api/holiday-assignments/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch holiday assignments");
      return res.json();
    },
  });

  const { data: holidayStats } = useQuery({
    queryKey: ["/api/holiday-stats", userId],
    queryFn: async () => {
      const res = await fetch(`/api/holiday-stats/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch holiday stats");
      return res.json();
    },
  });

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

  useEffect(() => {
    if (preferences) {
      setFormData(prev => ({
        ...prev,
        preferredShiftLength: preferences.preferredShiftLength || 0,
        maxShiftsPerWeek: preferences.maxShiftsPerWeek || 0,
        minDaysBetweenShifts: preferences.minDaysBetweenShifts || 0,
        holidayPreferences: preferences.holidayPreferences || []
      }));
    }
  }, [preferences]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences(formData);
  };

  if (preferencesLoading || holidaysLoading || !holidayStats) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      <Card>
        <CardHeader>
          <CardTitle>Holiday Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HOLIDAYS_2024_2025.map((holiday) => {
                const assignment = holidayAssignments?.find(
                  (a: any) => a.date === holiday.date
                );
                return (
                  <TableRow key={holiday.date}>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>{new Date(holiday.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={assignment?.assigned ? "default" : "secondary"}>
                        {assignment?.assigned ? "Assigned" : "Unassigned"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {holidayStats?.priorities?.[holiday.date] || "Standard"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <p className="font-medium">Historical Coverage</p>
              <p className="text-sm text-muted-foreground">
                {holidayStats?.totalWorked || 0} holidays worked in the past year
              </p>
            </div>
            <div>
              <p className="font-medium">Distribution Fairness</p>
              <p className="text-sm text-muted-foreground">
                {holidayStats?.fairnessScore ? `${holidayStats.fairnessScore}% fair distribution` : 'No data available'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}