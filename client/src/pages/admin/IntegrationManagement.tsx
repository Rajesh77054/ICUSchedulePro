import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, RefreshCw, Settings } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { IntegrationConfig } from "@/lib/integrations/types";
import { integrationService } from "@/lib/integrations/integration-service";

const integrationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.union([
    z.literal("fhir"),
    z.literal("hl7"),
    z.literal("api"),
    z.literal("csv"),
  ]),
  enabled: z.boolean(),
  syncFrequency: z.number().min(5, "Minimum sync frequency is 5 minutes"),
  settings: z.record(z.string(), z.unknown())
});

type FormValues = z.infer<typeof integrationFormSchema>;

export function IntegrationManagement() {
  const { toast } = useToast();
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);

  const { data: adapters, isLoading: loadingAdapters } = useQuery({
    queryKey: ["/api/integrations/adapters"],
    queryFn: async () => {
      return integrationService.getAvailableAdapters();
    }
  });

  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      return integrationService.getActiveIntegrations();
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: "",
      type: "fhir",
      enabled: true,
      syncFrequency: 15,
      settings: {}
    }
  });

  const { mutate: saveIntegration, isPending: isSaving } = useMutation({
    mutationFn: async (data: FormValues) => {
      const config: IntegrationConfig = {
        id: selectedIntegration?.id || Date.now().toString(),
        ...data
      };

      const success = await integrationService.initializeIntegration(config);
      if (!success) {
        throw new Error("Failed to initialize integration");
      }
      return config;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Integration saved successfully"
      });
      setSelectedIntegration(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const { mutate: testIntegration, isPending: isTesting } = useMutation({
    mutationFn: async (config: IntegrationConfig) => {
      return integrationService.testIntegration(config);
    },
    onSuccess: (success) => {
      toast({
        title: success ? "Success" : "Failed",
        description: success ? "Integration test successful" : "Integration test failed",
        variant: success ? "default" : "destructive"
      });
    }
  });

  const onSubmit = (data: FormValues) => {
    saveIntegration(data);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>External System Integrations</CardTitle>
          <CardDescription>
            Manage connections to external healthcare scheduling systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Active Integrations</h3>
              <Button onClick={() => setSelectedIntegration(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {integrations?.map((integration) => (
                <Card key={integration.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold">{integration.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {integration.type.toUpperCase()}
                        </p>
                      </div>
                      <Badge variant={integration.enabled ? "default" : "secondary"}>
                        {integration.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        Sync Frequency: Every {integration.syncFrequency} minutes
                      </p>
                      {integration.lastSync && (
                        <p className="text-sm text-muted-foreground">
                          Last sync: {new Date(integration.lastSync).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedIntegration(integration)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testIntegration(integration)}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(loadingAdapters || loadingIntegrations) && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {selectedIntegration === null && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Integration Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Integration Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select integration type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {adapters?.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enabled
                          </FormLabel>
                          <FormDescription>
                            Activate or deactivate this integration
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="syncFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sync Frequency (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Integration"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}