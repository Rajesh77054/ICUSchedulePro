
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Calendar, Bell, UserCheck, AlertTriangle } from "lucide-react";
import { ShiftPreferences } from "@/components/scheduler/preferences/ShiftPreferences";

export function ScheduleManagement() {
  return (
    <div className="container mx-auto p-4 md:py-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Rules</CardTitle>
          <CardDescription>
            Scheduling rules and constraints for provider rotations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="physician" className="space-y-4">
            <TabsList>
              <TabsTrigger value="physician">Physician Rotations</TabsTrigger>
              <TabsTrigger value="app">APP Rotations</TabsTrigger>
              <TabsTrigger value="holiday">Holiday Coverage</TabsTrigger>
              <TabsTrigger value="coverage">Coverage Requirements</TabsTrigger>
            </TabsList>

            <TabsContent value="physician" className="space-y-4">
              <div className="border p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Weekly Shift Pattern</h3>
                </div>
                <div className="ml-7 space-y-2">
                  <p>All shifts run Friday through Thursday (24-hour coverage)</p>
                  <div className="space-y-1">
                    <p className="font-medium">Consecutive Week Rules:</p>
                    <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                      <li>Joseph Brading: Maximum 2 consecutive weeks allowed</li>
                      <li>Other physicians: No back-to-back weeks permitted</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="app" className="space-y-4">
              <div className="border p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">APP Coverage Groups</h3>
                </div>
                <div className="grid gap-4 ml-7">
                  <div>
                    <Badge>Daytime APPs</Badge>
                    <p className="mt-1 text-muted-foreground">8:00 AM - 8:00 PM</p>
                  </div>
                  <div>
                    <Badge variant="secondary">Night time APPs</Badge>
                    <p className="mt-1 text-muted-foreground">8:00 PM - 8:00 AM</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="holiday" className="space-y-4">
              <div className="border p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Holiday Coverage Requirements</h3>
                </div>
                <div className="ml-7 space-y-4">
                  <div>
                    <p className="font-medium">Provider Requirements:</p>
                    <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                      <li>Each provider must work minimum one holiday per year</li>
                      <li>All holidays require full coverage</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Distribution Rules:</p>
                    <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                      <li>Balanced across all provider groups (Physicians, Daytime APPs, Night time APPs)</li>
                      <li>Equitable year-over-year rotation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="coverage" className="space-y-4">
              <div className="border p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Annual Coverage Requirements</h3>
                </div>
                <div className="ml-7 space-y-2">
                  <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                    <li>Total coverage must equal 365 days annually</li>
                    <li>All shifts must be covered without gaps</li>
                  </ul>
                </div>

                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Uncovered shifts will be marked as TBD and trigger notifications
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
