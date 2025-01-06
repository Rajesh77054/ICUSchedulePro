import { Calendar } from "@/components/scheduler/Calendar";
import { ProviderList } from "@/components/scheduler/ProviderList";

export function Dashboard() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">ICU Shift Schedule</h1>
      
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
