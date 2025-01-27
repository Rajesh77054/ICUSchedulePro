import { z } from "zod";

// Core scheduling types
export const externalScheduleSchema = z.object({
  id: z.string(),
  source: z.string(),
  provider: z.string(),
  shifts: z.array(z.object({
    id: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    providerId: z.string(),
    providerName: z.string(),
    providerType: z.string(),
    location: z.string().optional(),
    department: z.string().optional(),
    status: z.string(),
    metadata: z.record(z.string(), z.any()).optional()
  })),
  metadata: z.record(z.string(), z.any()).optional(),
  lastSync: z.string()
});

export type ExternalSchedule = z.infer<typeof externalScheduleSchema>;

// Integration system types
export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'fhir' | 'hl7' | 'api' | 'csv';
  enabled: boolean;
  settings: Record<string, any>;
  syncFrequency: number; // in minutes
  lastSync?: string;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  type: string;
  externalId: string;
  metadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  message: string;
  schedules?: ExternalSchedule[];
  errors?: string[];
  timestamp: string;
}

// Integration adapter interface
export interface SchedulingSystemAdapter {
  name: string;
  type: string;
  
  // Core methods
  initialize(config: IntegrationConfig): Promise<void>;
  testConnection(): Promise<boolean>;
  
  // Schedule operations
  importSchedules(startDate: Date, endDate: Date): Promise<ExternalSchedule[]>;
  exportSchedules(schedules: ExternalSchedule[]): Promise<boolean>;
  
  // Provider operations
  getProviders(): Promise<IntegrationProvider[]>;
  mapProvider(externalId: string, localId: string): Promise<boolean>;
  
  // Utility methods
  validateConfig(config: IntegrationConfig): Promise<boolean>;
  getLastSync(): Promise<string | null>;
}
