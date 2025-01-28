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
      // Initialize FHIR client with server configuration
      // For now using a mock client until we have server credentials
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
      // Test connection by fetching capability statement
      const response = await this.client.search({
        resourceType: 'CapabilityStatement'
      });
      return !!response;
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
      // First fetch all schedules
      const scheduleResponse = await this.client.search({
        resourceType: 'Schedule',
        searchParams: {
          date: `ge${startDate.toISOString()}`,
          'date-end': `le${endDate.toISOString()}`
        }
      });

      // Then fetch associated slots
      const slotResponse = await this.client.search({
        resourceType: 'Slot',
        searchParams: {
          'schedule': scheduleResponse.entry.map((e: any) => e.resource.id).join(','),
          status: 'free,busy'
        }
      });

      // Map FHIR resources to our schedule format
      const schedules: ExternalSchedule[] = scheduleResponse.entry.map((entry: any) => {
        const resource = entry.resource;
        const slots = slotResponse.entry
          .filter((slot: any) => slot.resource.schedule.reference === `Schedule/${resource.id}`)
          .map((slot: any) => ({
            id: slot.resource.id,
            startDate: slot.resource.start,
            endDate: slot.resource.end,
            providerId: slot.resource.actor?.[0]?.reference?.split('/')[1] || '',
            providerName: slot.resource.actor?.[0]?.display || 'Unknown',
            providerType: 'practitioner',
            status: slot.resource.status
          }));

        return {
          id: resource.id || String(Date.now()),
          source: 'FHIR',
          provider: resource?.actor?.[0]?.reference || 'unknown',
          shifts: slots,
          metadata: {
            serviceType: resource.serviceType?.[0]?.coding?.[0]?.display,
            specialty: resource.specialty?.[0]?.coding?.[0]?.display
          },
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
      for (const schedule of schedules) {
        // Create or update Schedule resource
        await this.client.create({
          resourceType: 'Schedule',
          body: {
            resourceType: 'Schedule',
            id: schedule.id,
            status: 'active',
            actor: [{
              reference: schedule.provider,
              display: schedule.shifts[0]?.providerName || 'Unknown'
            }],
            planningHorizon: {
              start: schedule.shifts[0]?.startDate,
              end: schedule.shifts[schedule.shifts.length - 1]?.endDate
            }
          }
        });

        // Create or update Slot resources
        for (const shift of schedule.shifts) {
          await this.client.create({
            resourceType: 'Slot',
            body: {
              resourceType: 'Slot',
              id: shift.id,
              schedule: {
                reference: `Schedule/${schedule.id}`
              },
              status: shift.status === 'scheduled' ? 'busy' : 'free',
              start: shift.startDate,
              end: shift.endDate,
              actor: [{
                reference: `Practitioner/${shift.providerId}`,
                display: shift.providerName
              }]
            }
          });
        }
      }
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

      return response.entry.map((entry: any) => {
        const resource = entry.resource;
        return {
          id: resource.id || String(Date.now()),
          name: resource.name?.[0]?.text || 'Unknown',
          type: 'practitioner',
          externalId: resource.id,
          metadata: {
            qualification: resource.qualification?.[0]?.code?.coding?.[0]?.display,
            specialty: resource.specialty?.[0]?.coding?.[0]?.display
          }
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