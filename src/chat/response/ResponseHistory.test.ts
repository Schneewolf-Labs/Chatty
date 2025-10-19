import { describe, it, expect, beforeEach } from 'vitest';
import ResponseHistory from './ResponseHistory';

describe('ResponseHistory', () => {
  let history: ResponseHistory;
  const mockPersona = { name: 'TestBot' };

  beforeEach(() => {
    history = new ResponseHistory(mockPersona);
  });

  describe('constructor', () => {
    it('should initialize with empty history', () => {
      expect(history.getHistory()).toEqual([]);
    });

    it('should initialize lastResponseID to 0', () => {
      expect(history.lastResponseID).toBe(0);
    });
  });

  describe('addResponse', () => {
    it('should add first response', () => {
      history.addResponse('Hello world');

      expect(history.getResponse(0)).toBe('Hello world');
    });

    it('should append to existing response at same ID', () => {
      history.addResponse('Hello');
      history.addResponse(' world');

      expect(history.getResponse(0)).toBe('Hello  world'); // Note: addResponse adds space between
    });

    it('should add responses at different IDs', () => {
      history.addResponse('First response');
      history.setLastResponseID(1);
      history.addResponse('Second response');

      expect(history.getResponse(0)).toBe('First response');
      expect(history.getResponse(1)).toBe('Second response');
    });

    it('should handle multiple appends to same response', () => {
      history.addResponse('Part 1');
      history.addResponse('Part 2');
      history.addResponse('Part 3');

      expect(history.getResponse(0)).toBe('Part 1 Part 2 Part 3');
    });
  });

  describe('addEvent', () => {
    it('should format event with persona name and asterisks', () => {
      history.addEvent('waves');

      expect(history.getResponse(0)).toBe('*TestBot waves*');
    });

    it('should append event to existing response with newlines', () => {
      history.addResponse('Hello there');
      history.addEvent('waves');

      expect(history.getResponse(0)).toBe('Hello there\n*TestBot waves*\n');
    });

    it('should handle multiple events', () => {
      history.addEvent('waves');
      history.addEvent('smiles');

      expect(history.getResponse(0)).toBe('*TestBot waves*\n*TestBot smiles*\n');
    });

    it('should add event at correct response ID', () => {
      history.setLastResponseID(1);
      history.addEvent('enters chat');

      expect(history.getResponse(0)).toBeUndefined();
      expect(history.getResponse(1)).toBe('*TestBot enters chat*');
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      history.addResponse('Response 0');
      history.setLastResponseID(1);
      history.addResponse('Response 1');
      history.setLastResponseID(2);
      history.addResponse('Response 2');
      history.setLastResponseID(3);
      history.addResponse('Response 3');
    });

    it('should return all responses when no limit specified', () => {
      const result = history.getHistory();

      expect(result).toEqual(['Response 3', 'Response 2', 'Response 1', 'Response 0']);
    });

    it('should return limited number of responses', () => {
      const result = history.getHistory(2);

      expect(result).toEqual(['Response 3', 'Response 2']);
    });

    it('should return responses in reverse chronological order', () => {
      const result = history.getHistory(3);

      expect(result[0]).toBe('Response 3');
      expect(result[1]).toBe('Response 2');
      expect(result[2]).toBe('Response 1');
    });

    it('should return empty array when history is empty', () => {
      const emptyHistory = new ResponseHistory(mockPersona);
      const result = emptyHistory.getHistory();

      expect(result).toEqual([]);
    });

    it('should skip undefined responses', () => {
      history.setLastResponseID(10);
      history.addResponse('Response 10');

      const result = history.getHistory(20);

      // Should only return defined responses
      expect(result).toContain('Response 10');
      expect(result).toContain('Response 3');
      expect(result.length).toBe(5); // 0, 1, 2, 3, 10
    });

    it('should handle request for more responses than exist', () => {
      const result = history.getHistory(100);

      expect(result.length).toBe(4);
    });
  });

  describe('getResponse', () => {
    it('should return response at specific ID', () => {
      history.addResponse('Test response');

      expect(history.getResponse(0)).toBe('Test response');
    });

    it('should return undefined for non-existent ID', () => {
      expect(history.getResponse(999)).toBeUndefined();
    });

    it('should return correct response for multiple IDs', () => {
      history.setLastResponseID(0);
      history.addResponse('First');
      history.setLastResponseID(5);
      history.addResponse('Second');

      expect(history.getResponse(0)).toBe('First');
      expect(history.getResponse(5)).toBe('Second');
    });
  });

  describe('setLastResponseID', () => {
    it('should set the last response ID', () => {
      history.setLastResponseID(5);

      expect(history.lastResponseID).toBe(5);
    });

    it('should allow setting to 0', () => {
      history.setLastResponseID(10);
      history.setLastResponseID(0);

      expect(history.lastResponseID).toBe(0);
    });

    it('should throw error for negative ID', () => {
      expect(() => {
        history.setLastResponseID(-1);
      }).toThrow('Invalid response ID');
    });

    it('should throw error for non-number ID', () => {
      expect(() => {
        history.setLastResponseID('5' as any);
      }).toThrow('Invalid response ID');
    });

    it('should throw error for NaN', () => {
      expect(() => {
        history.setLastResponseID(NaN);
      }).toThrow('Invalid response ID');
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed responses and events', () => {
      history.addResponse('Hello');
      history.addEvent('waves');
      history.addResponse(' everyone');

      expect(history.getResponse(0)).toBe('Hello\n*TestBot waves*\n  everyone'); // Double space from addResponse
    });

    it('should maintain separate response threads', () => {
      history.setLastResponseID(0);
      history.addResponse('Thread 0A');
      history.addResponse('Thread 0B');

      history.setLastResponseID(1);
      history.addResponse('Thread 1A');
      history.addResponse('Thread 1B');

      expect(history.getResponse(0)).toBe('Thread 0A Thread 0B');
      expect(history.getResponse(1)).toBe('Thread 1A Thread 1B');
    });

    it('should handle switching between response IDs', () => {
      history.setLastResponseID(0);
      history.addResponse('First part of 0');

      history.setLastResponseID(1);
      history.addResponse('Response 1');

      history.setLastResponseID(0);
      history.addResponse('Second part of 0');

      expect(history.getResponse(0)).toBe('First part of 0 Second part of 0');
      expect(history.getResponse(1)).toBe('Response 1');
    });
  });
});
