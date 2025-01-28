import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { integrationRegistry } from "@/lib/integrations/scheduler-integration";
import { APISchedulingAdapter } from "@/lib/integrations/adapters/api-adapter";

export function IntegrationManagement() {
  const { toast } = useToast();
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);

  // Query for active integrations
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      // For demo, return the registered integrations
      const registeredIntegrations = integrationRegistry.getAll();
      return registeredIntegrations.map(integration => ({
        name: integration.name,
        type: integration.type,
        status: "active"
      }));
    }
  });

  // Test integration connection
  const handleTestIntegration = async (type: string) => {
    setTestingIntegration(type);
    try {
      const integration = integrationRegistry.get(type);
      if (!integration) {
        throw new Error("Integration not found");
      }

      const isConnected = await integration.validateConnection();

      toast({
        title: isConnected ? "Connection Successful" : "Connection Failed",
        description: isConnected 
          ? "Successfully connected to the external system" 
          : "Failed to connect to the external system",
        variant: isConnected ? "default" : "destructive"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setTestingIntegration(null);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Healthcare System Integrations</CardTitle>
          <CardDescription>
            Manage connections to external healthcare scheduling systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {integrations?.map((integration) => (
                  <Card key={integration.type}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {integration.type.toUpperCase()}
                          </p>
                        </div>
                        <Badge>{integration.status}</Badge>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestIntegration(integration.type)}
                        disabled={testingIntegration === integration.type}
                      >
                        {testingIntegration === integration.type ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Test Connection
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}