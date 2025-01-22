import { useState, useEffect } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

const preferencesSchema = z.object({
  preferredShiftLength: z.number().min(1).max(14),
  maxShiftsPerWeek: z.number().min(1).max(7),
  minDaysBetweenShifts: z.number().min(0).max(90),
  preferredDaysOfWeek: z.array(z.number()),
  avoidedDaysOfWeek: z.array(z.number()),
  defaultView: z.string(),
  defaultCalendarDuration: z.string(),
  notificationPreferences: z.object({
    emailNotifications: z.boolean(),
    inAppNotifications: z.boolean(),
    notifyOnNewShifts: z.boolean(),
    notifyOnSwapRequests: z.boolean(),
    notifyOnTimeOffUpdates: z.boolean(),
    notifyBeforeShift: z.number(),
  }),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

interface UserPreferences {
  id: number;
  userId: number;
  defaultView: string;
  defaultCalendarDuration: string;
  notificationPreferences: {
    emailNotifications: boolean;
    inAppNotifications: boolean;
    notifyOnNewShifts: boolean;
    notifyOnSwapRequests: boolean;
    notifyOnTimeOffUpdates: boolean;
    notifyBeforeShift: number;
  };
  preferredShiftLength: number;
  maxShiftsPerWeek: number;
  minDaysBetweenShifts: number;
  preferredDaysOfWeek: number[];
  avoidedDaysOfWeek: number[];
}

interface PreferencesFormProps {
  userId: number;
  onSuccess?: () => void;
}

export function PreferencesForm({ userId, onSuccess }: PreferencesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user-preferences", userId],
  });

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      preferredShiftLength: preferences?.preferredShiftLength || 7,
      maxShiftsPerWeek: preferences?.maxShiftsPerWeek || 1,
      minDaysBetweenShifts: preferences?.minDaysBetweenShifts || 0,
      preferredDaysOfWeek: preferences?.preferredDaysOfWeek || [],
      avoidedDaysOfWeek: preferences?.avoidedDaysOfWeek || [],
      defaultView: preferences?.defaultView || "",
      defaultCalendarDuration: preferences?.defaultCalendarDuration || "",
      notificationPreferences: preferences?.notificationPreferences || {
        emailNotifications: false,
        inAppNotifications: false,
        notifyOnNewShifts: false,
        notifyOnSwapRequests: false,
        notifyOnTimeOffUpdates: false,
        notifyBeforeShift: 0,
      },
    },
  });

  const { mutate: updatePreferences, isPending } = useMutation({
    mutationFn: async (data: PreferencesFormData) => {
      const res = await fetch(`/api/user-preferences/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId }),
      });

      if (!res.ok) {
        throw new Error("Failed to update preferences");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({ title: "Success", description: "Preferences updated successfully" });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => updatePreferences(data))}>
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
                      value={form.watch("defaultView")}
                      onValueChange={(value) => form.setValue("defaultView", value)}
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
                      value={form.watch("defaultCalendarDuration")}
                      onValueChange={(value) =>
                        form.setValue("defaultCalendarDuration", value)
                      }
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
                      <Label htmlFor="emailNotifications">
                        Email Notifications
                      </Label>
                      <Switch
                        id="emailNotifications"
                        checked={form.watch("notificationPreferences.emailNotifications")}
                        onCheckedChange={(checked) =>
                          form.setValue("notificationPreferences.emailNotifications", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="inAppNotifications">
                        In-App Notifications
                      </Label>
                      <Switch
                        id="inAppNotifications"
                        checked={form.watch("notificationPreferences.inAppNotifications")}
                        onCheckedChange={(checked) =>
                          form.setValue("notificationPreferences.inAppNotifications", checked)
                        }
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notificationPreferences.notifyBeforeShift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="notifyBeforeShift">
                            Hours Before Shift
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="notifyBeforeShift"
                              type="number"
                              min={1}
                              max={72}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value, 10))
                              }
                              className="w-24"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                <FormField
                  control={form.control}
                  name="preferredShiftLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Shift Length (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={14}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxShiftsPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Shifts per Week</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minDaysBetweenShifts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Days Between Shifts</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={90}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredDaysOfWeek"
                  render={() => (
                    <FormItem>
                      <FormLabel>Preferred Days of Week</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {DAYS_OF_WEEK.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              checked={form.watch("preferredDaysOfWeek").includes(day.value)}
                              onCheckedChange={(checked) => {
                                const current = form.watch("preferredDaysOfWeek");
                                const updated = checked
                                  ? [...current, day.value]
                                  : current.filter((d) => d !== day.value);
                                form.setValue("preferredDaysOfWeek", updated);
                              }}
                            />
                            <FormLabel className="font-normal">
                              {day.label}
                            </FormLabel>
                          </div>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avoidedDaysOfWeek"
                  render={() => (
                    <FormItem>
                      <FormLabel>Days to Avoid</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {DAYS_OF_WEEK.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              checked={form.watch("avoidedDaysOfWeek").includes(day.value)}
                              onCheckedChange={(checked) => {
                                const current = form.watch("avoidedDaysOfWeek");
                                const updated = checked
                                  ? [...current, day.value]
                                  : current.filter((d) => d !== day.value);
                                form.setValue("avoidedDaysOfWeek", updated);
                              }}
                            />
                            <FormLabel className="font-normal">
                              {day.label}
                            </FormLabel>
                          </div>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button type="submit" className="w-full mt-6" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </form>
    </Form>
  );
}