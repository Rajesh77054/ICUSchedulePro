import { useState } from "react";
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

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

export function ShiftPreferences() {
  const [selectedProvider, setSelectedProvider] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/provider-preferences", selectedProvider],
    enabled: !!selectedProvider,
  });

  const { mutate: updatePreferences } = useMutation({
    mutationFn: async (data: any) => {
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
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
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

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shift Preferences</CardTitle>
            <CardDescription>
              Customize your shift preferences to help optimize the scheduling process
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

              {selectedProvider && preferences && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Preferred Shift Length (days)</Label>
                      <Input
                        type="number"
                        name="preferredShiftLength"
                        defaultValue={preferences.preferredShiftLength}
                        min={1}
                        max={14}
                      />
                    </div>

                    <div>
                      <Label>Maximum Shifts per Week</Label>
                      <Input
                        type="number"
                        name="maxShiftsPerWeek"
                        defaultValue={preferences.maxShiftsPerWeek}
                        min={1}
                        max={7}
                      />
                    </div>

                    <div>
                      <Label>Minimum Days Between Shifts</Label>
                      <Input
                        type="number"
                        name="minDaysBetweenShifts"
                        defaultValue={preferences.minDaysBetweenShifts}
                        min={0}
                        max={30}
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
                              defaultChecked={preferences.preferredDaysOfWeek.includes(
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
                              defaultChecked={preferences.avoidedDaysOfWeek.includes(
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
                              defaultChecked={preferences.preferredCoworkers.includes(provider.id)}
                            />
                            <Label htmlFor={`coworker_${provider.id}`}>
                              {provider.name}, {provider.title}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Save Preferences
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
