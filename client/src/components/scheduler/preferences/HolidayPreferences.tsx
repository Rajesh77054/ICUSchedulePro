
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";

const HOLIDAYS = [
  { id: 'new_year', name: "New Year's Day" },
  { id: 'easter', name: "Easter Weekend" },
  { id: 'memorial', name: "Memorial Day" },
  { id: 'independence', name: "Independence Day" },
  { id: 'labor', name: "Labor Day" },
  { id: 'thanksgiving', name: "Thanksgiving" },
  { id: 'christmas', name: "Christmas Day" },
];

export function HolidayPreferences({ userId }: { userId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([]);

  const { data: assignments } = useQuery({
    queryKey: ["/api/holiday-assignments", userId],
    queryFn: async () => {
      const res = await fetch(`/api/holiday-assignments/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch holiday assignments");
      return res.json();
    },
  });

  const { mutate: updatePreferences } = useMutation({
    mutationFn: async (holidays: string[]) => {
      const res = await fetch(`/api/holiday-preferences/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidays }),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holiday-assignments"] });
      toast({
        title: "Success",
        description: "Holiday preferences updated successfully",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Holiday</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>History</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {HOLIDAYS.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell>{holiday.name}</TableCell>
                <TableCell>
                  {assignments?.find((a: any) => a.holidayId === holiday.id)?.status || 'Not Assigned'}
                </TableCell>
                <TableCell>
                  {assignments?.find((a: any) => a.holidayId === holiday.id)?.history || 'No history'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
