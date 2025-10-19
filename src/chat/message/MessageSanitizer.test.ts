import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../util/Logger', () => ({
  default: {
    debug: vi.fn(),
  },
}));

// Mock the bad-words and sentiment modules to avoid constructor issues
vi.mock('bad-words', () => ({
  default: class MockBadWords {
    isProfane() {
      return false;
    }
  },
}));

vi.mock('sentiment', () => ({
  default: class MockSentiment {
    analyze() {
      return { score: 0 };
    }
  },
}));

const { default: MessageSanitizer } = await import('./MessageSanitizer');

describe('MessageSanitizer', () => {
  const defaultOptions = {
    'reject-profanity': false,
    'profanity-replacement': 'Please be nice!',
    'reject-negativity': false,
    'sentiment-threshold': -2,
    'remove-actions': true,
  };
  const persona = { name: 'TestBot' };
  const chatDelimiter = '\n';

  // Helper to create mock filter and sentiment
  const createMockFilter = () => ({ isProfane: vi.fn(() => false) });
  const createMockSentiment = () => ({ analyze: vi.fn(() => ({ score: 0 })) });

  describe('sanitize', () => {
    let sanitizer: MessageSanitizer;

    beforeEach(() => {
      sanitizer = new MessageSanitizer(
        defaultOptions,
        persona,
        chatDelimiter,
        createMockFilter(),
        createMockSentiment()
      );
    });

    it('should remove persona name prefix', () => {
      const result = sanitizer.sanitize('TestBot: Hello world');

      expect(result).toBe(' Hello world');
    });

    it('should only remove first occurrence of persona name', () => {
      const result = sanitizer.sanitize('TestBot: TestBot says hello');

      expect(result).toBe(' TestBot says hello');
    });

    it('should remove @mentions', () => {
      const result = sanitizer.sanitize('Hey @user123 how are you?');

      expect(result).toBe('Hey  how are you?');
    });

    it('should remove multiple @mentions', () => {
      const result = sanitizer.sanitize('@alice @bob hey there');

      expect(result).toBe('  hey there');
    });

    it('should handle @mentions with underscores and numbers', () => {
      const result = sanitizer.sanitize('Hello @user_name_123');

      expect(result).toBe('Hello ');
    });

    it('should remove http URLs', () => {
      const result = sanitizer.sanitize('Check http://example.com');

      expect(result).toBe('Check ');
    });

    it('should remove https URLs', () => {
      const result = sanitizer.sanitize('Visit https://example.com/page');

      expect(result).toBe('Visit ');
    });

    it('should remove ftp URLs', () => {
      const result = sanitizer.sanitize('Download ftp://files.example.com/file.zip');

      expect(result).toBe('Download ');
    });

    it('should remove multiple URLs', () => {
      const result = sanitizer.sanitize('See https://site1.com and http://site2.com');

      expect(result).toBe('See  and ');
    });

    it('should remove content in square brackets', () => {
      const result = sanitizer.sanitize('Hello [some metadata] world');

      expect(result).toBe('Hello  world');
    });

    it('should remove multiple bracketed sections', () => {
      const result = sanitizer.sanitize('[meta1] Text [meta2] here [meta3]');

      expect(result).toBe(' Text  here ');
    });

    it('should handle nested brackets by removing smallest match first', () => {
      const result = sanitizer.sanitize('Test [outer [inner]] text');

      // Regex is non-greedy, so removes [inner] first, leaving [outer ] which has closing ] from inner
      expect(result).toBe('Test ] text');
    });

    it('should remove actions in asterisks when remove-actions is true', () => {
      const result = sanitizer.sanitize('Hello *waves* how are you?');

      expect(result).toBe('Hello  how are you?');
    });

    it('should remove multiple actions', () => {
      const result = sanitizer.sanitize('*waves* Hello there *smiles*');

      expect(result).toBe(' Hello there ');
    });

    it('should NOT remove actions when remove-actions is false', () => {
      const options = { ...defaultOptions, 'remove-actions': false };
      const noActionRemoval = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        createMockFilter(),
        createMockSentiment()
      );

      const result = noActionRemoval.sanitize('Hello *waves* there');

      expect(result).toBe('Hello *waves* there');
    });

    it('should apply all sanitization rules together', () => {
      const message = 'TestBot: Hey @user check https://example.com [note] *smiles*';
      const result = sanitizer.sanitize(message);

      expect(result).toBe(' Hey  check   ');
    });

    it('should handle empty string', () => {
      const result = sanitizer.sanitize('');

      expect(result).toBe('');
    });

    it('should handle message with no sanitizable content', () => {
      const result = sanitizer.sanitize('Just plain text');

      expect(result).toBe('Just plain text');
    });
  });

  describe('trimResponse', () => {
    let sanitizer: MessageSanitizer;

    beforeEach(() => {
      sanitizer = new MessageSanitizer(
        defaultOptions,
        persona,
        chatDelimiter,
        createMockFilter(),
        createMockSentiment()
      );
    });

    it('should trim at delimiter', () => {
      const result = sanitizer.trimResponse('Hello world\nExtra text after');

      expect(result).toBe('Hello world');
    });

    it('should handle message without delimiter', () => {
      const result = sanitizer.trimResponse('No delimiter here');

      expect(result).toBe('No delimiter here');
    });

    it('should trim whitespace', () => {
      const result = sanitizer.trimResponse('  Hello world  ');

      expect(result).toBe('Hello world');
    });

    it('should remove http URLs and everything after', () => {
      const result = sanitizer.trimResponse('Check this out http://example.com');

      expect(result).toBe('Check this out '); // Note: trailing space before URL is preserved
    });

    it('should remove https URLs and everything after', () => {
      const result = sanitizer.trimResponse('Visit https://test.com/page more text');

      expect(result).toBe('Visit '); // Note: trailing space before URL is preserved
    });

    it('should handle URL at start of message', () => {
      const result = sanitizer.trimResponse('http://example.com is a site');

      expect(result).toBe('');
    });

    it('should apply both delimiter and URL trimming', () => {
      const result = sanitizer.trimResponse('Text before http://url.com\nText after');

      expect(result).toBe('Text before '); // Trailing space preserved
    });

    it('should trim whitespace after URL removal', () => {
      const result = sanitizer.trimResponse('Hello   http://example.com');

      expect(result).toBe('Hello   '); // Whitespace before URL is preserved
    });

    it('should handle empty string', () => {
      const result = sanitizer.trimResponse('');

      expect(result).toBe('');
    });

    it('should handle only whitespace', () => {
      const result = sanitizer.trimResponse('   \n   ');

      expect(result).toBe('');
    });

    it('should preserve content before first delimiter', () => {
      const result = sanitizer.trimResponse('Keep this\nDiscard\nAlso discard');

      expect(result).toBe('Keep this');
    });
  });

  describe('shouldReject', () => {
    it('should not reject when profanity check is disabled', () => {
      const mockFilter = { isProfane: vi.fn(() => true) };
      const sanitizer = new MessageSanitizer(
        defaultOptions,
        persona,
        chatDelimiter,
        mockFilter,
        createMockSentiment()
      );

      const result = sanitizer.shouldReject('test message');

      expect(result).toBe(false);
      expect(mockFilter.isProfane).not.toHaveBeenCalled();
    });

    it('should not reject when negativity check is disabled', () => {
      const mockSentiment = { analyze: vi.fn(() => ({ score: -10 })) };
      const sanitizer = new MessageSanitizer(
        defaultOptions,
        persona,
        chatDelimiter,
        createMockFilter(),
        mockSentiment
      );

      const result = sanitizer.shouldReject('terrible awful message');

      expect(result).toBe(false);
      expect(mockSentiment.analyze).not.toHaveBeenCalled();
    });

    it('should reject profane messages when profanity check is enabled', () => {
      const mockFilter = { isProfane: vi.fn(() => true) };
      const options = { ...defaultOptions, 'reject-profanity': true };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        mockFilter,
        createMockSentiment()
      );

      const result = sanitizer.shouldReject('bad word here');

      expect(result).toBe(true);
      expect(mockFilter.isProfane).toHaveBeenCalledWith('bad word here');
    });

    it('should not reject clean messages when profanity check is enabled', () => {
      const mockFilter = { isProfane: vi.fn(() => false) };
      const options = { ...defaultOptions, 'reject-profanity': true };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        mockFilter,
        createMockSentiment()
      );

      const result = sanitizer.shouldReject('clean message');

      expect(result).toBe(false);
      expect(mockFilter.isProfane).toHaveBeenCalledWith('clean message');
    });

    it('should reject negative messages below threshold', () => {
      const mockSentiment = { analyze: vi.fn(() => ({ score: -5 })) };
      const options = { ...defaultOptions, 'reject-negativity': true, 'sentiment-threshold': -2 };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        createMockFilter(),
        mockSentiment
      );

      const result = sanitizer.shouldReject('very negative message');

      expect(result).toBe(true);
      expect(mockSentiment.analyze).toHaveBeenCalledWith('very negative message');
    });

    it('should not reject messages at or above threshold', () => {
      const mockSentiment = { analyze: vi.fn(() => ({ score: -1 })) };
      const options = { ...defaultOptions, 'reject-negativity': true, 'sentiment-threshold': -2 };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        createMockFilter(),
        mockSentiment
      );

      const result = sanitizer.shouldReject('slightly negative message');

      expect(result).toBe(false);
    });

    it('should not reject positive messages when negativity check enabled', () => {
      const mockSentiment = { analyze: vi.fn(() => ({ score: 5 })) };
      const options = { ...defaultOptions, 'reject-negativity': true, 'sentiment-threshold': 0 };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        createMockFilter(),
        mockSentiment
      );

      const result = sanitizer.shouldReject('happy positive message');

      expect(result).toBe(false);
    });

    it('should check profanity before sentiment', () => {
      const mockFilter = { isProfane: vi.fn(() => true) };
      const mockSentiment = { analyze: vi.fn(() => ({ score: -5 })) };
      const options = {
        ...defaultOptions,
        'reject-profanity': true,
        'reject-negativity': true,
      };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        mockFilter,
        mockSentiment
      );

      const result = sanitizer.shouldReject('profane and negative');

      expect(result).toBe(true);
      expect(mockFilter.isProfane).toHaveBeenCalled();
      // Sentiment should not be checked if profanity already rejected
      expect(mockSentiment.analyze).not.toHaveBeenCalled();
    });

    it('should use configured sentiment threshold', () => {
      const mockSentiment = { analyze: vi.fn(() => ({ score: -3 })) };
      const options = {
        ...defaultOptions,
        'reject-negativity': true,
        'sentiment-threshold': -5, // More lenient threshold
      };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        createMockFilter(),
        mockSentiment
      );

      const result = sanitizer.shouldReject('message');

      expect(result).toBe(false); // -3 is above -5 threshold
    });

    it('should handle edge case of score exactly at threshold', () => {
      const mockSentiment = { analyze: vi.fn(() => ({ score: -2 })) };
      const options = { ...defaultOptions, 'reject-negativity': true, 'sentiment-threshold': -2 };
      const sanitizer = new MessageSanitizer(
        options,
        persona,
        chatDelimiter,
        createMockFilter(),
        mockSentiment
      );

      const result = sanitizer.shouldReject('message');

      expect(result).toBe(false); // Score equal to threshold should not reject
    });
  });
});
