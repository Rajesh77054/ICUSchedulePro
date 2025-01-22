import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Formik, Form, Field } from "formik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import * as z from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";
import { HolidayPreferences } from "./HolidayPreferences";

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
  minPhysiciansPerHoliday: z.number().min(1), // Added
  minAPPsPerHoliday: z.number().min(1),       // Added
  enforceYearlyRotation: z.boolean(),         // Added
  allowConsecutiveHolidays: z.boolean(),      // Added
});

type PreferencesFormProps = {
  userId: number;
};

export function PreferencesForm({ userId }: PreferencesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  const { mutate: updatePreferences, isPending: isUpdating } = useMutation({
    mutationFn: async (values: z.infer<typeof preferencesSchema>) => {
      const res = await fetch(`/api/user-preferences/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({
        title: "Success",
        description: "Preferences updated successfully"
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const initialValues = {
    preferredShiftLength: preferences?.preferredShiftLength || 7,
    maxShiftsPerWeek: preferences?.maxShiftsPerWeek || 1,
    minDaysBetweenShifts: preferences?.minDaysBetweenShifts || 0,
    preferredDaysOfWeek: preferences?.preferredDaysOfWeek || [],
    avoidedDaysOfWeek: preferences?.avoidedDaysOfWeek || [],
    minPhysiciansPerHoliday: preferences?.minPhysiciansPerHoliday || 1, // Added
    minAPPsPerHoliday: preferences?.minAPPsPerHoliday || 1,       // Added
    enforceYearlyRotation: preferences?.enforceYearlyRotation || false, // Added
    allowConsecutiveHolidays: preferences?.allowConsecutiveHolidays || false, // Added
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={toFormikValidationSchema(preferencesSchema)}
      onSubmit={(values) => {
        const parsedValues = {
          ...values,
          preferredShiftLength: Number(values.preferredShiftLength),
          maxShiftsPerWeek: Number(values.maxShiftsPerWeek),
          minDaysBetweenShifts: Number(values.minDaysBetweenShifts),
          minPhysiciansPerHoliday: Number(values.minPhysiciansPerHoliday), // Added
          minAPPsPerHoliday: Number(values.minAPPsPerHoliday), // Added

        };
        updatePreferences(parsedValues);
      }}
      enableReinitialize
    >
      {({ values, setFieldValue }) => (
        <>
          <Form className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Preferred Shift Length (days)</Label>
                <Field
                  name="preferredShiftLength"
                  type="number"
                  min={1}
                  max={14}
                  as={Input}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Maximum Shifts per Week</Label>
                <Field
                  name="maxShiftsPerWeek"
                  type="number"
                  min={1}
                  max={7}
                  as={Input}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Minimum Days Between Shifts</Label>
                <Field
                  name="minDaysBetweenShifts"
                  type="number"
                  min={0}
                  max={90}
                  as={Input}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="mb-2 block">Preferred Days</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={values.preferredDaysOfWeek.includes(day.value)}
                        onCheckedChange={(checked) => {
                          const current = values.preferredDaysOfWeek;
                          const updated = checked
                            ? [...current, day.value]
                            : current.filter((d) => d !== day.value);
                          setFieldValue("preferredDaysOfWeek", updated);
                        }}
                      />
                      <Label>{day.label}</Label>
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
                        checked={values.avoidedDaysOfWeek.includes(day.value)}
                        onCheckedChange={(checked) => {
                          const current = values.avoidedDaysOfWeek;
                          const updated = checked
                            ? [...current, day.value]
                            : current.filter((d) => d !== day.value);
                          setFieldValue("avoidedDaysOfWeek", updated);
                        }}
                      />
                      <Label>{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Provider Group Settings</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label>Minimum Physicians per Holiday</Label>
                        <Field
                          name="minPhysiciansPerHoliday"
                          type="number"
                          min={1}
                          as={Input}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Minimum APPs per Holiday</Label>
                        <Field
                          name="minAPPsPerHoliday"
                          type="number"
                          min={1}
                          as={Input}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Holiday Rotation Rules</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <Field
                          type="checkbox"
                          name="enforceYearlyRotation"
                          as={Checkbox}
                        />
                        <Label>Enforce yearly holiday rotation</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Field
                          type="checkbox"
                          name="allowConsecutiveHolidays"
                          as={Checkbox}
                        />
                        <Label>Allow consecutive holiday assignments</Label>
                      </div>
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
              </div>
          </Form>
          <div className="mt-8">
            <HolidayPreferences userId={userId} />
          </div>
        </>
      )}
    </Formik>
  );
}