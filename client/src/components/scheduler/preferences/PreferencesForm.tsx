
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { HolidayPreferences } from "./HolidayPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PreferencesFormProps {
  userId: number;
}

export function PreferencesForm({ userId }: PreferencesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  const [formData, setFormData] = useState({
    defaultView: 'dayGridMonth',
    defaultCalendarDuration: 'month',
    preferredHolidays: [],
    notificationPreferences: {
      emailNotifications: true,
      inAppNotifications: true,
      notifyOnNewShifts: true,
      notifyOnSwapRequests: true,
      notifyOnTimeOffUpdates: true,
      notifyBeforeShift: 24,
    }
  });

  useEffect(() => {
    if (preferences) {
      setFormData(prev => ({
        ...prev,
        ...preferences,
        preferredHolidays: preferences.preferredHolidays || []
      }));
    }
  }, [preferences]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="shifts">Shift Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Holiday Preferences</CardTitle>
              <CardDescription>Select your preferred holidays for scheduling</CardDescription>
            </CardHeader>
            <CardContent>
              <HolidayPreferences 
                selectedHolidays={formData.preferredHolidays}
                onHolidayChange={(holidays) => {
                  setFormData(prev => ({
                    ...prev,
                    preferredHolidays: holidays
                  }));
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardContent>
              <div className="space-y-4">
                <ShiftPreferences userId={userId} isAdmin={true} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
