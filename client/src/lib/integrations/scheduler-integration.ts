import { z } from "zod";

// Core scheduling event type
export const scheduleEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  provider: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string()
  }),
  location: z.string().optional(),
  status: z.enum(["scheduled", "cancelled", "completed"]),
  source: z.string(),
  sourceId: z.string(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type ScheduleEvent = z.infer<typeof scheduleEventSchema>;

// Base integration handler class
export abstract class SchedulingIntegration {
  abstract readonly name: string;
  abstract readonly type: string;

  // Core methods that must be implemented
  abstract connect(): Promise<boolean>;
  abstract importEvents(startDate: Date, endDate: Date): Promise<ScheduleEvent[]>;
  abstract exportEvents(events: ScheduleEvent[]): Promise<boolean>;

  // Optional methods with default implementations
  async validateConnection(): Promise<boolean> {
    try {
      return await this.connect();
    } catch (error) {
      console.error(`Connection validation failed for ${this.name}:`, error);
      return false;
    }
  }

  // Utility method to transform dates to ISO strings
  protected formatDate(date: Date): string {
    return date.toISOString();
  }

  // Event transformation helpers
  protected transformToLocal(externalEvent: any): Partial<ScheduleEvent> {
    return {
      source: this.type,
      sourceId: externalEvent.id || String(Date.now()),
      status: "scheduled",
      metadata: {}
    };
  }

  protected transformToExternal(event: ScheduleEvent): any {
    return {
      id: event.sourceId,
      start: event.startTime,
      end: event.endTime,
      title: event.title,
      status: event.status
    };
  }
}

// Integration registry for managing multiple integrations
export class IntegrationRegistry {
  private integrations: Map<string, SchedulingIntegration> = new Map();

  register(integration: SchedulingIntegration): void {
    this.integrations.set(integration.type, integration);
  }

  get(type: string): SchedulingIntegration | undefined {
    return this.integrations.get(type);
  }

  getAll(): SchedulingIntegration[] {
    return Array.from(this.integrations.values());
  }

  async importAllEvents(startDate: Date, endDate: Date): Promise<ScheduleEvent[]> {
    const allEvents: ScheduleEvent[] = [];
    const integrationArray = Array.from(this.integrations.values());

    for (const integration of integrationArray) {
      try {
        const events = await integration.importEvents(startDate, endDate);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to import events from ${integration.name}:`, error);
      }
    }

    return allEvents;
  }
}

// Create and export singleton registry
export const integrationRegistry = new IntegrationRegistry();

// Register the API adapter
import { APISchedulingAdapter } from './adapters/api-adapter';
integrationRegistry.register(new APISchedulingAdapter({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  apiKey: import.meta.env.VITE_API_KEY || 'demo-key'
}));