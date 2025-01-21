import { Calendar } from "@/components/scheduler/Calendar";
import { ProviderList } from "@/components/scheduler/ProviderList";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ListFilter, UserPlus } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useQuery } from "@tanstack/react-query";
import type { Shift, User } from "@/lib/types";
import { ChatDialog } from "@/components/scheduler/ChatDialog";

export function Dashboard() {
  const { data: shifts, isLoading: isLoadingShifts, error: shiftsError } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 1000,
    queryFn: async () => {
      const response = await fetch('/api/shifts');
      if (!response.ok) {
        throw new Error('Failed to fetch shifts');
      }
      return response.json();
    }
  });

  const { data: users, isLoading: isLoadingUsers, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    }
  });

  const isLoading = isLoadingShifts || isLoadingUsers;
  const hasError = shiftsError || usersError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (shiftsError || usersError) {
    console.error('Shifts error:', shiftsError);
    console.error('Users error:', usersError);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-destructive">
          {shiftsError ? 'Error loading shifts: ' + shiftsError.message : ''}
          {usersError ? 'Error loading users: ' + usersError.message : ''}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">ICU Shift Schedule</h1>
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Request Time Off
          </Button>
          <Link href="/swap-requests" className="w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto">
              <ListFilter className="mr-2 h-4 w-4" />
              Swap Requests
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 md:gap-6">
        <div className="w-full">
          <Calendar shifts={shifts || []} />
        </div>

        <div className="w-full lg:max-w-[300px]">
          <ProviderList users={users} />
        </div>
      </div>

      {/* Floating AI Assistant Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <ChatDialog 
          currentPage="dashboard" 
          pageContext={{
            shifts: Array.isArray(shifts) ? shifts.filter(s => s !== null) : [],
            requests: [],
            lastUpdate: new Date().toISOString()
          }}
        />
      </div>
    </div>
  );
}