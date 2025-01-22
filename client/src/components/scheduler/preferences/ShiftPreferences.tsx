
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
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

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
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
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      <ScrollArea className="flex-grow px-4">
        <form onSubmit={handleSubmit} className="space-y-6 pb-20">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Shift Settings</CardTitle>
                <CardDescription>Configure your basic shift preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredShiftLength">Preferred Shift Length (days)</Label>
                  <Input
                    id="preferredShiftLength"
                    type="number"
                    value={formData.preferredShiftLength}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferredShiftLength: parseInt(e.target.value) || 0
                    }))}
                    min={1}
                    max={14}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxShiftsPerWeek">Maximum Shifts per Week</Label>
                  <Input
                    id="maxShiftsPerWeek"
                    type="number"
                    value={formData.maxShiftsPerWeek}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      maxShiftsPerWeek: parseInt(e.target.value) || 0
                    }))}
                    min={1}
                    max={7}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minDaysBetweenShifts">Minimum Days Between Shifts</Label>
                  <Input
                    id="minDaysBetweenShifts"
                    type="number"
                    value={formData.minDaysBetweenShifts}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      minDaysBetweenShifts: parseInt(e.target.value) || 0
                    }))}
                    min={0}
                    max={90}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Holiday Schedule</CardTitle>
                <CardDescription>View your holiday assignments and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {HOLIDAYS.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>
                          <Badge variant={
                            formData.holidayPreferences.includes(holiday.id) 
                              ? "secondary"
                              : "outline"
                          }>
                            {formData.holidayPreferences.includes(holiday.id) 
                              ? "Preferred Off" 
                              : "No Preference"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </form>
      </ScrollArea>
      
      <div className="sticky bottom-0 bg-background p-4 border-t">
        <Button type="submit" className="w-full" disabled={isUpdating} onClick={handleSubmit}>
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
    </div>
  );
}
