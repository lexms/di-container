import type {
  Constructor,
  ServiceRegistration,
  DIContainerOptions,
  Factory,
  IDIContainer,
} from './types';
import { LifetimeScope } from './types';
import { createLogger, type Logger } from './logger';

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

export class DIContainer implements IDIContainer {
  private readonly _services = new Map<string | symbol, ServiceRegistration>();
  private readonly _logger: Logger;
  private readonly _resolutionStack = new Set<string | symbol>();

  constructor(options: DIContainerOptions = {}) {
    this._logger = createLogger(
      options.enableLogging ?? false,
      options.logPrefix ?? 'DIContainer'
    );
  }

  /**
   * Register a service with the container
   */
  public register<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
    scope: LifetimeScope = LifetimeScope.SINGLETON
  ): this {
    const key = this._getTokenKey(token);
    
    this._logger.debug(`Registering service: ${key.toString()} with scope: ${scope}`);
    
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
    factory: Factory<T>
  ): this {
    return this.register(token, factory, LifetimeScope.SINGLETON);
  }

  /**
   * Register a transient service
   */
  public registerTransient<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>
  ): this {
    return this.register(token, factory, LifetimeScope.TRANSIENT);
  }

  /**
   * Register an instance directly
   */
  public registerInstance<T>(
    token: Constructor<T> | string | symbol,
    instance: T
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
      this._logger.trace(`Returning existing singleton instance: ${key.toString()}`);
      return registration.instance as T;
    }

    // Add to resolution stack to detect circular dependencies
    this._resolutionStack.add(key);

    try {
      const instance = registration.factory();
      
      // Handle promises in synchronous resolution
      if (instance instanceof Promise) {
        throw new DIContainerError(
          `Cannot resolve async service synchronously: ${key.toString()}. Use resolveAsync instead.`
        );
      }

      // Store instance for singletons
      if (registration.singleton) {
        registration.instance = instance;
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
  public async resolveAsync<T>(token: Constructor<T> | string | symbol): Promise<T> {
    const key = this._getTokenKey(token);
    
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
      this._logger.trace(`Returning existing singleton instance: ${key.toString()}`);
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

      this._logger.trace(`Successfully resolved service async: ${key.toString()}`);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instance = registration.instance as any;
        if (typeof instance.dispose === 'function') {
          try {
            await instance.dispose();
            this._logger.trace(`Disposed service: ${key.toString()}`);
          } catch (error) {
            this._logger.error(`Error disposing service ${key.toString()}:`, error);
          }
        }
      }
    }
    
    this.clear();
  }

  private _getTokenKey<T>(token: Constructor<T> | string | symbol): string | symbol {
    if (typeof token === 'string' || typeof token === 'symbol') {
      return token;
    }
    return token.name || token.toString();
  }
}

// Export a default instance
export const container = new DIContainer({ enableLogging: false }); 