import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as YAML from 'yaml';

// Mock dependencies
vi.mock('fs');
vi.mock('yaml');
vi.mock('./Logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
const { default: Persona } = await import('./Persona');
const { default: logger } = await import('./Logger');

describe('Persona', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor - successful load', () => {
    it('should load persona from YAML file', () => {
      const mockPersonaData = {
        name: 'ChatBot',
        context: 'You are a helpful assistant',
        greeting: 'Hello there!',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');

      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/persona.yaml', 'utf8');
      expect(YAML.parse).toHaveBeenCalledWith('yaml content');
      expect(persona.name).toBe('ChatBot');
      expect(persona.directive).toBe('You are a helpful assistant');
      expect(persona.greeting).toBe('Hello there!');
    });

    it('should calculate number of tokens in directive', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'One two three four five',
        greeting: 'Hi',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');

      expect(persona.numTokens).toBe(5);
    });

    it('should log successful load with info', () => {
      const mockPersonaData = {
        name: 'TestBot',
        context: 'Test context with words',
        greeting: 'Greetings',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      new Persona('/path/to/persona.yaml');

      expect(logger.info).toHaveBeenCalledWith(
        'Loaded persona: TestBot with 4 token directive'
      );
    });

    it('should handle single word directive', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'Word',
        greeting: 'Hi',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');

      expect(persona.numTokens).toBe(1);
    });

    it('should handle empty directive', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: '',
        greeting: 'Hi',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');

      expect(persona.numTokens).toBe(1); // Empty string split gives ['']
    });
  });

  describe('constructor - error handling', () => {
    it('should handle file read errors gracefully', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const persona = new Persona('/nonexistent/persona.yaml');

      expect(persona.name).toBe('');
      expect(persona.directive).toBe('');
      expect(persona.greeting).toBe('');
      expect(persona.numTokens).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error loading persona file')
      );
    });

    it('should handle YAML parse errors gracefully', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid yaml content');
      vi.mocked(YAML.parse).mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const persona = new Persona('/path/to/bad.yaml');

      expect(persona.name).toBe('');
      expect(persona.directive).toBe('');
      expect(persona.greeting).toBe('');
      expect(persona.numTokens).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log error with error message', () => {
      const error = new Error('Custom error message');
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error;
      });

      new Persona('/path/to/persona.yaml');

      expect(logger.error).toHaveBeenCalledWith(`Error loading persona file: ${error}`);
    });
  });

  describe('insertName', () => {
    it('should replace {NAME} with persona name', () => {
      const mockPersonaData = {
        name: 'ChatBot',
        context: 'Context',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');
      const result = persona.insertName('Hello, I am {NAME}');

      expect(result).toBe('Hello, I am ChatBot');
    });

    it('should replace multiple occurrences of {NAME}', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'Context',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');
      const result = persona.insertName('{NAME} here, {NAME} speaking');

      expect(result).toBe('Bot here, Bot speaking');
    });

    it('should return unchanged text if no {NAME} present', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'Context',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');
      const result = persona.insertName('No placeholder here');

      expect(result).toBe('No placeholder here');
    });

    it('should handle empty string', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'Context',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');
      const result = persona.insertName('');

      expect(result).toBe('');
    });

    it('should work even when persona failed to load', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const persona = new Persona('/nonexistent/persona.yaml');
      const result = persona.insertName('I am {NAME}');

      expect(result).toBe('I am '); // Empty name replaces {NAME}
    });

    it('should handle {NAME} at start and end of string', () => {
      const mockPersonaData = {
        name: 'TestBot',
        context: 'Context',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');
      const result = persona.insertName('{NAME} is my name {NAME}');

      expect(result).toBe('TestBot is my name TestBot');
    });

    it('should be case-sensitive for {NAME}', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'Context',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');
      const result = persona.insertName('I am {NAME} not {name}');

      expect(result).toBe('I am Bot not {name}');
    });
  });

  describe('token counting', () => {
    it('should handle multi-word directives correctly', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'You are a helpful friendly conversational AI assistant',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');

      expect(persona.numTokens).toBe(8);
    });

    it('should handle extra whitespace in directive', () => {
      const mockPersonaData = {
        name: 'Bot',
        context: 'Word1  Word2   Word3',
        greeting: 'Hello',
      };

      vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
      vi.mocked(YAML.parse).mockReturnValue(mockPersonaData);

      const persona = new Persona('/path/to/persona.yaml');

      // split(' ') will create empty strings for extra spaces
      expect(persona.numTokens).toBeGreaterThan(0);
    });
  });
});
