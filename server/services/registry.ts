import { EventEmitter } from 'events';
import type { Server } from 'http';
import type { WebSocket } from 'ws';
import type { DatabaseConnection } from '@db';

export type ServiceStatus = 'initializing' | 'healthy' | 'degraded' | 'failed';

interface ServiceHealth {
  status: ServiceStatus;
  lastChecked: Date;
  error?: Error;
}

interface Service {
  name: string;
  instance: any;
  health: ServiceHealth;
  dependencies: string[];
}

export class ServiceRegistry extends EventEmitter {
  private static instance: ServiceRegistry;
  private services: Map<string, Service>;
  private initializationOrder: string[];

  private constructor() {
    super();
    this.services = new Map();
    this.initializationOrder = [];
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register(
    name: string,
    instance: any,
    dependencies: string[] = []
  ): void {
    this.services.set(name, {
      name,
      instance,
      health: {
        status: 'initializing',
        lastChecked: new Date(),
      },
      dependencies,
    });

    if (!this.initializationOrder.includes(name)) {
      this.initializationOrder.push(name);
    }
  }

  async initialize(): Promise<void> {
    const initialized = new Set<string>();
    const failed = new Set<string>();

    for (const serviceName of this.initializationOrder) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      try {
        // Check dependencies first
        for (const dep of service.dependencies) {
          if (!initialized.has(dep) || failed.has(dep)) {
            throw new Error(`Dependency ${dep} not ready for service ${serviceName}`);
          }
        }

        // Initialize the service if it has an initialize method
        if (typeof service.instance.initialize === 'function') {
          await service.instance.initialize();
        }

        // Verify health immediately after initialization
        if (typeof service.instance.healthCheck === 'function') {
          const isHealthy = await service.instance.healthCheck();
          service.health.status = isHealthy ? 'healthy' : 'degraded';
        } else {
          service.health.status = 'healthy'; // Assume healthy if no health check
        }

        initialized.add(serviceName);
        this.emit('serviceInitialized', serviceName);
      } catch (error) {
        service.health.status = 'failed';
        service.health.error = error as Error;
        failed.add(serviceName);
        this.emit('serviceInitializationFailed', serviceName, error);
        throw new Error(`Failed to initialize ${serviceName}: ${error}`);
      }
    }
  }

  getService<T extends unknown>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    if (service.health.status === 'failed') {
      throw new Error(`Service ${name} is in failed state`);
    }
    return service.instance as T;
  }

  async checkHealth(): Promise<Record<string, ServiceHealth>> {
    const health: Record<string, ServiceHealth> = {};

    // Convert Map entries to array for safe iteration
    const entries = Array.from(this.services.entries());

    for (const [name, service] of entries) {
      try {
        if (typeof service.instance.healthCheck === 'function') {
          const isHealthy = await service.instance.healthCheck();
          service.health.status = isHealthy ? 'healthy' : 'degraded';
        }
      } catch (error) {
        service.health.status = 'degraded';
        service.health.error = error as Error;
      }

      service.health.lastChecked = new Date();
      health[name] = service.health;
      this.emit('serviceHealthChanged', name, service.health);
    }

    return health;
  }

  getHealth(): Record<string, ServiceHealth> {
    const health: Record<string, ServiceHealth> = {};
    // Convert Map entries to array for safe iteration
    const entries = Array.from(this.services.entries());

    for (const [name, service] of entries) {
      health[name] = service.health;
    }
    return health;
  }
}

export const serviceRegistry = ServiceRegistry.getInstance();