import { Switch, Route } from "wouter";
import { Dashboard } from "@/pages/Dashboard";
import { PersonalDashboard } from "@/pages/PersonalDashboard";
import { SwapRequestsDashboard } from "@/pages/SwapRequestsDashboard";
import { TimeOffRequests } from "@/components/scheduler/TimeOffRequests";
import { TimeOffAdmin } from "@/pages/TimeOffAdmin";
import { Settings } from "@/pages/Settings";
import { UserManagement } from "@/pages/admin/UserManagement";
import { ScheduleManagement } from "@/pages/admin/ScheduleManagement";
import { AdminLayout } from "@/pages/admin/Layout";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BreadcrumbNavigation } from "@/components/layout/BreadcrumbNavigation";
import { Sidebar } from "@/components/layout/Sidebar";

function App() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-64">  {/* Add padding for sidebar */}
          <BreadcrumbNavigation />
          <main className="container mx-auto py-6">
            <Switch>
              {/* Main routes */}
              <Route path="/" component={Dashboard} />
              <Route path="/provider/:id" component={PersonalDashboard} />
              <Route path="/swap-requests" component={SwapRequestsDashboard} />
              <Route path="/time-off" component={TimeOffRequests} />
              <Route path="/settings/:userId" component={Settings} />

              {/* Admin routes */}
              <Route path="/admin">
                {(params) => (
                  <AdminLayout>
                    <Switch>
                      <Route path="/admin/users" component={UserManagement} />
                      <Route path="/admin/schedule" component={ScheduleManagement} />
                      <Route path="/admin/time-off" component={TimeOffAdmin} />
                      <Route component={NotFound} />
                    </Switch>
                  </AdminLayout>
                )}
              </Route>

              <Route component={NotFound} />
            </Switch>
          </main>
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