import { describe, it, expect, beforeEach, vi } from 'vitest';
import ChatMessage from './ChatMessage';
import MessageAttachment from './MessageAttachment';

vi.mock('../../util/Logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ChatMessage', () => {
  describe('constructor', () => {
    it('should create a message with author and text', () => {
      const message = new ChatMessage('Alice', 'Hello world');

      expect(message.author).toBe('Alice');
      expect(message.text).toBe('Hello world');
    });

    it('should set timestamp to current time', () => {
      const before = Date.now();
      const message = new ChatMessage('Bob', 'Test');
      const after = Date.now();

      expect(message.timestamp).toBeGreaterThanOrEqual(before);
      expect(message.timestamp).toBeLessThanOrEqual(after);
    });

    it('should initialize with empty options by default', () => {
      const message = new ChatMessage('Alice', 'Hello');

      expect(message.options).toEqual({});
    });

    it('should accept custom options', () => {
      const options = { priority: 'high', metadata: { foo: 'bar' } };
      const message = new ChatMessage('Alice', 'Hello', options);

      expect(message.options).toBe(options);
    });

    it('should initialize with empty attachments array', () => {
      const message = new ChatMessage('Alice', 'Hello');

      expect(message.attachments).toEqual([]);
      expect(message.attachments.length).toBe(0);
    });

    it('should initialize channel as null', () => {
      const message = new ChatMessage('Alice', 'Hello');

      expect(message.channel).toBeNull();
    });

    it('should initialize directReply as false', () => {
      const message = new ChatMessage('Alice', 'Hello');

      expect(message.directReply).toBe(false);
    });

    it('should initialize isReply as false', () => {
      const message = new ChatMessage('Alice', 'Hello');

      expect(message.isReply).toBe(false);
    });

    it('should not have reply function by default', () => {
      const message = new ChatMessage('Alice', 'Hello');

      expect(message.reply).toBeUndefined();
    });
  });

  describe('getText', () => {
    it('should return plain text when no attachments', () => {
      const message = new ChatMessage('Alice', 'Hello world');

      expect(message.getText()).toBe('Hello world');
    });

    it('should append single attachment to text', () => {
      const message = new ChatMessage('Alice', 'Check this out');
      const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');
      attachment.caption = 'sunset';
      message.attachments.push(attachment);

      const result = message.getText();
      expect(result).toBe('Check this out\n[image:sunset]\n');
    });

    it('should append multiple attachments to text', () => {
      const message = new ChatMessage('Alice', 'Multiple images');

      const attachment1 = new MessageAttachment({}, 'https://example.com/pic1.jpg');
      attachment1.caption = 'first';
      message.attachments.push(attachment1);

      const attachment2 = new MessageAttachment({}, 'https://example.com/pic2.jpg');
      attachment2.caption = 'second';
      message.attachments.push(attachment2);

      const result = message.getText();
      expect(result).toBe('Multiple images\n[image:first]\n[image:second]\n');
    });

    it('should handle attachments with empty captions', () => {
      const message = new ChatMessage('Alice', 'Photo');
      const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');
      message.attachments.push(attachment);

      const result = message.getText();
      expect(result).toBe('Photo\n[image:]\n');
    });

    it('should preserve original text when attachments are added', () => {
      const message = new ChatMessage('Alice', 'Original text');
      const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');
      attachment.caption = 'test';
      message.attachments.push(attachment);

      message.getText(); // Call once
      expect(message.text).toBe('Original text'); // Should not modify original
    });
  });

  describe('message properties', () => {
    it('should allow setting channel', () => {
      const message = new ChatMessage('Alice', 'Hello');
      message.channel = 'general';

      expect(message.channel).toBe('general');
    });

    it('should allow setting directReply', () => {
      const message = new ChatMessage('Alice', 'Hello');
      message.directReply = true;

      expect(message.directReply).toBe(true);
    });

    it('should allow setting isReply', () => {
      const message = new ChatMessage('Alice', 'Hello');
      message.isReply = true;

      expect(message.isReply).toBe(true);
    });

    it('should allow setting reply function', () => {
      const message = new ChatMessage('Alice', 'Hello');
      const replyFn = vi.fn();
      message.reply = replyFn;

      expect(message.reply).toBe(replyFn);

      message.reply?.('Response');
      expect(replyFn).toHaveBeenCalledWith('Response');
    });
  });
});
