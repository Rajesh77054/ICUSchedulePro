import { SchedulingIntegration, type ScheduleEvent } from "../scheduler-integration";

export class APISchedulingAdapter extends SchedulingIntegration {
  readonly name = "External API Integration";
  readonly type = "api";
  
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { baseUrl: string; apiKey: string }) {
    super();
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      });
      return response.ok;
    } catch (error) {
      console.error("API connection failed:", error);
      return false;
    }
  }

  async importEvents(startDate: Date, endDate: Date): Promise<ScheduleEvent[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/schedules?start=${this.formatDate(startDate)}&end=${this.formatDate(endDate)}`,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.schedules.map((schedule: any) => ({
        id: schedule.id,
        title: schedule.title,
        startTime: schedule.start,
        endTime: schedule.end,
        provider: {
          id: schedule.provider.id,
          name: schedule.provider.name,
          role: schedule.provider.role
        },
        location: schedule.location,
        status: schedule.status,
        source: this.type,
        sourceId: schedule.id,
        metadata: schedule.metadata
      }));
    } catch (error) {
      console.error("Failed to import events:", error);
      return [];
    }
  }

  async exportEvents(events: ScheduleEvent[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/schedules/batch`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          schedules: events.map(event => this.transformToExternal(event))
        })
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to export events:", error);
      return false;
    }
  }
}
