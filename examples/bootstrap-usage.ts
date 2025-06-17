import { container } from '../src';

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

async function bootstrap() {
  // Register services with the default container
  container
    .registerSingleton('ILogger', () => new ConsoleLogger())
    .registerSingleton('IUserRepository', () => new InMemoryUserRepository())
    .registerSingleton(UserService, () => new UserService(
      container.resolve<IUserRepository>('IUserRepository'),
      container.resolve<ILogger>('ILogger')
    ));
}

async function main() {
  console.log('=== Bootstrap DI Container Example ===\n');
  
  await bootstrap();

  const userService = container.resolve(UserService);
  const user = await userService.getUserById('1');
  console.log('Found user:', user);
  
  // Get all users
  const users = await userService.getAllUsers();
  console.log('All users:', users);
  
  // Clean up
  await container.dispose();
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main, bootstrap };

