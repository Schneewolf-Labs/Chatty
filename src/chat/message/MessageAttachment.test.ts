import { describe, it, expect } from 'vitest';
import MessageAttachment from './MessageAttachment';

describe('MessageAttachment', () => {
  it('should create an attachment with message and url', () => {
    const mockMessage = { id: '123' };
    const url = 'https://example.com/image.png';

    const attachment = new MessageAttachment(mockMessage, url);

    expect(attachment.message).toBe(mockMessage);
    expect(attachment.url).toBe(url);
  });

  it('should default type to "image"', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');

    expect(attachment.type).toBe('image');
  });

  it('should initialize data as null', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');

    expect(attachment.data).toBeNull();
  });

  it('should initialize caption as empty string', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');

    expect(attachment.caption).toBe('');
  });

  it('should initialize processing as false', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');

    expect(attachment.processing).toBe(false);
  });

  it('should allow setting caption', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');
    attachment.caption = 'A beautiful sunset';

    expect(attachment.caption).toBe('A beautiful sunset');
  });

  it('should allow setting processing status', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');
    attachment.processing = true;

    expect(attachment.processing).toBe(true);
  });

  it('should allow setting data', () => {
    const attachment = new MessageAttachment({}, 'https://example.com/pic.jpg');
    const imageData = { width: 1920, height: 1080, format: 'png' };
    attachment.data = imageData;

    expect(attachment.data).toBe(imageData);
  });
});
