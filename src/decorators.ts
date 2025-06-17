import 'reflect-metadata';
import { container } from './di-container';
import type { Constructor } from './types';

// Metadata keys
const INJECTABLE_METADATA_KEY = Symbol('injectable');
const INJECT_METADATA_KEY = Symbol('inject');

/**
 * Marks a class as injectable
 */
export function Injectable<T extends Constructor>(target: T): T {
  Reflect.defineMetadata(INJECTABLE_METADATA_KEY, true, target);
  return target;
}

/**
 * Marks a parameter for injection
 */
export function Inject(token: string | symbol) {
  return (
    // biome-ignore lint/suspicious/noExplicitAny: Required for decorator parameter type
    target: any,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    const existingTokens =
      Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingTokens, target);
  };
}

/**
 * Auto-register a class with the container using decorators
 */
export function autoRegister<T>(
  target: Constructor<T>,
  token?: string | symbol,
): void {
  const isInjectable = Reflect.getMetadata(INJECTABLE_METADATA_KEY, target);

  if (!isInjectable) {
    throw new Error(`Class ${target.name} is not marked as @Injectable`);
  }

  const injectionTokens =
    Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
  const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];

  const factory = () => {
    // biome-ignore lint/suspicious/noExplicitAny: Required for dynamic parameter type checking
    const args = paramTypes.map((paramType: any, index: number) => {
      const injectionToken = injectionTokens[index];

      if (injectionToken) {
        return container.resolve(injectionToken);
      }

      if (paramType && typeof paramType === 'function') {
        return container.resolve(paramType);
      }

      throw new Error(
        `Cannot resolve parameter at index ${index} for ${target.name}. ` +
          'Use @Inject() decorator or ensure the parameter type is registered.',
      );
    });

    return new target(...args);
  };

  container.registerSingleton(token || target, factory);
}

/**
 * Check if a class is marked as injectable
 */
export function isInjectable(target: Constructor): boolean {
  return Reflect.getMetadata(INJECTABLE_METADATA_KEY, target) === true;
}
