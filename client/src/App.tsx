import { Switch, Route } from "wouter";
import { Dashboard } from "@/pages/Dashboard";
import { PersonalDashboard } from "@/pages/PersonalDashboard";
import { SwapRequestsDashboard } from "@/pages/SwapRequestsDashboard";
import { TimeOffRequests } from "@/components/time-off/TimeOffRequests";
import { TimeOffAdmin } from "@/components/time-off/TimeOffAdmin";
import { Settings } from "@/pages/Settings";
import { UserManagement } from "@/pages/admin/UserManagement";
import { ScheduleManagement } from "@/pages/admin/ScheduleManagement";
import { IntegrationManagement } from "@/pages/admin/IntegrationManagement";
import AnalyticsPage from "@/pages/AnalyticsPage";
import Chat from "@/pages/chat";
import { AlertCircle, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BreadcrumbNavigation } from "@/components/layout/BreadcrumbNavigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { ChatDialog } from "@/components/scheduler/ChatDialog";
import { PersonalChatDialog } from "@/components/scheduler/PersonalChatDialog";
import { useSyncUsers } from './hooks/use-sync-users';
import { updateUsers } from './lib/constants';
import React, { useEffect, useState, type PropsWithChildren, type ErrorInfo } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// PWA Install Prompt Component
function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };

    // Initial check
    checkMobile();

    // Add resize listener to update mobile status
    window.addEventListener('resize', checkMobile);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);

      // Show installation guidance toast for mobile devices
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        toast({
          title: "Install Available",
          description: "Add this app to your home screen for the best experience",
          duration: 5000,
        });
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    // iOS-specific detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('resize', checkMobile);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      // For iOS devices, show manual installation instructions
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        toast({
          title: "iOS Installation",
          description: "Tap the share button and select 'Add to Home Screen'",
          duration: 7000,
        });
        return;
      }
      return;
    }

    try {
      const result = await installPrompt.prompt();
      if (result.outcome === 'accepted') {
        toast({
          title: "Success",
          description: "App installation started",
        });
        setIsInstallable(false);
      } else {
        toast({
          title: "Installation cancelled",
          description: "You can install the app later from your browser menu",
        });
      }
    } catch (error) {
      console.error('Installation error:', error);
      toast({
        title: "Installation failed",
        description: "Please try again or install manually from your browser menu",
        variant: "destructive",
      });
    }
    setInstallPrompt(null);
  };

  if (!isInstallable) return null;

  return (
    <div className={`fixed ${isMobile ? 'bottom-6 inset-x-6' : 'bottom-24 right-6'} z-50`}>
      <Button
        onClick={handleInstallClick}
        className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-lg"
      >
        <Download className="h-4 w-4" />
        Install App
      </Button>
    </div>
  );
}

// Added ErrorBoundary Component with proper typing
interface ErrorBoundaryProps extends PropsWithChildren {
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || (
        <div className="p-4">
          <h2 className="text-lg font-bold text-red-500">Something went wrong</h2>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm">
              {this.state.error.message}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { users } = useSyncUsers();

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
        <ErrorBoundary>
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
                <Route path="/admin/integrations" component={IntegrationManagement} />
                <Route path="/analytics" component={AnalyticsPage} />
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
                    requests: []
                  }}
                />
              )}
            </div>
            {/* PWA Install Prompt */}
            <InstallPWA />
          </div>
        </ErrorBoundary>
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