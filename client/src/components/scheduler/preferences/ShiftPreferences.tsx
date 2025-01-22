
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";

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

  if (preferencesLoading || holidaysLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shift Settings</CardTitle>
            <CardDescription>Configure your basic shift preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preferredShiftLength">Preferred Shift Length (days)</Label>
                <Input
                  id="preferredShiftLength"
                  name="preferredShiftLength"
                  type="number"
                  value={formData.preferredShiftLength}
                  onChange={handleInputChange}
                  min={1}
                  max={14}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxShiftsPerWeek">Maximum Shifts per Week</Label>
                <Input
                  id="maxShiftsPerWeek"
                  name="maxShiftsPerWeek"
                  type="number"
                  value={formData.maxShiftsPerWeek}
                  onChange={handleInputChange}
                  min={1}
                  max={7}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="minDaysBetweenShifts">Minimum Days Between Shifts</Label>
                <Input
                  id="minDaysBetweenShifts"
                  name="minDaysBetweenShifts"
                  type="number"
                  value={formData.minDaysBetweenShifts}
                  onChange={handleInputChange}
                  min={0}
                  max={90}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holiday Schedule</CardTitle>
            <CardDescription>View and manage your holiday assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HOLIDAYS.map((holiday) => {
                  const assignment = holidayAssignments?.find(
                    (a: any) => a.holidayId === holiday.id
                  );
                  return (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>
                        <Badge variant={assignment?.assigned ? "default" : "secondary"}>
                          {assignment?.assigned ? "Assigned" : "Unassigned"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formData.holidayPreferences?.includes(holiday.id) ? "Preferred Off" : "Standard"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isUpdating} className="min-w-[120px]">
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
