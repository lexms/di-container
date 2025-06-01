// Core DI Container
export { DIContainer, container } from './di-container';

// Errors
export {
  DIContainerError,
  CircularDependencyError,
  ServiceNotFoundError,
} from './di-container';

// Types
export type {
  Constructor,
  AbstractConstructor,
  AnyConstructor,
  Factory,
  AsyncFactory,
  ServiceRegistration,
  DIContainerOptions,
  ServiceResolver,
  IDIContainer,
} from './types';

export { LifetimeScope } from './types';

// Logger
export type { Logger } from './logger';
export { ConsoleLogger, NoOpLogger, createLogger } from './logger';

// Decorators (optional - requires reflect-metadata)
export { Injectable, Inject, autoRegister, isInjectable } from './decorators'; 