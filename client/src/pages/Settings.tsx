import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatDialog } from "@/components/scheduler/ChatDialog";

export function Settings() {
  return (
    <div className="container mx-auto p-4 md:py-6 relative">
      
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>
            Configure application-wide settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No system settings available at this time
          </div>
        </CardContent>
      </Card>
    </div>
  );
}