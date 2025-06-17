import {
  DIContainer, DIContainerError,
  CircularDependencyError,
  ServiceNotFoundError
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

  describe('Default Exported Container', () => {
    beforeEach(() => {
      container.clear();
    });

    afterEach(async () => {
      await container.dispose();
    });

    test('should be an instance of DIContainer', () => {
      expect(container).toBeInstanceOf(DIContainer);
    });

    test('should work with basic service registration and resolution', () => {
      interface ITestService {
        getValue(): string;
      }

      class TestService implements ITestService {
        getValue(): string {
          return 'test value';
        }
      }

      container.registerSingleton('ITestService', () => new TestService());

      const service = container.resolve<ITestService>('ITestService');
      expect(service.getValue()).toBe('test value');
    });

    test('should maintain singleton behavior across resolutions', () => {
      class SingletonService {
        private id = Math.random();

        getId(): number {
          return this.id;
        }
      }

      container.registerSingleton(SingletonService, () => new SingletonService());

      const instance1 = container.resolve(SingletonService);
      const instance2 = container.resolve(SingletonService);

      expect(instance1).toBe(instance2);
      expect(instance1.getId()).toBe(instance2.getId());
    });

    test('should support method chaining for registrations', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}

      expect(() => {
        container
          .registerSingleton(ServiceA, () => new ServiceA())
          .registerSingleton(ServiceB, () => new ServiceB())
          .registerTransient(ServiceC, () => new ServiceC());
      }).not.toThrow();

      expect(container.has(ServiceA)).toBe(true);
      expect(container.has(ServiceB)).toBe(true);
      expect(container.has(ServiceC)).toBe(true);
    });
  });

  describe('Bootstrap Pattern', () => {
    beforeEach(() => {
      container.clear();
    });

    afterEach(async () => {
      await container.dispose();
    });

    test('should support bootstrap pattern with dependencies', async () => {
      interface ILogger {
        log(message: string): void;
      }

      interface IRepository {
        getData(): string[];
      }

      class MockLogger implements ILogger {
        public logs: string[] = [];

        log(message: string): void {
          this.logs.push(message);
        }
      }

      class MockRepository implements IRepository {
        getData(): string[] {
          return ['item1', 'item2'];
        }
      }

      class TestService {
        constructor(
          private repository: IRepository,
          private logger: ILogger
        ) {}

        processData(): string[] {
          this.logger.log('Processing data');
          const data = this.repository.getData();
          this.logger.log(`Found ${data.length} items`);
          return data;
        }
      }

      async function bootstrap() {
        container
          .registerSingleton('ILogger', () => new MockLogger())
          .registerSingleton('IRepository', () => new MockRepository())
          .registerSingleton(TestService, () => new TestService(
            container.resolve<IRepository>('IRepository'),
            container.resolve<ILogger>('ILogger')
          ));
      }

      await bootstrap();

      const testService = container.resolve(TestService);
      const logger = container.resolve<MockLogger>('ILogger');

      const result = testService.processData();

      expect(result).toEqual(['item1', 'item2']);
      expect(logger.logs).toContain('Processing data');
      expect(logger.logs).toContain('Found 2 items');
    });

    test('should handle complex dependency graphs in bootstrap', async () => {
      interface IConfig {
        apiUrl: string;
      }

      interface IHttpClient {
        get(url: string): Promise<string>;
      }

      interface IApiService {
        fetchData(): Promise<string>;
      }

      class Config implements IConfig {
        apiUrl = 'https://api.example.com';
      }

      class HttpClient implements IHttpClient {
        async get(url: string): Promise<string> {
          return `Data from ${url}`;
        }
      }

      class ApiService implements IApiService {
        constructor(
          private config: IConfig,
          private httpClient: IHttpClient
        ) {}

        async fetchData(): Promise<string> {
          return this.httpClient.get(this.config.apiUrl);
        }
      }

      class ApplicationService {
        constructor(private apiService: IApiService) {}

        async run(): Promise<string> {
          return this.apiService.fetchData();
        }
      }

      async function bootstrap() {
        container
          .registerSingleton('IConfig', () => new Config())
          .registerSingleton('IHttpClient', () => new HttpClient())
          .registerSingleton('IApiService', () => new ApiService(
            container.resolve<IConfig>('IConfig'),
            container.resolve<IHttpClient>('IHttpClient')
          ))
          .registerSingleton(ApplicationService, () => new ApplicationService(
            container.resolve<IApiService>('IApiService')
          ));
      }

      await bootstrap();

      const app = container.resolve(ApplicationService);
      const result = await app.run();

      expect(result).toBe('Data from https://api.example.com');
    });

    test('should support partial bootstrap and incremental registration', async () => {
      class BaseService {}
      class ExtendedService {
        constructor(private base: BaseService) {}
        
        getBase(): BaseService {
          return this.base;
        }
      }

      async function bootstrapBase() {
        container.registerSingleton(BaseService, () => new BaseService());
      }

      async function bootstrapExtended() {
        container.registerSingleton(ExtendedService, () => new ExtendedService(
          container.resolve(BaseService)
        ));
      }

      await bootstrapBase();
      expect(container.has(BaseService)).toBe(true);
      expect(container.has(ExtendedService)).toBe(false);

      await bootstrapExtended();
      expect(container.has(ExtendedService)).toBe(true);

      const extendedService = container.resolve(ExtendedService);
      const baseService = container.resolve(BaseService);

      expect(extendedService.getBase()).toBe(baseService);
    });
  });

  describe('Example Integration Tests', () => {
    beforeEach(() => {
      container.clear();
    });

    afterEach(async () => {
      await container.dispose();
    });

    test('should run bootstrap-usage example pattern successfully', async () => {
      interface ILogger {
        log(message: string): void;
      }

      interface IUserRepository {
        getUsers(): User[];
        getUserById(id: string): User | null;
      }

      interface User {
        id: string;
        name: string;
        email: string;
      }

      class TestLogger implements ILogger {
        public messages: string[] = [];

        log(message: string): void {
          this.messages.push(message);
        }
      }

      class InMemoryUserRepository implements IUserRepository {
        private users: User[] = [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
        ];

        getUsers(): User[] {
          return [...this.users];
        }

        getUserById(id: string): User | null {
          return this.users.find(user => user.id === id) || null;
        }
      }

      class UserService {
        constructor(
          private userRepository: IUserRepository,
          private logger: ILogger
        ) {}

        async getUserById(id: string): Promise<User | null> {
          this.logger.log(`Fetching user with ID: ${id}`);
          const user = this.userRepository.getUserById(id);
          if (user) {
            this.logger.log(`Found user: ${user.name}`);
          } else {
            this.logger.log(`User with ID ${id} not found`);
          }
          return user;
        }

        async getAllUsers(): Promise<User[]> {
          this.logger.log('Fetching all users');
          const users = this.userRepository.getUsers();
          this.logger.log(`Found ${users.length} users`);
          return users;
        }
      }

      async function bootstrap() {
        container
          .registerSingleton('ILogger', () => new TestLogger())
          .registerSingleton('IUserRepository', () => new InMemoryUserRepository())
          .registerSingleton(UserService, () => new UserService(
            container.resolve<IUserRepository>('IUserRepository'),
            container.resolve<ILogger>('ILogger')
          ));
      }

      await bootstrap();

      const userService = container.resolve(UserService);
      const logger = container.resolve<TestLogger>('ILogger');

      const user = await userService.getUserById('1');
      const users = await userService.getAllUsers();

      expect(user).toEqual({ id: '1', name: 'John Doe', email: 'john@example.com' });
      expect(users).toHaveLength(2);
      expect(logger.messages).toContain('Fetching user with ID: 1');
      expect(logger.messages).toContain('Found user: John Doe');
      expect(logger.messages).toContain('Fetching all users');
      expect(logger.messages).toContain('Found 2 users');
    });

    test('should handle service not found in bootstrap context', async () => {
      class MissingDependencyService {
        constructor(private missing: any) {}
      }

      async function faultyBootstrap() {
        container.registerSingleton(MissingDependencyService, () => new MissingDependencyService(
          container.resolve('NonExistentService')
        ));
      }

      await faultyBootstrap();

      expect(() => {
        container.resolve(MissingDependencyService);
      }).toThrow(ServiceNotFoundError);
    });
  });
}); 