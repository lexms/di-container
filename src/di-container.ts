import { createLogger, type Logger } from './logger';
import type {
  Constructor,
  ContainerPerformanceStats,
  DIContainerOptions,
  Factory,
  IDIContainer,
  ServicePerformanceMetrics,
  ServiceRegistration,
} from './types';
import { LifetimeScope } from './types';

export class DIContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DIContainerError';
  }
}

export class CircularDependencyError extends DIContainerError {
  constructor(token: string) {
    super(`Circular dependency detected for token: ${token}`);
    this.name = 'CircularDependencyError';
  }
}

export class ServiceNotFoundError extends DIContainerError {
  constructor(token: string) {
    super(`Service not found for token: ${token}`);
    this.name = 'ServiceNotFoundError';
  }
}

interface ServicePerformanceData {
  totalResolutions: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  lastResolutionTime: number;
}

export class DIContainer implements IDIContainer {
  private readonly _services = new Map<string | symbol, ServiceRegistration>();
  private readonly _logger: Logger;
  private readonly _resolutionStack = new Set<string | symbol>();
  private readonly _performanceTracking: boolean;
  private readonly _serviceMetrics = new Map<
    string | symbol,
    ServicePerformanceData
  >();
  private readonly _startTime = Date.now();

  constructor(options: DIContainerOptions = {}) {
    this._logger = createLogger(
      options.enableLogging ?? false,
      options.logPrefix ?? 'DIContainer',
    );
    this._performanceTracking = options.enablePerformanceMonitoring ?? false;
  }

