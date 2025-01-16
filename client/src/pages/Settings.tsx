import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Calendar, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ShiftPreferences } from "./ShiftPreferences";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Settings() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("preferences");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: clearShifts } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shifts", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear shifts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Success",
        description: "All shifts have been cleared",
      });
      setClearDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-4 md:py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences">
          <ShiftPreferences />
        </TabsContent>

        <TabsContent value="admin">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Management</CardTitle>
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
          </div>
        </TabsContent>
      </Tabs>

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
            <AlertDialogAction onClick={() => clearShifts()}>
              Clear All Shifts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}