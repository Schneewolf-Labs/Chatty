# Testing Guide

This project uses [Vitest](https://vitest.dev/) as its testing framework.

## Running Tests

```bash
# Run tests in watch mode (auto-reruns on file changes)
yarn test

# Run tests once
yarn test:run

# Run tests with UI (opens a browser interface)
yarn test:ui

# Run tests with coverage report
yarn test:coverage
```

## Writing Tests

Test files should be placed alongside the source files they test, using the `.test.ts` extension:

```
src/
├── util/
│   ├── RepetitionDetector.ts
│   └── RepetitionDetector.test.ts
```

### Example Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import MyClass from './MyClass';

describe('MyClass', () => {
  it('should do something', () => {
    const instance = new MyClass();
    const result = instance.doSomething();
    expect(result).toBe(expectedValue);
  });
});
```

## Mocking

Use `vi.mock()` to mock modules:

```typescript
import { vi } from 'vitest';

vi.mock('../../util/Logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
  },
}));
```

## Coverage

Coverage reports are generated in the `coverage/` directory when you run `yarn test:coverage`.

The HTML report can be viewed by opening `coverage/index.html` in your browser.

## Configuration

The Vitest configuration is in `vitest.config.ts`. Key settings:

- **Environment**: Node.js
- **Globals**: Enabled (you don't need to import `describe`, `it`, `expect` in every file)
- **Coverage Provider**: v8
- **Test Pattern**: `src/**/*.{test,spec}.ts`

## Example Tests

Check out `src/util/RepetitionDetector.test.ts` for a working example of:
- Basic test structure
- Mocking dependencies
- Testing different scenarios
- Using `vi.fn()` for mock functions