  /**
   * Register a service with the container
   */
  public register<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
    scope: LifetimeScope = LifetimeScope.SINGLETON,
  ): this {
    const key = this._getTokenKey(token);

    this._logger.debug(
      `Registering service: ${key.toString()} with scope: ${scope}`,
    );

    this._services.set(key, {
      factory,
      singleton: scope === LifetimeScope.SINGLETON,
    });

    return this;
  }

  /**
   * Register a singleton service
   */
  public registerSingleton<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
  ): this {
    return this.register(token, factory, LifetimeScope.SINGLETON);
  }

  /**
   * Register a transient service
   */
  public registerTransient<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
  ): this {
    return this.register(token, factory, LifetimeScope.TRANSIENT);
  }

  /**
   * Register an instance directly
   */
  public registerInstance<T>(
    token: Constructor<T> | string | symbol,
    instance: T,
  ): this {
    const key = this._getTokenKey(token);

    this._logger.debug(`Registering instance: ${key.toString()}`);

    this._services.set(key, {
      factory: () => instance,
      singleton: true,
      instance,
    });

    return this;
  }

  /**
   * Resolve a service synchronously
   */
  public resolve<T>(token: Constructor<T> | string | symbol): T {
    const key = this._getTokenKey(token);
    const startTime = this._performanceTracking ? performance.now() : 0;

    this._logger.trace(`Resolving service: ${key.toString()}`);

    // Check for circular dependencies
    if (this._resolutionStack.has(key)) {
      throw new CircularDependencyError(key.toString());
    }

    const registration = this._services.get(key);
    if (!registration) {
      throw new ServiceNotFoundError(key.toString());
    }

    // Return existing instance for singletons
    if (registration.singleton && registration.instance !== undefined) {
      this._logger.trace(
        `Returning existing singleton instance: ${key.toString()}`,
      );

      if (this._performanceTracking) {
        const endTime = performance.now();
        this._updatePerformanceMetrics(key, endTime - startTime);
      }

      return registration.instance as T;
    }

    // Add to resolution stack to detect circular dependencies
    this._resolutionStack.add(key);

    try {
      const instance = registration.factory();

      // Handle promises in synchronous resolution
      if (instance instanceof Promise) {
        throw new DIContainerError(
          `Cannot resolve async service synchronously: ${key.toString()}. Use resolveAsync instead.`,
        );
      }

      // Store instance for singletons
      if (registration.singleton) {
        registration.instance = instance;
      }

      if (this._performanceTracking) {
        const endTime = performance.now();
        this._updatePerformanceMetrics(key, endTime - startTime);
      }

      this._logger.trace(`Successfully resolved service: ${key.toString()}`);
      return instance as T;
    } finally {
      this._resolutionStack.delete(key);
    }
  }

  /**
   * Resolve a service asynchronously
   */
  public async resolveAsync<T>(
    token: Constructor<T> | string | symbol,
  ): Promise<T> {
    const key = this._getTokenKey(token);
    const startTime = this._performanceTracking ? performance.now() : 0;

    this._logger.trace(`Resolving service async: ${key.toString()}`);

    // Check for circular dependencies
    if (this._resolutionStack.has(key)) {
      throw new CircularDependencyError(key.toString());
    }

    const registration = this._services.get(key);
    if (!registration) {
      throw new ServiceNotFoundError(key.toString());
    }

    // Return existing instance for singletons
    if (registration.singleton && registration.instance !== undefined) {
      this._logger.trace(
        `Returning existing singleton instance: ${key.toString()}`,
      );

      if (this._performanceTracking) {
        const endTime = performance.now();
        this._updatePerformanceMetrics(key, endTime - startTime);
      }

      return registration.instance as T;
    }

    // Add to resolution stack to detect circular dependencies
    this._resolutionStack.add(key);

    try {
      const instance = await registration.factory();

      // Store instance for singletons
      if (registration.singleton) {
        registration.instance = instance;
      }

      if (this._performanceTracking) {
        const endTime = performance.now();
        this._updatePerformanceMetrics(key, endTime - startTime);
      }

      this._logger.trace(
        `Successfully resolved service async: ${key.toString()}`,
      );
      return instance as T;
    } finally {
      this._resolutionStack.delete(key);
    }
  }

  /**
   * Check if a service is registered
   */
  public has(token: Constructor | string | symbol): boolean {
    const key = this._getTokenKey(token);
    return this._services.has(key);
  }

  /**
   * Get all registered service tokens
   */
  public getRegisteredTokens(): (string | symbol)[] {
    return Array.from(this._services.keys());
  }

  /**
   * Clear all registrations
   */
  public clear(): void {
    this._logger.debug('Clearing all registrations');
    this._services.clear();
  }

  /**
   * Dispose of the container and all disposable services
   */
  public async dispose(): Promise<void> {
    this._logger.debug('Disposing container');

    for (const [key, registration] of this._services) {
      if (registration.instance && typeof registration.instance === 'object') {
        // biome-ignore lint/suspicious/noExplicitAny: Required for dispose method checking
        const instance = registration.instance as any;
        if (typeof instance.dispose === 'function') {
          try {
            await instance.dispose();
            this._logger.trace(`Disposed service: ${key.toString()}`);
          } catch (error) {
            this._logger.error(
              `Error disposing service ${key.toString()}:`,
              error,
            );
          }
        }
      }
    }

    this.clear();
  }

  /**
   * Get performance statistics for the container
   */
  public getPerformanceStats(): ContainerPerformanceStats {
    const totalServices = this._services.size;
    let singletonServices = 0;
    let transientServices = 0;
    let servicesWithInstances = 0;
    let totalResolutions = 0;
    let totalResolutionTime = 0;

    for (const [key, registration] of this._services) {
      if (registration.singleton) {
        singletonServices++;
        if (registration.instance !== undefined) {
          servicesWithInstances++;
        }
      } else {
        transientServices++;
      }

      const metrics = this._serviceMetrics.get(key);
      if (metrics) {
        totalResolutions += metrics.totalResolutions;
        totalResolutionTime += metrics.totalTime;
      }
    }

    const serviceMetrics = this.getServiceMetrics();
    const sortedByTime = [...serviceMetrics].sort(
      (a, b) => b.averageTime - a.averageTime,
    );
    const sortedByResolutions = [...serviceMetrics].sort(
      (a, b) => b.totalResolutions - a.totalResolutions,
    );

    return {
      totalServices,
      totalResolutions,
      totalResolutionTime,
      averageResolutionTime:
        totalResolutions > 0 ? totalResolutionTime / totalResolutions : 0,
      singletonServices,
      transientServices,
      servicesWithInstances,
      slowestServices: sortedByTime.slice(0, 5),
      fastestServices: sortedByTime.slice(-5).reverse(),
      mostResolvedServices: sortedByResolutions.slice(0, 5),
      containerUptime: Date.now() - this._startTime,
    };
  }

  /**
   * Get performance metrics for services
   */
  public getServiceMetrics(
    token?: Constructor | string | symbol,
  ): ServicePerformanceMetrics[] {
    const results: ServicePerformanceMetrics[] = [];

    const tokensToCheck = token
      ? [this._getTokenKey(token)]
      : Array.from(this._services.keys());

    for (const key of tokensToCheck) {
      const registration = this._services.get(key);
      const metrics = this._serviceMetrics.get(key);

      if (registration) {
        const performanceData = metrics || {
          totalResolutions: 0,
          totalTime: 0,
          minTime: 0,
          maxTime: 0,
          lastResolutionTime: 0,
        };

        results.push({
          token: key.toString(),
          totalResolutions: performanceData.totalResolutions,
          totalTime: performanceData.totalTime,
          averageTime:
            performanceData.totalResolutions > 0
              ? performanceData.totalTime / performanceData.totalResolutions
              : 0,
          minTime: performanceData.minTime,
          maxTime: performanceData.maxTime,
          lastResolutionTime: performanceData.lastResolutionTime,
          scope: registration.singleton
            ? LifetimeScope.SINGLETON
            : LifetimeScope.TRANSIENT,
          isSingleton: registration.singleton,
          hasInstance: registration.instance !== undefined,
        });
      }
    }

    return results;
  }

  /**
   * Reset performance statistics
   */
  public resetPerformanceStats(): void {
    this._serviceMetrics.clear();
    this._logger.debug('Performance statistics reset');
  }

  /**
   * Update performance metrics for a service
   */
  private _updatePerformanceMetrics(
    key: string | symbol,
    resolutionTime: number,
  ): void {
    if (!this._performanceTracking) {
      return;
    }

    let metrics = this._serviceMetrics.get(key);
    if (!metrics) {
      metrics = {
        totalResolutions: 0,
        totalTime: 0,
        minTime: Number.MAX_VALUE,
        maxTime: 0,
        lastResolutionTime: 0,
      };
      this._serviceMetrics.set(key, metrics);
    }

    metrics.totalResolutions++;
    metrics.totalTime += resolutionTime;
    metrics.lastResolutionTime = resolutionTime;
    metrics.minTime = Math.min(metrics.minTime, resolutionTime);
    metrics.maxTime = Math.max(metrics.maxTime, resolutionTime);

    this._logger.trace(
      `Performance: ${key.toString()} resolved in ${resolutionTime.toFixed(2)}ms ` +
        `(total: ${metrics.totalResolutions}, avg: ${(metrics.totalTime / metrics.totalResolutions).toFixed(2)}ms)`,
    );
  }

  private _getTokenKey<T>(
    token: Constructor<T> | string | symbol,
  ): string | symbol {
    if (typeof token === 'string' || typeof token === 'symbol') {
      return token;
    }
    return token.name || token.toString();
  }
}

// Export a default instance
export const container = new DIContainer({ enableLogging: false });
