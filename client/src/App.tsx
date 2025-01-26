import { Switch, Route } from "wouter";
import { Dashboard } from "@/pages/Dashboard";
import { PersonalDashboard } from "@/pages/PersonalDashboard";
import { SwapRequestsDashboard } from "@/pages/SwapRequestsDashboard";
import { TimeOffRequests } from "@/components/time-off/TimeOffRequests";
import { TimeOffAdmin } from "@/components/time-off/TimeOffAdmin";
import { Settings } from "@/pages/Settings";
import { UserManagement } from "@/pages/admin/UserManagement";
import { ScheduleManagement } from "@/pages/admin/ScheduleManagement";
import { Analytics } from "@/pages/Analytics";
import Chat from "@/pages/chat";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BreadcrumbNavigation } from "@/components/layout/BreadcrumbNavigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { ChatDialog } from "@/components/scheduler/ChatDialog";
import { PersonalChatDialog } from "@/components/scheduler/PersonalChatDialog";
import { useSyncUsers } from './hooks/use-sync-users';
import { updateUsers } from './lib/constants';
import React from 'react';


function App() {
  const { users } = useSyncUsers();

  // Update users whenever DB data changes
  React.useEffect(() => {
    if (users.length > 0) {
      updateUsers(users);
    }
  }, [users]);

  const { data: shifts } = useQuery({
    queryKey: ['/api/shifts'],
    queryFn: async () => {
      const response = await fetch('/api/shifts');
      if (!response.ok) throw new Error('Failed to fetch shifts');
      return response.json();
    }
  });
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-64">
          <BreadcrumbNavigation />
          <main className="container mx-auto py-6">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/provider/:id" component={PersonalDashboard} />
              <Route path="/swap-requests" component={SwapRequestsDashboard} />
              <Route path="/time-off" component={TimeOffRequests} />
              <Route path="/admin/time-off" component={TimeOffAdmin} />
              <Route path="/preferences" component={Settings} />
              <Route path="/admin/users" component={UserManagement} />
              <Route path="/admin/schedule" component={ScheduleManagement} />
              <Route path="/analytics" component={Analytics} />
              <Route component={NotFound} />
            </Switch>
          </main>
          {/* Global AI Schedule Assistant */}
          <div className="fixed bottom-6 right-6 z-50">
            {location.pathname.includes('provider') ? (
              <PersonalChatDialog pathname={location.pathname} />
            ) : (
              <ChatDialog 
                currentPage={location.pathname.split('/')[1] || 'dashboard'}
                pageContext={{
                  shifts: shifts || [],
                  requests: [],
                  error: null
                }}
                onError={(error) => {
                  console.error('Application error:', error);
                  // Prevent recursive renders from error states
                  if (!error.message?.includes('Maximum update depth exceeded')) {
                    toast({
                      title: 'Error',
                      description: 'An unexpected error occurred. Please try refreshing.',
                      variant: 'destructive'
                    });
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// fallback 404 not found page
function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;