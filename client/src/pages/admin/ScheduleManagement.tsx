import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatDialog } from "@/components/scheduler/ChatDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ScheduleManagement() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const { toast } = useToast();

  const clearShifts = async () => {
    try {
      const res = await fetch("/api/shifts", {
        method: "DELETE",
      });
      
      if (!res.ok) throw new Error("Failed to clear shifts");
      
      toast({
        title: "Success",
        description: "All shifts have been cleared successfully",
      });
      setClearDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:py-6 relative">
      <ChatDialog currentPage="schedule" />
      <Card>
        <CardHeader>
          <CardTitle>Schedule Management</CardTitle>
          <CardDescription>
            Manage calendar data and perform administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Clear Calendar</h3>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setClearDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Clear Calendar
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Remove all shifts from the calendar. This action cannot be undone.
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Calendar Export</h3>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use this URL to subscribe to your calendar from external applications.
                  The calendar will automatically update when changes are made.
                </p>
                <div className="flex items-center gap-2">
                  <Input 
                    readOnly
                    value={`${window.location.origin}/api/schedules/export/all`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/schedules/export/all`);
                      toast({
                        title: "Copied!",
                        description: "Calendar URL copied to clipboard",
                      });
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This URL includes all shifts in iCalendar format. You can add this to
                  calendar applications like Google Calendar, Apple Calendar, or Outlook.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clear Calendar Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Shifts</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove all shifts from the calendar. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={clearShifts}
            >
              Clear All Shifts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
