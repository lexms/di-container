// biome-ignore lint/suspicious/noExplicitAny: Required for generic constructor types
// biome-ignore lint/complexity/noBannedTypes: {} is needed for generic default type
export type Constructor<T = {}> = new (...args: any[]) => T;

// biome-ignore lint/suspicious/noExplicitAny: Required for generic constructor types
// biome-ignore lint/complexity/noBannedTypes: {} is needed for generic default type
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

// biome-ignore lint/suspicious/noExplicitAny: Required for constructor union types
export type AnyConstructor = Constructor<any> | AbstractConstructor<any>;

export type Factory<T> = () => T | Promise<T>;
export type AsyncFactory<T> = () => Promise<T>;

export interface ServiceRegistration<T = unknown> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

export enum LifetimeScope {
  TRANSIENT = 'transient',
  SINGLETON = 'singleton',
}

export interface DIContainerOptions {
  enableLogging?: boolean;
  logPrefix?: string;
  enablePerformanceMonitoring?: boolean;
}

export interface ServicePerformanceMetrics {
  token: string;
  totalResolutions: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastResolutionTime: number;
  scope: LifetimeScope;
  isSingleton: boolean;
  hasInstance: boolean;
}

export interface ContainerPerformanceStats {
  totalServices: number;
  totalResolutions: number;
  totalResolutionTime: number;
  averageResolutionTime: number;
  singletonServices: number;
  transientServices: number;
  servicesWithInstances: number;
  slowestServices: ServicePerformanceMetrics[];
  fastestServices: ServicePerformanceMetrics[];
  mostResolvedServices: ServicePerformanceMetrics[];
  containerUptime: number;
}

export type ServiceResolver<T> = (container: IDIContainer) => T | Promise<T>;

export interface IDIContainer {
  register<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
    scope?: LifetimeScope,
  ): this;

  registerSingleton<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
  ): this;

  registerTransient<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
  ): this;

  registerInstance<T>(
    token: Constructor<T> | string | symbol,
    instance: T,
  ): this;

  resolve<T>(token: Constructor<T> | string | symbol): T;
  resolveAsync<T>(token: Constructor<T> | string | symbol): Promise<T>;

  has(token: Constructor | string | symbol): boolean;

  dispose(): Promise<void>;

  // Performance monitoring methods
  getPerformanceStats(): ContainerPerformanceStats;
  getServiceMetrics(
    token?: Constructor | string | symbol,
  ): ServicePerformanceMetrics[];
  resetPerformanceStats(): void;
}
