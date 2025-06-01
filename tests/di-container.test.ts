import {
  DIContainer,
  LifetimeScope,
  DIContainerError,
  CircularDependencyError,
  ServiceNotFoundError,
} from '../src';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Basic Registration and Resolution', () => {
    test('should register and resolve a singleton service', () => {
      class TestService {
        getValue(): string {
          return 'test';
        }
      }

      container.registerSingleton(TestService, () => new TestService());

      const instance1 = container.resolve(TestService);
      const instance2 = container.resolve(TestService);

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance1).toBe(instance2); // Same instance (singleton)
      expect(instance1.getValue()).toBe('test');
    });

    test('should register and resolve a transient service', () => {
      class TestService {
        private id = Math.random();

        getId(): number {
          return this.id;
        }
      }

      container.registerTransient(TestService, () => new TestService());

      const instance1 = container.resolve(TestService);
      const instance2 = container.resolve(TestService);

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance2).toBeInstanceOf(TestService);
      expect(instance1).not.toBe(instance2); // Different instances
      expect(instance1.getId()).not.toBe(instance2.getId());
    });

    test('should register and resolve using string tokens', () => {
      const config = { apiUrl: 'https://api.example.com' };

      container.registerInstance('config', config);

      const resolved = container.resolve<typeof config>('config');

      expect(resolved).toBe(config);
      expect(resolved.apiUrl).toBe('https://api.example.com');
    });

    test('should register and resolve using symbol tokens', () => {
      const CONFIG_TOKEN = Symbol('config');
      const config = { apiUrl: 'https://api.example.com' };

      container.registerInstance(CONFIG_TOKEN, config);

      const resolved = container.resolve<typeof config>(CONFIG_TOKEN);

      expect(resolved).toBe(config);
    });
  });

  describe('Async Resolution', () => {
    test('should resolve async factories', async () => {
      class AsyncService {
        async getData(): Promise<string> {
          return 'async data';
        }
      }

      container.registerSingleton(AsyncService, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return new AsyncService();
      });

      const instance = await container.resolveAsync(AsyncService);
      const data = await instance.getData();

      expect(instance).toBeInstanceOf(AsyncService);
      expect(data).toBe('async data');
    });

    test('should throw error when trying to resolve async service synchronously', () => {
      class AsyncService {}

      container.registerSingleton(AsyncService, async () => new AsyncService());

      expect(() => container.resolve(AsyncService)).toThrow(DIContainerError);
      expect(() => container.resolve(AsyncService)).toThrow(
        /Cannot resolve async service synchronously/
      );
    });
  });

  describe('Error Handling', () => {
    test('should throw ServiceNotFoundError for unregistered service', () => {
      class UnregisteredService {}

      expect(() => container.resolve(UnregisteredService)).toThrow(ServiceNotFoundError);
      expect(() => container.resolve(UnregisteredService)).toThrow(
        /Service not found for token/
      );
    });

    test('should detect circular dependencies', () => {
      class ServiceA {
        constructor(public serviceB: ServiceB) {}
      }

      class ServiceB {
        constructor(public serviceA: ServiceA) {}
      }

      container.registerSingleton(ServiceA, () => new ServiceA(container.resolve(ServiceB)));
      container.registerSingleton(ServiceB, () => new ServiceB(container.resolve(ServiceA)));

      expect(() => container.resolve(ServiceA)).toThrow(CircularDependencyError);
    });
  });

  describe('Container Management', () => {
    test('should check if service is registered', () => {
      class TestService {}

      expect(container.has(TestService)).toBe(false);

      container.registerSingleton(TestService, () => new TestService());

      expect(container.has(TestService)).toBe(true);
    });

    test('should get all registered tokens', () => {
      class ServiceA {}
      class ServiceB {}
      const TOKEN_C = 'tokenC';

      container.registerSingleton(ServiceA, () => new ServiceA());
      container.registerSingleton(ServiceB, () => new ServiceB());
      container.registerSingleton(TOKEN_C, () => 'value');

      const tokens = container.getRegisteredTokens();

      expect(tokens).toHaveLength(3);
      expect(tokens).toContain('ServiceA');
      expect(tokens).toContain('ServiceB');
      expect(tokens).toContain(TOKEN_C);
    });

    test('should clear all registrations', () => {
      class TestService {}

      container.registerSingleton(TestService, () => new TestService());
      expect(container.has(TestService)).toBe(true);

      container.clear();
      expect(container.has(TestService)).toBe(false);
      expect(container.getRegisteredTokens()).toHaveLength(0);
    });
  });

  describe('Disposal', () => {
    test('should call dispose on disposable services', async () => {
      const disposeMock = jest.fn();

      class DisposableService {
        async dispose(): Promise<void> {
          disposeMock();
        }
      }

      container.registerSingleton(DisposableService, () => new DisposableService());

      // Resolve to create instance
      container.resolve(DisposableService);

      await container.dispose();

      expect(disposeMock).toHaveBeenCalledTimes(1);
    });

    test('should handle disposal errors gracefully', async () => {
      class FaultyDisposableService {
        async dispose(): Promise<void> {
          throw new Error('Disposal error');
        }
      }

      container.registerSingleton(FaultyDisposableService, () => new FaultyDisposableService());

      // Resolve to create instance
      container.resolve(FaultyDisposableService);

      // Should not throw
      await expect(container.dispose()).resolves.toBeUndefined();
    });
  });

  describe('Dependency Injection', () => {
    test('should inject dependencies correctly', () => {
      class Repository {
        getData(): string {
          return 'data from repo';
        }
      }

      class Service {
        constructor(private repo: Repository) {}

        processData(): string {
          return `Processed: ${this.repo.getData()}`;
        }
      }

      container.registerSingleton(Repository, () => new Repository());
      container.registerSingleton(Service, () => new Service(container.resolve(Repository)));

      const service = container.resolve(Service);
      const result = service.processData();

      expect(result).toBe('Processed: data from repo');
    });
  });
}); 