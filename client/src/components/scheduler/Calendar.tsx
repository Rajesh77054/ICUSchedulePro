import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks } from "date-fns";
import { PROVIDERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";

export function Calendar() {
  const [view, setView] = useState<"week" | "month" | "year">("week");
  const [date, setDate] = useState<Date>(new Date());

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const getProviderColor = (providerId: number) => {
    return PROVIDERS.find(p => p.id === providerId)?.color || "hsl(0, 0%, 50%)";
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Schedule</CardTitle>
        <div className="flex items-center space-x-2">
          <Select value={view} onValueChange={(v: "week" | "month" | "year") => setView(v)}>
            <SelectTrigger className="w-[120px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <CalendarComponent
            mode="single"
            selected={date}
            onSelect={(date) => date && setDate(date)}
            className="rounded-md"
            modifiers={{
              hasShift: shifts?.map(s => new Date(s.startDate)) || [],
            }}
            modifiersStyles={{
              hasShift: {
                backgroundColor: "var(--primary)",
                color: "white",
                borderRadius: "4px",
              },
            }}
          />
        </div>
        
        <div className="mt-4 space-y-1">
          {shifts?.map(shift => (
            <div
              key={shift.id}
              className="flex items-center p-2 rounded-md"
              style={{
                backgroundColor: getProviderColor(shift.providerId),
                color: "white",
              }}
            >
              <span className="flex-1">
                {PROVIDERS.find(p => p.id === shift.providerId)?.name}
              </span>
              <span>
                {format(new Date(shift.startDate), "MMM d")} - 
                {format(new Date(shift.endDate), "MMM d")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
