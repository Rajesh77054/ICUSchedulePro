import { Calendar } from "@/components/scheduler/Calendar";
import { ProviderList } from "@/components/scheduler/ProviderList";
import { Notifications } from "@/components/scheduler/Notifications";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ListFilter } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useQuery } from "@tanstack/react-query";

export function Dashboard() {
  const { isLoading: isLoadingShifts } = useQuery({
    queryKey: ["/api/shifts"],
  });

  const { isLoading: isLoadingProviders } = useQuery({
    queryKey: ["/api/providers"],
  });

  const isLoading = isLoadingShifts || isLoadingProviders;

  return (
    <div className="container mx-auto p-4 md:py-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">ICU Shift Schedule</h1>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/swap-requests" className="w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto">
              <ListFilter className="mr-2 h-4 w-4" />
              Swap Requests
            </Button>
          </Link>
          <div className="flex-shrink-0">
            <Notifications />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader size="lg" />
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          <div className="w-full">
            <Calendar />
          </div>
          <div className="w-full">
            <ProviderList />
          </div>
        </div>
      )}
    </div>
  );
}