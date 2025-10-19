import { describe, it, expect } from 'vitest';
import ResponseToken from './ResponseToken';

describe('ResponseToken', () => {
  it('should create a token with token and channel', () => {
    const token = new ResponseToken('abc123', 'general');

    expect(token.token).toBe('abc123');
    expect(token.channel).toBe('general');
  });

  it('should store different tokens and channels', () => {
    const token1 = new ResponseToken('token1', 'channel1');
    const token2 = new ResponseToken('token2', 'channel2');

    expect(token1.token).not.toBe(token2.token);
    expect(token1.channel).not.toBe(token2.channel);
  });

  it('should allow empty strings', () => {
    const token = new ResponseToken('', '');

    expect(token.token).toBe('');
    expect(token.channel).toBe('');
  });

  it('should handle special characters in token and channel', () => {
    const token = new ResponseToken('tok-en_123!@#', 'chan#nel$123');

    expect(token.token).toBe('tok-en_123!@#');
    expect(token.channel).toBe('chan#nel$123');
  });
});
