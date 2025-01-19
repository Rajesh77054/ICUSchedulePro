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
import { ChatDialog } from "@/components/scheduler/ChatDialog";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { UserIdentification } from "@/components/auth/UserIdentification";
import { useState } from "react";

function App() {
  const [isIdentified, setIsIdentified] = useState(() => {
    return Boolean(localStorage.getItem("userId") && localStorage.getItem("userDisplayName"));
  });

  const handleIdentificationComplete = (userId: string, displayName: string) => {
    setIsIdentified(true);
    // You can add additional logic here like initializing chat or updating user context
  };

  return (
    <QueryClientProvider client={queryClient}>
      {!isIdentified && <UserIdentification onComplete={handleIdentificationComplete} />}
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="md:pl-64">
            <BreadcrumbNavigation />
            <main className="container mx-auto py-6">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/chat" component={Chat} />
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
          </div>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
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


// Added UserIdentification component
import React, { useState } from "react";
import { crypto } from "crypto";

interface UserIdentificationProps {
  onComplete: (userId: string, displayName: string) => void;
}

const UserIdentification: React.FC<UserIdentificationProps> = ({ onComplete }) => {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    const userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
    localStorage.setItem("userDisplayName", displayName);
    onComplete(userId, displayName);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Identify Yourself</h2>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your display name"
          className="w-full mb-4 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={handleSubmit}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export { UserIdentification };