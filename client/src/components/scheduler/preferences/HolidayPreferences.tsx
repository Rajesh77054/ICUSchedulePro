
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

const HOLIDAYS = [
  { id: 'new_year', name: "New Year's Day" },
  { id: 'easter', name: "Easter Weekend" },
  { id: 'memorial', name: "Memorial Day" },
  { id: 'independence', name: "Independence Day" },
  { id: 'labor', name: "Labor Day" },
  { id: 'thanksgiving', name: "Thanksgiving" },
  { id: 'christmas', name: "Christmas Day" },
];

type HolidayPreferencesProps = {
  userId: number;
};

export function HolidayPreferences({ userId }: HolidayPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/holiday-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/holiday-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch holiday preferences");
      return res.json();
    },
  });

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (preferences: { preferredHolidays: string[], avoidedHolidays: string[] }) => {
      const res = await fetch(`/api/holiday-preferences/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error("Failed to update holiday preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holiday-preferences"] });
      toast({
        title: "Success",
        description: "Holiday preferences updated successfully",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Preferred Holidays</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HOLIDAYS.map((holiday) => (
                <div key={holiday.id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={preferences?.preferredHolidays?.includes(holiday.id)}
                    onCheckedChange={(checked) => {
                      const preferredHolidays = preferences?.preferredHolidays || [];
                      const avoidedHolidays = preferences?.avoidedHolidays || [];
                      
                      updatePreferences({
                        preferredHolidays: checked 
                          ? [...preferredHolidays, holiday.id]
                          : preferredHolidays.filter(h => h !== holiday.id),
                        avoidedHolidays: checked
                          ? avoidedHolidays.filter(h => h !== holiday.id)
                          : avoidedHolidays
                      });
                    }}
                  />
                  <Label>{holiday.name}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Holidays to Avoid</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HOLIDAYS.map((holiday) => (
                <div key={holiday.id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={preferences?.avoidedHolidays?.includes(holiday.id)}
                    onCheckedChange={(checked) => {
                      const preferredHolidays = preferences?.preferredHolidays || [];
                      const avoidedHolidays = preferences?.avoidedHolidays || [];

                      updatePreferences({
                        avoidedHolidays: checked
                          ? [...avoidedHolidays, holiday.id]
                          : avoidedHolidays.filter(h => h !== holiday.id),
                        preferredHolidays: checked
                          ? preferredHolidays.filter(h => h !== holiday.id)
                          : preferredHolidays
                      });
                    }}
                  />
                  <Label>{holiday.name}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Holiday History</h3>
            <div className="space-y-2">
              {preferences?.history?.map((entry: any) => (
                <div key={entry.holiday} className="flex items-center justify-between">
                  <span>{entry.holiday}</span>
                  <Badge variant="secondary">{entry.year}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
