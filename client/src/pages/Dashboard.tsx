import { Calendar } from "@/components/scheduler/Calendar";
import { ProviderList } from "@/components/scheduler/ProviderList";
import { Notifications } from "@/components/scheduler/Notifications";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ListFilter } from "lucide-react";

export function Dashboard() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">ICU Shift Schedule</h1>
        <div className="flex items-center gap-4">
          <Link href="/swap-requests">
            <Button variant="outline">
              <ListFilter className="mr-2 h-4 w-4" />
              Swap Requests
            </Button>
          </Link>
          <Notifications />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Calendar />
        </div>
        <div>
          <ProviderList />
        </div>
      </div>
    </div>
  );
}