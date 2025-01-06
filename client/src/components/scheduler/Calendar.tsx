import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear, subWeeks, subMonths, subYears, addYears } from "date-fns";
import { PROVIDERS } from "@/lib/constants";
import type { Shift } from "@/lib/types";

export function Calendar() {
  const [view, setView] = useState<"week" | "month" | "year">("week");
  const [date, setDate] = useState<Date>(new Date());

  const getDateRange = () => {
    switch (view) {
      case "week":
        return {
          start: startOfWeek(date, { weekStartsOn: 5 }), // Start from Friday
          end: endOfWeek(date, { weekStartsOn: 5 }),
        };
      case "month":
        return {
          start: startOfMonth(date),
          end: endOfMonth(date),
        };
      case "year":
        return {
          start: startOfYear(date),
          end: endOfYear(date),
        };
    }
  };

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", view, getDateRange()],
  });

  const getProviderColor = (providerId: number) => {
    return PROVIDERS.find(p => p.id === providerId)?.color || "hsl(0, 0%, 50%)";
  };

  const renderShifts = () => {
    if (!shifts?.length) return <div className="text-muted-foreground">No shifts scheduled</div>;

    return shifts.map(shift => (
      <div
        key={shift.id}
        className="flex items-center p-2 rounded-md mb-2"
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
    ));
  };

  const handlePrevious = () => {
    switch (view) {
      case "week":
        setDate(subWeeks(date, 1));
        break;
      case "month":
        setDate(subMonths(date, 1));
        break;
      case "year":
        setDate(subYears(date, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case "week":
        setDate(addWeeks(date, 1));
        break;
      case "month":
        setDate(addMonths(date, 1));
        break;
      case "year":
        setDate(addYears(date, 1));
        break;
    }
  };

  const renderCalendarHeader = () => {
    const range = getDateRange();
    switch (view) {
      case "week":
        return `${format(range.start, "MMM d")} - ${format(range.end, "MMM d, yyyy")}`;
      case "month":
        return format(date, "MMMM yyyy");
      case "year":
        return format(date, "yyyy");
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-xl font-bold">{renderCalendarHeader()}</CardTitle>
        </div>
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
        <div className="rounded-md border mb-4">
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
            numberOfMonths={view === "year" ? 12 : view === "month" ? 1 : 1}
            showOutsideDays={view !== "year"}
          />
        </div>

        <div className="space-y-1">
          {renderShifts()}
        </div>
      </CardContent>
    </Card>
  );
}