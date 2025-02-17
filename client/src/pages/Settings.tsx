import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function Settings() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clearShifts = async () => {
    try {
      console.log('Initiating calendar clear operation...');

      const res = await fetch("/api/shifts", {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to clear shifts");
      }

      const response = await res.json();
      console.log('Clear shifts response:', response);

      // More aggressive cache handling
      await queryClient.cancelQueries();
      queryClient.clear();

      // Reset the shifts cache explicitly
      queryClient.setQueryData(["/api/shifts"], []);

      // Force immediate refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/shifts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] })
      ]);

      // Dispatch calendar refresh events
      window.dispatchEvent(new Event('forceCalendarRefresh'));

      toast({
        title: "Success",
        description: `Successfully cleared ${response.clearedShifts.length} shifts`,
      });
      setClearDialogOpen(false);
    } catch (error: any) {
      console.error('Error in clearShifts:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:py-6 relative">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Configure application-wide settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No system settings available at this time
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Management</CardTitle>
            <CardDescription>Manage calendar data and perform administrative tasks</CardDescription>
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
      </div>

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