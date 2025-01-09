import { Switch, Route } from "wouter";
import { Dashboard } from "@/pages/Dashboard";
import { PersonalDashboard } from "@/pages/PersonalDashboard";
import { SwapRequestsDashboard } from "@/pages/SwapRequestsDashboard";
import { TimeOffRequests } from "@/components/scheduler/TimeOffRequests";
import { TimeOffAdmin } from "@/pages/TimeOffAdmin";
import { ShiftPreferences } from "@/pages/ShiftPreferences";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <TooltipProvider>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/provider/:id" component={PersonalDashboard} />
        <Route path="/swap-requests" component={SwapRequestsDashboard} />
        <Route path="/time-off" component={TimeOffRequests} />
        <Route path="/time-off/admin" component={TimeOffAdmin} />
        <Route path="/preferences" component={ShiftPreferences} />
        <Route component={NotFound} />
      </Switch>
    </TooltipProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
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