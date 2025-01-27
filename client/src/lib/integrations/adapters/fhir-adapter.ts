import type { 
  SchedulingSystemAdapter, 
  IntegrationConfig, 
  ExternalSchedule,
  IntegrationProvider
} from '../types';

// Define a simplified Client interface since @types/fhir-kit-client is not available
interface FHIRClient {
  search(params: { resourceType: string; searchParams?: Record<string, string> }): Promise<any>;
  create(params: { resourceType: string; body: any }): Promise<any>;
}

export class FHIRAdapter implements SchedulingSystemAdapter {
  private client: FHIRClient | null = null;
  private config: IntegrationConfig | null = null;
  private lastSyncTime: string | null = null;

  name = 'FHIR Schedule Integration';
  type = 'fhir' as const;

  async initialize(config: IntegrationConfig): Promise<void> {
    try {
      this.config = config;
      // We'll implement the actual client initialization when we have the proper FHIR server credentials
      this.client = {
        search: async () => ({ entry: [] }),
        create: async () => ({ entry: [] })
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to initialize FHIR client: ${errorMessage}`);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      throw new Error('FHIR client not initialized');
    }

    try {
      // For now, just return true since we're using a mock client
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`FHIR connection test failed: ${errorMessage}`);
    }
  }

  async importSchedules(startDate: Date, endDate: Date): Promise<ExternalSchedule[]> {
    if (!this.client) {
      throw new Error('FHIR client not initialized');
    }

    try {
      const response = await this.client.search({
        resourceType: 'Schedule',
        searchParams: {
          date: `ge${startDate.toISOString()}`,
          'date-end': `le${endDate.toISOString()}`
        }
      });

      const schedules: ExternalSchedule[] = (response.entry || []).map((entry: any) => {
        const resource = entry.resource;
        return {
          id: resource.id || String(Date.now()),
          source: 'FHIR',
          provider: resource?.actor?.[0]?.reference || 'unknown',
          shifts: [],
          metadata: {},
          lastSync: new Date().toISOString()
        };
      });

      this.lastSyncTime = new Date().toISOString();
      return schedules;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to import FHIR schedules: ${errorMessage}`);
    }
  }

  async exportSchedules(schedules: ExternalSchedule[]): Promise<boolean> {
    if (!this.client) {
      throw new Error('FHIR client not initialized');
    }

    try {
      // For now, just return true since we're using a mock client
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to export schedules to FHIR: ${errorMessage}`);
    }
  }

  async getProviders(): Promise<IntegrationProvider[]> {
    if (!this.client) {
      throw new Error('FHIR client not initialized');
    }

    try {
      const response = await this.client.search({
        resourceType: 'Practitioner'
      });

      return (response.entry || []).map((entry: any) => {
        const resource = entry.resource;
        return {
          id: resource.id || String(Date.now()),
          name: resource.name?.[0]?.text || 'Unknown',
          type: 'practitioner',
          externalId: resource.id || String(Date.now()),
          metadata: {}
        };
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to fetch FHIR providers: ${errorMessage}`);
    }
  }

  async mapProvider(externalId: string, localId: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Integration config not initialized');
    }

    this.config.settings.providerMappings = {
      ...this.config.settings.providerMappings,
      [externalId]: localId
    };

    return true;
  }

  async validateConfig(config: IntegrationConfig): Promise<boolean> {
    const requiredFields = ['baseUrl', 'token'];
    return requiredFields.every(field => config.settings[field]);
  }

  async getLastSync(): Promise<string | null> {
    return this.lastSyncTime;
  }
}