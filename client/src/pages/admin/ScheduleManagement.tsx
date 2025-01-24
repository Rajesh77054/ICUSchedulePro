import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatDialog } from "@/components/scheduler/ChatDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ScheduleManagement() {
  return (
    <div className="container mx-auto p-4 md:py-6 relative">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Rules</CardTitle>
          <CardDescription>
            Configure scheduling rules and constraints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No scheduling rules configured at this time
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-4 right-4">
        <ChatDialog />
      </div>
    </div>
  );
}