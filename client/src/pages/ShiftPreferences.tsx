import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PROVIDERS } from "@/lib/constants";
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

interface ProviderPreference {
  id: number;
  providerId: number;
  preferredShiftLength: number;
  preferredDaysOfWeek: number[];
  preferredCoworkers: number[];
  avoidedDaysOfWeek: number[];
  maxShiftsPerWeek: number;
  minDaysBetweenShifts: number;
  createdAt: string;
  updatedAt: string;
}

export function ShiftPreferences() {
  const [location] = useLocation();
  const [selectedProvider, setSelectedProvider] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse provider ID from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerId = params.get('provider');
    if (providerId) {
      setSelectedProvider(providerId);
    }
  }, []);

  const { data: preferences, isLoading } = useQuery<ProviderPreference[]>({
    queryKey: ["/api/provider-preferences", selectedProvider],
    enabled: !!selectedProvider,
  });

  const currentPreferences = preferences?.find(p => p.providerId === parseInt(selectedProvider ?? "0"));

  const { mutate: updatePreferences, isLoading: isUpdating } = useMutation({
    mutationFn: async (data: Partial<ProviderPreference>) => {
      const res = await fetch(`/api/provider-preferences/${selectedProvider}`, {
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
        description: "Shift preferences updated successfully",
      });
      // Reset provider selection after successful update to return to selection screen
      setSelectedProvider(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const preferredDaysOfWeek = DAYS_OF_WEEK
      .filter(day => formData.get(`preferred_${day.value}`))
      .map(day => parseInt(day.value));

    const avoidedDaysOfWeek = DAYS_OF_WEEK
      .filter(day => formData.get(`avoided_${day.value}`))
      .map(day => parseInt(day.value));

    const preferredCoworkers = PROVIDERS
      .filter(provider => formData.get(`coworker_${provider.id}`))
      .map(provider => provider.id);

    const data = {
      preferredShiftLength: parseInt(formData.get("preferredShiftLength") as string),
      maxShiftsPerWeek: parseInt(formData.get("maxShiftsPerWeek") as string),
      minDaysBetweenShifts: parseInt(formData.get("minDaysBetweenShifts") as string),
      preferredDaysOfWeek,
      avoidedDaysOfWeek,
      preferredCoworkers,
    };

    updatePreferences(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Preferences</CardTitle>
            <CardDescription>
              Customize your schedule and shift preferences to help optimize the scheduling process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label>Select Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id.toString()}>
                        {provider.name}, {provider.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProvider && currentPreferences && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Preferred Shift Length (days)</Label>
                      <Input
                        type="number"
                        name="preferredShiftLength"
                        defaultValue={currentPreferences.preferredShiftLength}
                        min={1}
                        max={14}
                      />
                    </div>

                    <div>
                      <Label>Maximum Shifts per Week</Label>
                      <Input
                        type="number"
                        name="maxShiftsPerWeek"
                        defaultValue={currentPreferences.maxShiftsPerWeek}
                        min={1}
                        max={7}
                      />
                    </div>

                    <div>
                      <Label>Minimum Days Between Shifts</Label>
                      <Input
                        type="number"
                        name="minDaysBetweenShifts"
                        defaultValue={currentPreferences.minDaysBetweenShifts}
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
                              name={`preferred_${day.value}`}
                              defaultChecked={currentPreferences.preferredDaysOfWeek.includes(
                                parseInt(day.value)
                              )}
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
                              name={`avoided_${day.value}`}
                              defaultChecked={currentPreferences.avoidedDaysOfWeek.includes(
                                parseInt(day.value)
                              )}
                            />
                            <Label htmlFor={`avoided_${day.value}`}>{day.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Preferred Coworkers</Label>
                      <div className="grid grid-cols-2 gap-4">
                        {PROVIDERS.filter(p => p.id !== parseInt(selectedProvider)).map((provider) => (
                          <div key={provider.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`coworker_${provider.id}`}
                              name={`coworker_${provider.id}`}
                              defaultChecked={currentPreferences.preferredCoworkers.includes(provider.id)}
                            />
                            <Label htmlFor={`coworker_${provider.id}`}>
                              {provider.name}, {provider.title}
                            </Label>
                          </div>
                        ))}
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
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}