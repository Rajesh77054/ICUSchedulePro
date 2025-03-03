import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

interface PreferencesFormProps {
  userId: number;
}

export function PreferencesForm({ userId }: PreferencesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
  });

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/user-preferences/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({
        title: "Success",
        description: "Preferences updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState({
    // General preferences
    defaultView: preferences?.defaultView || 'dayGridMonth',
    defaultCalendarDuration: preferences?.defaultCalendarDuration || 'month',
    notificationPreferences: preferences?.notificationPreferences || {
      emailNotifications: true,
      inAppNotifications: true,
      notifyOnNewShifts: true,
      notifyOnSwapRequests: true,
      notifyOnTimeOffUpdates: true,
      notifyBeforeShift: 24,
    },
    // Shift preferences
    preferredShiftLength: preferences?.preferredShiftLength || 1,
    maxShiftsPerWeek: preferences?.maxShiftsPerWeek || 5,
    minDaysBetweenShifts: preferences?.minDaysBetweenShifts || 1,
    preferredDaysOfWeek: preferences?.preferredDaysOfWeek || [],
    avoidedDaysOfWeek: preferences?.avoidedDaysOfWeek || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="shifts">Shift Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Preferences</CardTitle>
              <CardDescription>
                Customize your calendar view and notification settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Default Calendar View</Label>
                  <Select
                    value={formData.defaultView}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      defaultView: value,
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dayGridMonth">Month</SelectItem>
                      <SelectItem value="dayGridWeek">Week</SelectItem>
                      <SelectItem value="listWeek">List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Default Calendar Duration</Label>
                  <Select
                    value={formData.defaultCalendarDuration}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      defaultCalendarDuration: value,
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <Switch
                      id="emailNotifications"
                      checked={formData.notificationPreferences.emailNotifications}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          emailNotifications: checked,
                        },
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="inAppNotifications">In-App Notifications</Label>
                    <Switch
                      id="inAppNotifications"
                      checked={formData.notificationPreferences.inAppNotifications}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          inAppNotifications: checked,
                        },
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyOnNewShifts">Notify on New Shifts</Label>
                    <Switch
                      id="notifyOnNewShifts"
                      checked={formData.notificationPreferences.notifyOnNewShifts}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          notifyOnNewShifts: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyOnSwapRequests">Notify on Swap Requests</Label>
                    <Switch
                      id="notifyOnSwapRequests"
                      checked={formData.notificationPreferences.notifyOnSwapRequests}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          notifyOnSwapRequests: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyOnTimeOffUpdates">Notify on Time Off Updates</Label>
                    <Switch
                      id="notifyOnTimeOffUpdates"
                      checked={formData.notificationPreferences.notifyOnTimeOffUpdates}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          notifyOnTimeOffUpdates: checked,
                        },
                      }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle>Shift Preferences</CardTitle>
              <CardDescription>
                Set your preferred shift schedule and working patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Preferred Shift Length (days)</Label>
                  <Input
                    type="number"
                    value={formData.preferredShiftLength}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferredShiftLength: parseInt(e.target.value),
                    }))}
                    min={1}
                    max={14}
                  />
                </div>

                <div>
                  <Label>Maximum Shifts per Week</Label>
                  <Input
                    type="number"
                    value={formData.maxShiftsPerWeek}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      maxShiftsPerWeek: parseInt(e.target.value),
                    }))}
                    min={1}
                    max={7}
                  />
                </div>

                <div>
                  <Label>Minimum Days Between Shifts</Label>
                  <Input
                    type="number"
                    value={formData.minDaysBetweenShifts}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      minDaysBetweenShifts: parseInt(e.target.value),
                    }))}
                    min={0}
                    max={90}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Preferred Days of Week</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`preferred_${day.value}`}
                          checked={formData.preferredDaysOfWeek.includes(parseInt(day.value))}
                          onCheckedChange={(checked) => {
                            const value = parseInt(day.value);
                            setFormData(prev => ({
                              ...prev,
                              preferredDaysOfWeek: checked
                                ? [...prev.preferredDaysOfWeek, value]
                                : prev.preferredDaysOfWeek.filter(d => d !== value),
                            }));
                          }}
                        />
                        <Label htmlFor={`preferred_${day.value}`}>{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Days to Avoid</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`avoided_${day.value}`}
                          checked={formData.avoidedDaysOfWeek.includes(parseInt(day.value))}
                          onCheckedChange={(checked) => {
                            const value = parseInt(day.value);
                            setFormData(prev => ({
                              ...prev,
                              avoidedDaysOfWeek: checked
                                ? [...prev.avoidedDaysOfWeek, value]
                                : prev.avoidedDaysOfWeek.filter(d => d !== value),
                            }));
                          }}
                        />
                        <Label htmlFor={`avoided_${day.value}`}>{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button type="submit" className="w-full mt-6" disabled={isUpdating}>
        {isUpdating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Preferences"
        )}
      </Button>
    </form>
  );
}