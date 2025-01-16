import { useAuth } from "@/lib/auth";
import { PreferencesForm } from "@/components/scheduler/PreferencesForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ShiftPreferences() {
  const { user } = useAuth();
  const providerId = user?.provider?.id;

  if (!providerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shift Preferences</CardTitle>
          <CardDescription>
            Configure your shift preferences and scheduling settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You need to be a provider to access shift preferences.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift Preferences</CardTitle>
        <CardDescription>
          Configure your shift preferences and scheduling settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PreferencesForm providerId={providerId} />
      </CardContent>
    </Card>
  );
}
