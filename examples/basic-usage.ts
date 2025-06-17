import { DIContainer, LifetimeScope } from '../src';

// Example interfaces and classes
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

// Implementations
class ConsoleLogger implements ILogger {
  log(message: string): void {
    console.log(`[LOG] ${message}`);
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

  async getAllUsers(): Promise<User[]> {
    this.logger.log('Fetching all users');
    const users = this.userRepository.getUsers();
    this.logger.log(`Found ${users.length} users`);
    return users;
  }

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
}

class NotificationService {
  constructor(private logger: ILogger) {}

  async sendWelcomeEmail(user: User): Promise<void> {
    this.logger.log(`Sending welcome email to ${user.email}`);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    this.logger.log(`Welcome email sent to ${user.name}`);
  }
}

// Main application
async function main() {
  // Create container with logging enabled
  const container = new DIContainer({ 
    enableLogging: true, 
    logPrefix: 'ExampleApp' 
  });

  // Register services
  container.registerSingleton('ILogger', () => new ConsoleLogger());
  
  container.registerSingleton('IUserRepository', () => new InMemoryUserRepository());
  
  container.registerSingleton(UserService, () => new UserService(
    container.resolve<IUserRepository>('IUserRepository'),
    container.resolve<ILogger>('ILogger')
  ));
  
  container.registerTransient(NotificationService, () => new NotificationService(
    container.resolve<ILogger>('ILogger')
  ));

  // Use the services
  const userService = container.resolve(UserService);
  const notificationService = container.resolve(NotificationService);

  console.log('=== DI Container Example ===\n');

  // Get all users
  const users = await userService.getAllUsers();
  console.log('All users:', users);

  // Get specific user
  const user = await userService.getUserById('1');
  if (user) {
    await notificationService.sendWelcomeEmail(user);
  }

  // Demonstrate transient vs singleton
  const notification1 = container.resolve(NotificationService);
  const notification2 = container.resolve(NotificationService);
  const userService1 = container.resolve(UserService);
  const userService2 = container.resolve(UserService);

  console.log('\n=== Instance Comparison ===');
  console.log('NotificationService (transient) - Same instance?', notification1 === notification2);
  console.log('UserService (singleton) - Same instance?', userService1 === userService2);

  // Clean up
  await container.dispose();
}

// Performance monitoring example
async function performanceExample() {
  console.log('\n=== Performance Monitoring Example ===\n');

  const performanceContainer = new DIContainer({ 
    enablePerformanceMonitoring: true,
    enableLogging: true,
    logPrefix: 'PerfExample'
  });

  class FastService {
    processData(): string {
      return 'Fast processing complete';
    }
  }

  class SlowService {
    processData(): string {
      // Simulate slow operation
      const start = Date.now();
      while (Date.now() - start < 25) {
        // Busy wait for 25ms
      }
      return 'Slow processing complete';
    }
  }

  class CachedService {
    private cache = new Map<string, string>();
    
    getData(key: string): string {
      if (!this.cache.has(key)) {
        // Simulate data fetching
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait for 10ms
        }
        this.cache.set(key, `Data for ${key}`);
      }
      return this.cache.get(key)!;
    }
  }

  // Register services with different scopes
  performanceContainer.registerSingleton(FastService, () => new FastService());
  performanceContainer.registerTransient(SlowService, () => new SlowService());
  performanceContainer.registerSingleton(CachedService, () => new CachedService());

  // Perform multiple resolutions
  console.log('Resolving services multiple times...\n');

  // Fast service (singleton - should be cached after first resolution)
  const fastService1 = performanceContainer.resolve(FastService);
  const fastService2 = performanceContainer.resolve(FastService);
  console.log('Fast service results:', fastService1.processData(), '|', fastService2.processData());

  // Slow service (transient - new instance each time)
  const slowService1 = performanceContainer.resolve(SlowService);
  const slowService2 = performanceContainer.resolve(SlowService);
  console.log('Slow service results:', slowService1.processData(), '|', slowService2.processData());

  // Cached service (singleton)
  const cachedService = performanceContainer.resolve(CachedService);
  console.log('Cached service results:', cachedService.getData('test'), '|', cachedService.getData('test'));

  // Register and resolve string token services
  const CONFIG_TOKEN = 'appConfig';
  const LOGGER_TOKEN = 'perfLogger';

  performanceContainer.registerInstance(CONFIG_TOKEN, { 
    apiUrl: 'https://api.example.com',
    timeout: 5000 
  });

  performanceContainer.registerSingleton(LOGGER_TOKEN, () => ({
    log: (message: string) => console.log(`[PERF-LOG] ${message}`)
  }));

  // Resolve string tokens multiple times
  const config1 = performanceContainer.resolve<{ apiUrl: string; timeout: number }>(CONFIG_TOKEN);
  const config2 = performanceContainer.resolve<{ apiUrl: string; timeout: number }>(CONFIG_TOKEN);
  const logger = performanceContainer.resolve<{ log: (msg: string) => void }>(LOGGER_TOKEN);

  logger.log(`Config resolved: ${config1.apiUrl} (same as second? ${config1 === config2})`);

  // Get and display performance statistics
  const stats = performanceContainer.getPerformanceStats();
  console.log('\n--- Container Performance Stats ---');
  console.log(`Total Services: ${stats.totalServices}`);
  console.log(`Total Resolutions: ${stats.totalResolutions}`);
  console.log(`Average Resolution Time: ${stats.averageResolutionTime.toFixed(2)}ms`);
  console.log(`Singleton Services: ${stats.singletonServices}`);
  console.log(`Transient Services: ${stats.transientServices}`);
  console.log(`Services with Instances: ${stats.servicesWithInstances}`);
  console.log(`Container Uptime: ${stats.containerUptime}ms`);

  // Get service-specific metrics
  const serviceMetrics = performanceContainer.getServiceMetrics();
  console.log('\n--- Service-Specific Metrics ---');
  serviceMetrics.forEach(metric => {
    console.log(`${metric.token}:`);
    console.log(`  Resolutions: ${metric.totalResolutions}`);
    console.log(`  Average Time: ${metric.averageTime.toFixed(2)}ms`);
    console.log(`  Min Time: ${metric.minTime.toFixed(2)}ms`);
    console.log(`  Max Time: ${metric.maxTime.toFixed(2)}ms`);
    console.log(`  Scope: ${metric.scope}`);
    console.log(`  Has Instance: ${metric.hasInstance}`);
    console.log('');
  });

  // Show performance analysis
  console.log('--- Performance Analysis ---');
  if (stats.slowestServices.length > 0) {
    console.log('Slowest Services:');
    stats.slowestServices.forEach((service, index) => {
      console.log(`  ${index + 1}. ${service.token}: ${service.averageTime.toFixed(2)}ms avg`);
    });
  }

  if (stats.mostResolvedServices.length > 0) {
    console.log('Most Resolved Services:');
    stats.mostResolvedServices.forEach((service, index) => {
      console.log(`  ${index + 1}. ${service.token}: ${service.totalResolutions} resolutions`);
    });
  }

  // Demonstrate reset functionality
  console.log('\n--- Resetting Performance Stats ---');
  performanceContainer.resetPerformanceStats();
  const resetStats = performanceContainer.getPerformanceStats();
  console.log(`Resolutions after reset: ${resetStats.totalResolutions}`);

  // Clean up
  await performanceContainer.dispose();
  console.log('Performance container disposed');
}

// Run the examples
if (require.main === module) {
  main()
    .then(() => performanceExample())
    .catch(console.error);
}

export { main, performanceExample }; 