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
import { Calendar, Download, Link, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { ShiftPreferences } from "@/components/scheduler/ShiftPreferences";

export function Settings() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("preferences");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

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

  const isAdmin = user?.role === 'admin';

  return (
    <div className="container mx-auto p-4 md:py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="preferences">
          <ShiftPreferences />
        </TabsContent>

        {isAdmin && (
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
                      <h3 className="text-lg font-medium mb-4">Calendar Export Options</h3>
                      <div className="space-y-4">
                        <div>
                          <Label>Public Calendar URL (All Shifts)</Label>
                          <div className="flex items-center gap-2 mt-2">
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
                              <Link className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            Use this URL to subscribe to the complete calendar in external applications.
                          </p>
                        </div>

                        <div>
                          <Label>Download Calendar File</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                window.location.href = '/api/schedules/export/all';
                              }}
                            >
                              <Download className="h-4 w-4" />
                              Download ICS File
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            Download the calendar as an ICS file for importing into your calendar application.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
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