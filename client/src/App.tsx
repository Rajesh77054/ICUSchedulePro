import { Switch, Route } from "wouter";
import { LoginPage } from "@/pages/LoginPage";
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
import { AuthProvider, ProtectedRoute } from "@/lib/auth";

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route>
            <div className="min-h-screen bg-background">
              <Sidebar />
              <div className="md:pl-64">
                <BreadcrumbNavigation />
                <main className="container mx-auto py-6">
                  <Switch>
                    <Route path="/">
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/provider/:id">
                      <ProtectedRoute>
                        <PersonalDashboard />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/swap-requests">
                      <ProtectedRoute>
                        <SwapRequestsDashboard />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/time-off">
                      <ProtectedRoute>
                        <TimeOffRequests />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/time-off/admin">
                      <ProtectedRoute roles={['admin', 'scheduler']}>
                        <TimeOffAdmin />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/preferences">
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    </Route>
                    <Route component={NotFound} />
                  </Switch>
                </main>
              </div>
            </div>
          </Route>
        </Switch>
      </TooltipProvider>
    </AuthProvider>
  );
}

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