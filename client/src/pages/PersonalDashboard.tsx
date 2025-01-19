import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, Clock, Settings, Share2, X } from "lucide-react";
import { Link } from "wouter";
import { USERS } from "@/lib/constants";
import type { Shift, TimeOffRequest } from "@/lib/types";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TimeOffRequestForm } from "@/components/time-off/TimeOffRequestForm";
import { PreferencesForm } from "@/components/scheduler/preferences/PreferencesForm";
import { SwapRequestActions } from "@/components/scheduler/SwapRequestActions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export function PersonalDashboard() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id);
  const user = USERS.find(p => p.id === userId);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query time off requests for this user
  const { data: timeOffRequests } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", userId],
    queryFn: async () => {
      const url = new URL("/api/time-off-requests", window.location.origin);
      url.searchParams.append("userId", userId.toString());
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch time-off requests");
      return res.json();
    },
  });

  // Get shifts for this user
  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", userId],
    queryFn: async () => {
      const url = new URL("/api/shifts", window.location.origin);
      url.searchParams.append("userId", userId.toString());
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
  });


  // Get all swap requests for the user
  const { data: swapRequests } = useQuery({
    queryKey: ['/api/swap-requests', userId],
    queryFn: async () => {
      const res = await fetch(`/api/swap-requests?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch swap requests');
      return res.json();
    },
  });

  const handleShiftActions = (shift: Shift) => {
    console.log('handleShiftActions - shift:', shift);

    // Show all pending requests related to this shift where user is either requestor or recipient
    const relevantRequests = swapRequests?.filter(req => 
      req.shiftId === shift.id && 
      req.status === 'pending' &&
      (req.requestorId === userId || req.recipientId === userId)
    );

    if (relevantRequests?.length > 0) {
      return relevantRequests.map(request => (
        <SwapRequestActions key={request.id} request={request} />
      ));
    }

    return null;
  };

  // Get all shifts that have pending requests where user is recipient
  const incomingSwapShifts = swapRequests
    ?.filter(req => req.status === 'pending' && req.recipientId === userId)
    .map(req => req.shift) || [];

  // Combine user's shifts with incoming swap request shifts
  const shiftsToDisplay = [
    ...(shifts || []),
    ...incomingSwapShifts
  ].filter((shift, index, self) => 
    // Remove duplicates
    index === self.findIndex(s => s.id === shift.id)
  );

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p>User not found</p>
            <Link href="/">
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Schedule
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userShifts = shifts || [];
  const activeTimeOffRequests = timeOffRequests?.filter(req => req.status === 'pending') || [];
  const pastTimeOffRequests = timeOffRequests?.filter(req => req.status !== 'pending') || [];

  const totalDays = userShifts.reduce((acc, shift) => {
    const start = new Date(shift.startDate);
    const end = new Date(shift.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return acc + days;
  }, 0);

  const progress = Math.min((totalDays / user.targetDays) * 100, 100);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {user.name}, {user.title}
          </h1>
          <p className="text-muted-foreground">Personal Schedule Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowPreferences(true)} variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </Button>
          <Button onClick={() => setShowTimeOffForm(true)}>
            Request Time Off
          </Button>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* Preferences Dialog */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Schedule Preferences</DialogTitle>
            <DialogDescription>
              Customize your schedule preferences and notification settings
            </DialogDescription>
          </DialogHeader>
          <PreferencesForm
            userId={userId}
            onSuccess={() => {
              setShowPreferences(false);
              toast({
                title: "Success",
                description: "Preferences updated successfully",
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Time Off Request Dialog */}
      <Dialog open={showTimeOffForm} onOpenChange={setShowTimeOffForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
          </DialogHeader>
          <TimeOffRequestForm
            userId={userId}
            onSuccess={() => {
              setShowTimeOffForm(false);
              queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
              toast({
                title: "Success",
                description: "Time off request submitted successfully",
              });
            }}
            onCancel={() => setShowTimeOffForm(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Total Days</span>
                <span className="font-medium">
                  {totalDays} / {user.targetDays}
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2"
                style={{
                  backgroundColor: `${user.color}40`,
                  "--progress-background": user.color,
                } as any}
              />
              {user.tolerance && (
                <p className="text-sm text-muted-foreground">
                  Tolerance: ±{user.tolerance} days
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* This Week's Shifts */}
        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-4xl font-bold">
                {userShifts.length} <span className="text-base font-normal text-muted-foreground">shifts</span>
              </p>
              {userShifts.length > 0 ? (
                <div className="space-y-2">
                  {userShifts.map(shift => (
                    <div key={shift.id} className="text-sm">
                      {format(new Date(shift.startDate), 'MMM d')} - {format(new Date(shift.endDate), 'MMM d')}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No shifts this week</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Shifts - Full Width */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {userShifts.length > 0 ? (
              <div className="space-y-4">
                {userShifts.map(shift => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: user.color }}
                  >
                    <div className="flex-grow">
                      <p className="font-medium">
                        {format(new Date(shift.startDate), 'MMM d, yyyy')} - {format(new Date(shift.endDate), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Math.ceil((new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                      <div className="mt-2">
                        {shift.status === 'confirmed' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Confirmed
                          </Badge>
                        )}
                        {shift.status === 'pending_swap' && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pending Swap
                          </Badge>
                        )}
                        {shift.status === 'swapped' && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Swapped
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {handleShiftActions(shift)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No upcoming shifts</p>
            )}
          </CardContent>
        </Card>

        {/* Time Off Requests Section */}
        {/* Active Time Off Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Time Off Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {activeTimeOffRequests.length === 0 ? (
              <p className="text-muted-foreground">No pending time off requests</p>
            ) : (
              <div className="space-y-4">
                {activeTimeOffRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                          {format(new Date(request.endDate), "MMM d, yyyy")}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Time Off Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Past Time Off Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {pastTimeOffRequests.length === 0 ? (
              <p className="text-muted-foreground">No past time off requests</p>
            ) : (
              <div className="space-y-4">
                {pastTimeOffRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                          {format(new Date(request.endDate), "MMM d, yyyy")}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            request.status === 'approved'
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                        {request.reason && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {request.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Integration - Full Width */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Schedule Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Import External Calendar</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const url = new FormData(form).get('qgendaUrl') as string;

                  fetch('/api/integrations/qgenda/import-ical', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      subscriptionUrl: url,
                      userId,
                    })
                  })
                    .then(res => {
                      if (!res.ok) throw new Error('Failed to import schedule');
                      return res.json();
                    })
                    .then(data => {
                      toast({
                        title: 'Success',
                        description: `Successfully imported ${data.shifts?.length || 0} shifts.`,
                      });
                      form.reset();
                      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
                    })
                    .catch(error => {
                      toast({
                        title: 'Error',
                        description: error.message,
                        variant: 'destructive'
                      });
                    });
                }}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="qgendaUrl" className="block text-sm font-medium mb-2">
                        Calendar Subscription URL
                      </label>
                      <input
                        id="qgendaUrl"
                        name="qgendaUrl"
                        type="url"
                        className="w-full p-2 border rounded-md"
                        placeholder="Paste your calendar subscription URL here"
                        required
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Import your shifts from external calendar systems.
                      </p>
                    </div>
                    <Button type="submit">Import Schedule</Button>
                  </div>
                </form>

                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">Export Schedule</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Export your schedule to your preferred calendar application.
                  </p>

                  <div className="flex flex-col gap-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <Share2 className="mr-2 h-4 w-4" />
                          Export Calendar
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(`/api/schedules/${userId}/google`, '_blank');
                          }}
                        >
                          <img
                            src="https://www.google.com/calendar/images/ext/gc_button1.gif"
                            alt="Add to Google Calendar"
                            className="mr-2 h-4"
                          />
                          Add to Google Calendar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            window.location.href = `/api/schedules/${userId}/outlook`;
                          }}
                        >
                          <img
                            src="https://outlook.office.com/owa/favicon.ico"
                            alt="Add to Outlook"
                            className="mr-2 h-4"
                          />
                          Add to Outlook
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            window.location.href = `/api/schedules/${userId}/ical`;
                          }}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Export as iCal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <Clock className="mr-2 h-4 w-4" />
                          Subscribe to Updates
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Calendar Subscription</DialogTitle>
                          <DialogDescription>
                            Use this URL to automatically sync schedule changes with your calendar app.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              value={`${window.location.origin}/api/schedules/${userId}/feed`}
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/api/schedules/${userId}/feed`);
                                toast({
                                  title: "Copied!",
                                  description: "Calendar subscription URL copied to clipboard",
                                });
                              }}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium">How to Subscribe:</h4>
                            <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                              <li>Copy the URL above</li>
                              <li>In your calendar app, look for "Add Calendar" or "Subscribe"</li>
                              <li>Paste the URL when prompted</li>
                              <li>Your calendar will now automatically sync with schedule updates</li>
                            </ul>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}