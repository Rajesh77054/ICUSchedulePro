import { EventEmitter } from 'events';
import type { ServiceStatus } from './registry';

export interface ServiceConfig {
  name: string;
  dependencies: string[];
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface ServiceState {
  status: ServiceStatus;
  lastError?: Error;
  retryCount: number;
  startTime?: Date;
  lastHealthCheck?: Date;
}

export interface ServiceInstance {
  initialize?: () => Promise<void>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  healthCheck?: () => Promise<boolean>;
}

export class ServiceOrchestrator extends EventEmitter {
  private static instance: ServiceOrchestrator;
  private services: Map<string, ServiceInstance>;
  private states: Map<string, ServiceState>;
  private configs: Map<string, ServiceConfig>;
  private initOrder: string[];
  private isInitializing: boolean;

  private constructor() {
    super();
    this.services = new Map();
    this.states = new Map();
    this.configs = new Map();
    this.initOrder = [];
    this.isInitializing = false;
  }

  static getInstance(): ServiceOrchestrator {
    if (!ServiceOrchestrator.instance) {
      ServiceOrchestrator.instance = new ServiceOrchestrator();
    }
    return ServiceOrchestrator.instance;
  }

  register(
    service: ServiceInstance,
    config: ServiceConfig
  ): void {
    if (this.services.has(config.name)) {
      throw new Error(`Service ${config.name} already registered`);
    }

    this.services.set(config.name, service);
    this.configs.set(config.name, {
      ...config,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 5000,
      timeout: config.timeout ?? 30000,
    });
    this.states.set(config.name, {
      status: 'initializing',
      retryCount: 0,
    });

    // Update initialization order based on dependencies
    this.updateInitOrder();
  }

  private updateInitOrder(): void {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (name: string) => {
      if (temp.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }
      if (visited.has(name)) return;

      temp.add(name);
      const config = this.configs.get(name);
      if (config) {
        for (const dep of config.dependencies) {
          visit(dep);
        }
      }
      temp.delete(name);
      visited.add(name);
      order.push(name);
    };

    // Convert Map keys to array for iteration
    const serviceNames = Array.from(this.services.keys());
    for (const name of serviceNames) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    this.initOrder = order;
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      throw new Error('System is already initializing');
    }

    this.isInitializing = true;
    const errors: Error[] = [];

    try {
      for (const serviceName of this.initOrder) {
        const service = this.services.get(serviceName);
        const config = this.configs.get(serviceName);
        const state = this.states.get(serviceName);

        if (!service || !config || !state) continue;

        try {
          await this.initializeService(service, config, state);
        } catch (error) {
          errors.push(error as Error);
          this.emit('serviceError', serviceName, error);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Failed to initialize services: ${errors.map(e => e.message).join(', ')}`);
      }
    } finally {
      this.isInitializing = false;
    }
  }

  private async initializeService(
    service: ServiceInstance,
    config: ServiceConfig,
    state: ServiceState
  ): Promise<void> {
    let retryCount = 0;
    let lastError: Error | undefined;

    while (retryCount < config.maxRetries!) {
      try {
        if (service.initialize) {
          await Promise.race([
            service.initialize(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Initialization timeout')), config.timeout)
            ),
          ]);
        }

        if (service.start) {
          await service.start();
        }

        state.status = 'healthy';
        state.startTime = new Date();
        state.retryCount = retryCount;
        this.emit('serviceStarted', config.name);
        return;
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        if (retryCount < config.maxRetries!) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    }

    state.status = 'failed';
    state.lastError = lastError;
    state.retryCount = retryCount;
    throw lastError;
  }

  async checkHealth(): Promise<Record<string, ServiceState>> {
    const health: Record<string, ServiceState> = {};

    // Convert Map entries to array for safe iteration
    const entries = Array.from(this.services.entries());

    for (const [name, service] of entries) {
      const state = this.states.get(name);
      if (!state) continue;

      try {
        if (service.healthCheck) {
          const isHealthy = await service.healthCheck();
          state.status = isHealthy ? 'healthy' : 'degraded';
        }
        state.lastHealthCheck = new Date();
      } catch (error) {
        state.status = 'degraded';
        state.lastError = error as Error;
      }

      health[name] = state;
    }

    return health;
  }

  getService<T extends ServiceInstance>(name: string): T {
    const service = this.services.get(name);
    const state = this.states.get(name);

    if (!service || !state) {
      throw new Error(`Service ${name} not found`);
    }

    if (state.status === 'failed') {
      throw new Error(`Service ${name} is in failed state`);
    }

    return service as T;
  }

  async shutdown(): Promise<void> {
    const shutdownOrder = [...this.initOrder].reverse();
    const errors: Error[] = [];

    for (const serviceName of shutdownOrder) {
      const service = this.services.get(serviceName);
      const state = this.states.get(serviceName);

      if (!service || !state) continue;

      try {
        if (service.stop) {
          await service.stop();
        }
        state.status = 'initializing';
        this.emit('serviceStopped', serviceName);
      } catch (error) {
        errors.push(error as Error);
        this.emit('serviceError', serviceName, error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to shutdown services: ${errors.map(e => e.message).join(', ')}`);
    }
  }
}

export const serviceOrchestrator = ServiceOrchestrator.getInstance();