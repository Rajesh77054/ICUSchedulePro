import { FHIRAdapter } from './adapters/fhir-adapter';
import type { 
  SchedulingSystemAdapter, 
  IntegrationConfig, 
  ExternalSchedule,
  SyncResult 
} from './types';

class IntegrationService {
  private adapters: Map<string, SchedulingSystemAdapter> = new Map();
  private configs: IntegrationConfig[] = [];
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    // Register available adapters
    this.registerAdapter(new FHIRAdapter());
    this.initialized = true;
  }

  private registerAdapter(adapter: SchedulingSystemAdapter) {
    this.adapters.set(adapter.type, adapter);
  }

  async initializeIntegration(config: IntegrationConfig): Promise<boolean> {
    try {
      if (!this.initialized) {
        this.initialize();
      }

      const adapter = this.adapters.get(config.type);
      if (!adapter) {
        throw new Error(`No adapter found for integration type: ${config.type}`);
      }

      // Validate config before initializing
      const isValid = await adapter.validateConfig(config);
      if (!isValid) {
        throw new Error('Invalid integration configuration');
      }

      await adapter.initialize(config);
      this.configs.push(config);
      return true;
    } catch (error: unknown) {
      console.error('Failed to initialize integration:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async syncSchedules(startDate: Date, endDate: Date): Promise<SyncResult[]> {
    if (!this.initialized) {
      this.initialize();
    }

    const results: SyncResult[] = [];

    for (const config of this.configs) {
      if (!config.enabled) continue;

      try {
        const adapter = this.adapters.get(config.type);
        if (!adapter) {
          throw new Error(`No adapter found for integration type: ${config.type}`);
        }

        // Import schedules from external system
        const schedules = await adapter.importSchedules(startDate, endDate);

        // Export our schedules to external system
        const exported = await adapter.exportSchedules(schedules);

        results.push({
          success: true,
          message: `Successfully synced with ${config.name}`,
          schedules,
          timestamp: new Date().toISOString()
        });
      } catch (error: unknown) {
        results.push({
          success: false,
          message: `Failed to sync with ${config.name}`,
          errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  async getAvailableAdapters(): Promise<string[]> {
    if (!this.initialized) {
      this.initialize();
    }
    return Array.from(this.adapters.keys());
  }

  async getActiveIntegrations(): Promise<IntegrationConfig[]> {
    if (!this.initialized) {
      this.initialize();
    }
    return this.configs.filter(config => config.enabled);
  }

  async testIntegration(config: IntegrationConfig): Promise<boolean> {
    if (!this.initialized) {
      this.initialize();
    }

    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      throw new Error(`No adapter found for integration type: ${config.type}`);
    }

    try {
      await adapter.initialize(config);
      return await adapter.testConnection();
    } catch (error: unknown) {
      console.error('Integration test failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}

// Create and export a singleton instance
export const integrationService = new IntegrationService();