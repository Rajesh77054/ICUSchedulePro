import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, Clock, Sliders } from "lucide-react";
import { Link } from "wouter";
import { PROVIDERS } from "@/lib/constants";
import type { Shift, TimeOffRequest } from "@/lib/types";
import { format, isAfter, isBefore, startOfWeek, endOfWeek } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function PersonalDashboard() {
  const { id } = useParams<{ id: string }>();
  const providerId = parseInt(id);
  const provider = PROVIDERS.find(p => p.id === providerId);

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: timeOffRequests } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests", providerId],
    queryFn: async ({ queryKey }) => {
      const [_, providerId] = queryKey;
      const url = new URL("/api/time-off-requests", window.location.origin);
      url.searchParams.append("providerId", providerId.toString());
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch time-off requests");
      return res.json();
    },
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
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const providerShifts = shifts?.filter(s => s.providerId === providerId) || [];

  // Calculate total days worked
  const totalDays = providerShifts.reduce((acc, shift) => {
    const start = new Date(shift.startDate);
    const end = new Date(shift.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return acc + days;
  }, 0);

  // Calculate progress
  const progress = Math.min((totalDays / provider.targetDays) * 100, 100);

  // Get upcoming shifts
  const upcomingShifts = providerShifts
    .filter(shift => isAfter(new Date(shift.endDate), new Date()))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  // Calculate weekly stats
  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const thisWeekShifts = providerShifts.filter(shift =>
    isAfter(new Date(shift.endDate), thisWeekStart) &&
    isBefore(new Date(shift.startDate), thisWeekEnd)
  );

  // Get pending time-off requests
  const pendingTimeOff = timeOffRequests?.filter(req => req.status === 'pending') || [];

  // Get upcoming approved time-off
  const upcomingTimeOff = timeOffRequests
    ?.filter(req =>
      req.status === 'approved' &&
      isAfter(new Date(req.endDate), new Date())
    )
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5) || [];

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
          <Link href={`/preferences?provider=${provider.id}`}>
            <Button variant="outline">
              <Sliders className="mr-2 h-4 w-4" />
              Shift Preferences
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

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

        <Card>
          <CardHeader>
            <CardTitle>Time Off Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingTimeOff.length > 0 ? (
              <div className="space-y-4">
                {pendingTimeOff.map(request => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm">
                        {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No pending time-off requests</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Time Off</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTimeOff.length > 0 ? (
              <div className="space-y-4">
                {upcomingTimeOff.map(timeOff => (
                  <div
                    key={timeOff.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(timeOff.status)}
                      </div>
                      <p className="text-sm">
                        {format(new Date(timeOff.startDate), 'MMM d, yyyy')} - {format(new Date(timeOff.endDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No upcoming approved time-off</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}