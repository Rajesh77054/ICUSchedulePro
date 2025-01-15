import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, Clock, Settings } from "lucide-react";
import { Link } from "wouter";
import { PROVIDERS } from "@/lib/constants";
import type { Shift, TimeOffRequest, ProviderPreferences } from "@/lib/types";
import { format, isAfter, isBefore, startOfWeek, endOfWeek } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TimeOffRequestForm, TimeOffRequestList } from "@/components/scheduler/TimeOffRequests";
import { PreferencesForm } from "@/components/scheduler/PreferencesForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function PersonalDashboard() {
  const { id } = useParams<{ id: string }>();
  const providerId = parseInt(id);
  const provider = PROVIDERS.find(p => p.id === providerId);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: timeOffRequests } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", providerId],
    queryFn: async () => {
      const url = new URL("/api/time-off-requests", window.location.origin);
      url.searchParams.append("providerId", providerId.toString());
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch time-off requests");
      return res.json();
    },
  });

  const { data: preferences } = useQuery<ProviderPreferences>({
    queryKey: ["/api/provider-preferences", providerId],
  });

  if (!provider) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p>Provider not found</p>
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

  const providerShifts = shifts?.filter(s => s.providerId === providerId) || [];
  const activeShifts = providerShifts.filter(s => s.status !== 'archived');

  const totalDays = activeShifts.reduce((acc, shift) => {
    const start = new Date(shift.startDate);
    const end = new Date(shift.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return acc + days;
  }, 0);

  const progress = Math.min((totalDays / provider.targetDays) * 100, 100);

  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const thisWeekShifts = activeShifts.filter(shift =>
    isAfter(new Date(shift.endDate), thisWeekStart) &&
    isBefore(new Date(shift.startDate), thisWeekEnd)
  );

  const upcomingShifts = activeShifts
    .filter(shift => isAfter(new Date(shift.endDate), new Date()))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {provider.name}, {provider.title}
          </h1>
          <p className="text-muted-foreground">Personal Schedule Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreferences(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </Button>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Schedule
            </Button>
          </Link>
        </div>
      </div>

      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preferences</DialogTitle>
          </DialogHeader>
          <PreferencesForm providerId={providerId} />
        </DialogContent>
      </Dialog>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Schedule Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Import QGenda Schedule</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const url = new FormData(form).get('qgendaUrl') as string;

                fetch('/api/integrations/qgenda/import-ical', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    subscriptionUrl: url,
                    providerId,
                  })
                })
                  .then(res => {
                    if (!res.ok) throw new Error('Failed to import schedule');
                    return res.json();
                  })
                  .then(data => {
                    toast({
                      title: 'Success',
                      description: `Successfully imported ${data.shifts?.length || 0} shifts from QGenda.`,
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
                      QGenda Subscription URL
                    </label>
                    <input
                      id="qgendaUrl"
                      name="qgendaUrl"
                      type="url"
                      className="w-full p-2 border rounded-md"
                      placeholder="Paste your QGenda subscription URL here"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Import your shifts directly from QGenda by pasting your iCal subscription URL here.
                    </p>
                  </div>
                  <Button type="submit">Import Schedule</Button>
                </div>
              </form>

              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Export Schedule</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Download your schedule in iCal format to import into your preferred calendar application.
                </p>
                <Button
                  onClick={() => {
                    window.location.href = `/api/schedules/export/${providerId}`;
                  }}
                  variant="outline"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Export as iCal
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Total Days</span>
                <span className="font-medium">
                  {totalDays} / {provider.targetDays}
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2"
                style={{
                  backgroundColor: `${provider.color}40`,
                  "--progress-background": provider.color,
                } as any}
              />
              {provider.tolerance && (
                <p className="text-sm text-muted-foreground">
                  Tolerance: ±{provider.tolerance} days
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-4xl font-bold">
                {thisWeekShifts.length} <span className="text-base font-normal text-muted-foreground">shifts</span>
              </p>
              {thisWeekShifts.length > 0 ? (
                <div className="space-y-2">
                  {thisWeekShifts.map(shift => (
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length > 0 ? (
              <div className="space-y-4">
                {upcomingShifts.map(shift => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: provider.color }}
                  >
                    <div>
                      <p className="font-medium">
                        {format(new Date(shift.startDate), 'MMM d, yyyy')} - {format(new Date(shift.endDate), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Math.ceil((new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                    </div>
                    <div className="text-sm">
                      {shift.status === 'confirmed' ? (
                        <span className="text-green-600 font-medium">Confirmed</span>
                      ) : shift.status === 'pending_swap' ? (
                        <span className="text-yellow-600 font-medium">Pending Swap</span>
                      ) : (
                        <span className="text-blue-600 font-medium">Swapped</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No upcoming shifts</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Time Off</CardTitle>
              <Button
                variant="outline"
                onClick={() => setShowTimeOffForm(!showTimeOffForm)}
              >
                {showTimeOffForm ? "Cancel" : "Request Time Off"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showTimeOffForm ? (
              <div className="mb-6">
                <TimeOffRequestForm
                  providerId={providerId}
                  onSuccess={() => setShowTimeOffForm(false)}
                  onCancel={() => setShowTimeOffForm(false)}
                />
              </div>
            ) : null}
            <TimeOffRequestList providerId={providerId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}