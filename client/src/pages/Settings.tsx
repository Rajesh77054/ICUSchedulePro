import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PreferencesForm } from "@/components/scheduler/PreferencesForm";
import { useParams } from "wouter";

export function Settings() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="container mx-auto p-4 md:py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal Preferences</CardTitle>
          <CardDescription>
            Customize your calendar view and notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm userId={parseInt(userId || '0')} />
        </CardContent>
      </Card>
    </div>
  );
}