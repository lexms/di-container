// Core DI Container

// Decorators (optional - requires reflect-metadata)
export { autoRegister, Inject, Injectable, isInjectable } from './decorators';
export {
  CircularDependencyError,
  container,
  DIContainer,
  DIContainerError,
  ServiceNotFoundError,
} from './di-container';
// Logger
export type { Logger } from './logger';
export { ConsoleLogger, createLogger, NoOpLogger } from './logger';
// Types
export type {
  AbstractConstructor,
  AnyConstructor,
  AsyncFactory,
  Constructor,
  DIContainerOptions,
  Factory,
  IDIContainer,
  ServiceRegistration,
  ServiceResolver,
} from './types';
export { LifetimeScope } from './types';
