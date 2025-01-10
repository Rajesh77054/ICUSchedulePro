import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface PreferencesFormProps {
  providerId: number;
}

export function PreferencesForm({ providerId }: PreferencesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/provider-preferences", providerId],
  });

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/provider-preferences/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-preferences"] });
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
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
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

          <Button type="submit" className="w-full" disabled={isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
