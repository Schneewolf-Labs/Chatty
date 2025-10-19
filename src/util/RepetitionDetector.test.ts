import { describe, it, expect, vi } from 'vitest';
import RepetitionTracker from './RepetitionDetector';

describe('RepetitionTracker', () => {
  describe('isRepetitive', () => {
    it('should detect identical messages as repetitive', () => {
      const tracker = new RepetitionTracker(0.8, 5);
      const mockHistory = {
        getHistory: vi.fn(() => ['Hello world', 'How are you?', 'Good morning']),
      };

      const result = tracker.isRepetitive('Hello world', mockHistory);
      expect(result).toBe(true);
      expect(mockHistory.getHistory).toHaveBeenCalledWith(5);
    });

    it('should detect very similar messages as repetitive', () => {
      const tracker = new RepetitionTracker(0.8, 5);
      const mockHistory = {
        getHistory: vi.fn(() => ['Hello world!', 'How are you?', 'Good morning']),
      };

      const result = tracker.isRepetitive('Hello world', mockHistory);
      expect(result).toBe(true);
    });

    it('should not detect dissimilar messages as repetitive', () => {
      const tracker = new RepetitionTracker(0.8, 5);
      const mockHistory = {
        getHistory: vi.fn(() => ['Completely different text', 'Another message', 'Third one']),
      };

      const result = tracker.isRepetitive('Hello world', mockHistory);
      expect(result).toBe(false);
    });

    it('should respect the similarity threshold', () => {
      // Lower threshold means more sensitive to repetition
      const strictTracker = new RepetitionTracker(0.5, 5);
      const lenientTracker = new RepetitionTracker(0.95, 5);

      const mockHistory = {
        getHistory: vi.fn(() => ['Hello there world']),
      };

      // "Hello world" vs "Hello there world" has moderate similarity
      expect(strictTracker.isRepetitive('Hello world', mockHistory)).toBe(true);
      expect(lenientTracker.isRepetitive('Hello world', mockHistory)).toBe(false);
    });

    it('should check the specified number of recent responses', () => {
      const tracker = new RepetitionTracker(0.8, 3);
      const mockHistory = {
        getHistory: vi.fn(() => ['Message 1', 'Message 2', 'Message 3']),
      };

      tracker.isRepetitive('New message', mockHistory);
      expect(mockHistory.getHistory).toHaveBeenCalledWith(3);
    });

    it('should return false when history is empty', () => {
      const tracker = new RepetitionTracker(0.8, 5);
      const mockHistory = {
        getHistory: vi.fn(() => []),
      };

      const result = tracker.isRepetitive('Hello world', mockHistory);
      expect(result).toBe(false);
    });

    it('should handle messages of different lengths', () => {
      const tracker = new RepetitionTracker(0.8, 5);
      const mockHistory = {
        getHistory: vi.fn(() => ['Hi']),
      };

      const result = tracker.isRepetitive('This is a much longer message', mockHistory);
      expect(result).toBe(false);
    });
  });
});
