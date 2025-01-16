import { Switch, Route } from "wouter";
import { Dashboard } from "@/pages/Dashboard";
import { PersonalDashboard } from "@/pages/PersonalDashboard";
import { SwapRequestsDashboard } from "@/pages/SwapRequestsDashboard";
import { TimeOffRequests } from "@/components/scheduler/TimeOffRequests";
import { TimeOffAdmin } from "@/pages/TimeOffAdmin";
import { Settings } from "@/pages/Settings";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BreadcrumbNavigation } from "@/components/layout/BreadcrumbNavigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/lib/auth";

// Mock admin user for development
const mockAdminUser = {
  id: 1,
  firstName: "Admin",
  lastName: "User",
  title: "Administrator",
  primaryEmail: "admin@example.com",
  role: "admin" as const,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function App() {
  return (
    <AuthProvider defaultUser={mockAdminUser}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="md:pl-64">
            <BreadcrumbNavigation />
            <main className="container mx-auto py-6">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/providers" component={Dashboard} />
                <Route path="/provider/:id" component={PersonalDashboard} />
                <Route path="/swap-requests" component={SwapRequestsDashboard} />
                <Route path="/time-off" component={TimeOffRequests} />
                <Route path="/time-off/admin" component={TimeOffAdmin} />
                <Route path="/settings" component={Settings} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </AuthProvider>
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