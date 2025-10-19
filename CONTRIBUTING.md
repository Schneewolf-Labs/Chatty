# Contributing to Chatty

This document provides guidelines and instructions for contributing to Chatty.

## Getting Started

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Chatty.git
   cd Chatty
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Set up your development environment**
   - Copy `.env.example` to `.env` (if it exists)
   - Configure `config.yml` for local development
   - Create a test `persona.yaml`

### Development Workflow

```bash
# Run in development mode (with auto-reload)
npm run dev

# Type checking
npm run typecheck

# Run linter
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build
```

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the [issue tracker](https://github.com/Schneewolf-Labs/Chatty/issues) to avoid duplicates.

**Good bug reports include:**
- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages
- Screenshots (if applicable)

**Bug Report Template:**
```markdown
## Description
A clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Environment
- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- Node version: [e.g., 18.17.0]
- Chatty version: [e.g., 0.0.1]

## Additional Context
Logs, screenshots, or other relevant information
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues.

**Good enhancement suggestions include:**
- Clear, descriptive title
- Detailed description of the proposed functionality
- Explanation of why this enhancement would be useful
- Possible implementation approach (optional)

### Pull Requests

1. **Follow the coding standards** (see below)
2. **Write or update tests** for your changes
3. **Ensure all tests pass** before submitting
4. **Update documentation** as needed
5. **Write clear commit messages**
6. **Keep PRs focused** - one feature/fix per PR

**Pull Request Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] New tests added (if applicable)
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

## Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Enable strict mode** - respect all TypeScript errors
- **Define interfaces** for all public APIs
- **Use descriptive names** - clarity over brevity
- **Avoid `any`** - use proper types or `unknown`

### Code Style

```typescript
// Good
interface MessageOptions {
    author: string;
    text: string;
    timestamp?: number;
}

function processMessage(options: MessageOptions): void {
    const { author, text, timestamp = Date.now() } = options;
    // Implementation
}

// Avoid
function process(a: any, b: any) {
    // Implementation
}
```

### File Organization

```
src/
├── module/
│   ├── ModuleName.ts       # Main implementation
│   ├── ModuleName.test.ts  # Co-located tests
│   ├── types.ts            # Shared types (if needed)
│   └── utils.ts            # Helper functions
```

### Naming Conventions

- **Classes**: PascalCase (`MessageHandler`)
- **Interfaces**: PascalCase (`ChatMessage`)
- **Functions/Methods**: camelCase (`sendMessage`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Files**: PascalCase for classes (`MessageHandler.ts`), camelCase for utilities (`logger.ts`)

### Comments

```typescript
// Good: Explain "why", not "what"
// Delay response to prevent rate limiting
await sleep(responseInterval);

// Avoid: Redundant comments
// Set the user name
const userName = 'Alice';

// Good: Document complex logic
/**
 * Calculates response chance based on elapsed time using logarithmic scaling.
 * This creates a natural feeling conversation flow where the bot is more
 * likely to respond as time passes without a response.
 */
private calculateResponseChance(): number {
    // Implementation
}
```

## Testing Guidelines

### Writing Tests

- **Co-locate tests** with source files (`Module.test.ts` next to `Module.ts`)
- **Test behavior**, not implementation details
- **Use descriptive test names** that explain what's being tested
- **Mock external dependencies** (file system, network, etc.)
- **Test edge cases** (empty inputs, nulls, boundaries)

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ModuleName', () => {
    let instance: ModuleName;

    beforeEach(() => {
        vi.clearAllMocks();
        instance = new ModuleName();
    });

    describe('methodName', () => {
        it('should handle normal case', () => {
            const result = instance.methodName('input');
            expect(result).toBe('expected');
        });

        it('should handle empty input', () => {
            const result = instance.methodName('');
            expect(result).toBe('');
        });

        it('should throw on invalid input', () => {
            expect(() => instance.methodName(null as any))
                .toThrow('Invalid input');
        });
    });
});
```

### Test Coverage

- **Aim for >80% coverage** for new code
- **100% coverage required** for utility functions
- **Test both success and failure paths**
- **Run coverage reports**: `npm run test:coverage`

## Documentation

### Code Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Processes incoming chat messages and queues them for response.
 *
 * @param message - The chat message to process
 * @throws {Error} If message is invalid or empty
 * @returns The queue position of the message
 *
 * @example
 * ```typescript
 * const position = manager.receiveMessage(chatMessage);
 * console.log(`Message queued at position ${position}`);
 * ```
 */
receiveMessage(message: ChatMessage): number {
    // Implementation
}
```

### README Updates

Update the README when:
- Adding new features
- Changing configuration options
- Modifying setup instructions
- Adding dependencies

### Changelog

- Update `CHANGELOG.md` for significant changes
- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security

## Git Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(discord): add support for thread replies

Implements thread-aware message handling for Discord channels.
Messages sent in threads now properly maintain context.

Closes #123
```

```
fix(streamer): prevent infinite loop on malformed tokens

Added safety check to limit token processing iterations.

Fixes #456
```

```
docs(readme): update installation instructions

Added troubleshooting section for common setup issues.
```

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag -a v0.1.0 -m "Release v0.1.0"`
4. Push tags: `git push --tags`
5. Create GitHub release with changelog

## Getting Help

- **Documentation**: Check existing docs first
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community Discord (if available)

## Recognition

Contributors will be:
- Listed in release notes
- Added to `CONTRIBUTORS.md` (if applicable)
- Mentioned in project documentation

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v3.0.

---

Thank you for contributing to Chatty! 🎉
