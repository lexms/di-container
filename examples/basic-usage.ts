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

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main }; 