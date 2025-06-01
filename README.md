# @lexms/di-container

A lightweight, TypeScript-first dependency injection container with support for both synchronous and asynchronous service resolution.

## Features

- 🚀 **Lightweight**: Minimal overhead with no external dependencies (except reflect-metadata for decorators)
- 🔄 **Sync & Async**: Support for both synchronous and asynchronous service factories
- 🛡️ **Type Safe**: Full TypeScript support with comprehensive type definitions
- 🔁 **Lifetime Management**: Singleton and transient service lifetimes
- 🎯 **Flexible Tokens**: Register services using classes, strings, or symbols
- 🚫 **Circular Dependency Detection**: Automatic detection and prevention of circular dependencies
- 🎨 **Decorator Support**: Optional decorator-based dependency injection
- 🧹 **Automatic Cleanup**: Built-in disposal pattern for resource cleanup
- 📊 **Logging**: Optional logging for debugging and monitoring

## Installation

```bash
pnpm add @lexms/di-container
```

For decorator support, also install:
```bash
pnpm add reflect-metadata
```

## Quick Start

```typescript
import { DIContainer, LifetimeScope } from '@lexms/di-container';

// Create a container
const container = new DIContainer();

// Define services
class DatabaseService {
  connect() {
    console.log('Connected to database');
  }
}

class UserService {
  constructor(private db: DatabaseService) {}
  
  getUsers() {
    this.db.connect();
    return ['user1', 'user2'];
  }
}

// Register services
container.registerSingleton(DatabaseService, () => new DatabaseService());
container.registerSingleton(UserService, () => 
  new UserService(container.resolve(DatabaseService))
);

// Resolve and use
const userService = container.resolve(UserService);
const users = userService.getUsers();
```

## API Reference

### DIContainer

#### Constructor

```typescript
const container = new DIContainer(options?: DIContainerOptions);
```

**Options:**
- `enableLogging?: boolean` - Enable debug logging (default: false)
- `logPrefix?: string` - Custom log prefix (default: 'DIContainer')

#### Registration Methods

##### `register<T>(token, factory, scope?)`

Register a service with explicit lifetime scope.

```typescript
container.register(MyService, () => new MyService(), LifetimeScope.SINGLETON);
```

##### `registerSingleton<T>(token, factory)`

Register a singleton service (same instance returned on every resolve).

```typescript
container.registerSingleton(MyService, () => new MyService());
```

##### `registerTransient<T>(token, factory)`

Register a transient service (new instance returned on every resolve).

```typescript
container.registerTransient(MyService, () => new MyService());
```

##### `registerInstance<T>(token, instance)`

Register an existing instance.

```typescript
const config = { apiUrl: 'https://api.example.com' };
container.registerInstance('config', config);
```

#### Resolution Methods

##### `resolve<T>(token)`

Synchronously resolve a service.

```typescript
const service = container.resolve(MyService);
```

##### `resolveAsync<T>(token)`

Asynchronously resolve a service (required for async factories).

```typescript
const service = await container.resolveAsync(MyAsyncService);
```

#### Utility Methods

##### `has(token): boolean`

Check if a service is registered.

```typescript
if (container.has(MyService)) {
  // Service is registered
}
```

##### `getRegisteredTokens(): (string | symbol)[]`

Get all registered service tokens.

```typescript
const tokens = container.getRegisteredTokens();
```

##### `clear(): void`

Remove all service registrations.

```typescript
container.clear();
```

##### `dispose(): Promise<void>`

Dispose the container and call `dispose()` on all disposable services.

```typescript
await container.dispose();
```

## Advanced Usage

### Async Services

```typescript
class AsyncDatabaseService {
  async connect() {
    // Async connection logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Connected to database');
  }
}

// Register with async factory
container.registerSingleton(AsyncDatabaseService, async () => {
  const service = new AsyncDatabaseService();
  await service.connect();
  return service;
});

// Must use resolveAsync for async factories
const dbService = await container.resolveAsync(AsyncDatabaseService);
```

### String and Symbol Tokens

```typescript
// String tokens
container.registerInstance('apiUrl', 'https://api.example.com');
const apiUrl = container.resolve<string>('apiUrl');

// Symbol tokens
const DATABASE_CONFIG = Symbol('DatabaseConfig');
container.registerInstance(DATABASE_CONFIG, { host: 'localhost', port: 5432 });
const dbConfig = container.resolve<{ host: string; port: number }>(DATABASE_CONFIG);
```

### Disposable Services

Services that implement a `dispose()` method will be automatically disposed when the container is disposed.

```typescript
class ResourceService {
  private connection: any;
  
  constructor() {
    this.connection = createConnection();
  }
  
  async dispose() {
    await this.connection.close();
    console.log('Resources cleaned up');
  }
}

container.registerSingleton(ResourceService, () => new ResourceService());

// Later...
await container.dispose(); // Automatically calls ResourceService.dispose()
```

### Decorator Support (Optional)

First, import reflect-metadata at the top of your main file:

```typescript
import 'reflect-metadata';
import { Injectable, Inject, autoRegister } from '@lexms/di-container';

@Injectable
class DatabaseService {
  connect() {
    console.log('Connected to database');
  }
}

@Injectable
class UserService {
  constructor(
    private db: DatabaseService,
    @Inject('config') private config: any
  ) {}
}

// Auto-register decorated classes
autoRegister(DatabaseService);
autoRegister(UserService);
```

### Error Handling

The container provides specific error types for different failure scenarios:

```typescript
import { 
  ServiceNotFoundError, 
  CircularDependencyError, 
  DIContainerError 
} from '@lexms/di-container';

try {
  const service = container.resolve(UnregisteredService);
} catch (error) {
  if (error instanceof ServiceNotFoundError) {
    console.log('Service not found');
  } else if (error instanceof CircularDependencyError) {
    console.log('Circular dependency detected');
  }
}
```

## Best Practices

### 1. Use Interface-based Design

```typescript
interface IUserRepository {
  getUsers(): User[];
}

class DatabaseUserRepository implements IUserRepository {
  getUsers(): User[] {
    // Database implementation
    return [];
  }
}

class MockUserRepository implements IUserRepository {
  getUsers(): User[] {
    // Mock implementation
    return [{ id: 1, name: 'Test User' }];
  }
}

// Register based on environment
const repository = process.env.NODE_ENV === 'test' 
  ? new MockUserRepository()
  : new DatabaseUserRepository();
  
container.registerInstance('IUserRepository', repository);
```

### 2. Factory Functions for Complex Dependencies

```typescript
container.registerSingleton(UserService, () => {
  const repository = container.resolve<IUserRepository>('IUserRepository');
  const logger = container.resolve<ILogger>('ILogger');
  const config = container.resolve<Config>('config');
  
  return new UserService(repository, logger, config);
});
```

### 3. Container Composition

```typescript
class DatabaseModule {
  static register(container: DIContainer) {
    container.registerSingleton(DatabaseService, () => new DatabaseService());
    container.registerSingleton(UserRepository, () => 
      new UserRepository(container.resolve(DatabaseService))
    );
  }
}

class ServiceModule {
  static register(container: DIContainer) {
    container.registerSingleton(UserService, () =>
      new UserService(container.resolve(UserRepository))
    );
  }
}

// Register all modules
DatabaseModule.register(container);
ServiceModule.register(container);
```

## Development

### Scripts

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run linting
pnpm run lint

# Fix linting issues
pnpm run lint:fix

# Clean build outputs
pnpm run clean
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 