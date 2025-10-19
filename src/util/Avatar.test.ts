import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock the fs module
vi.mock('fs');

// We need to import Avatar after mocking fs
const { default: Avatar } = await import('./Avatar');

describe('Avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load file and convert to base64', () => {
    const mockFileContent = Buffer.from('fake image data');
    vi.mocked(fs.readFileSync).mockReturnValue(mockFileContent);

    const avatar = new Avatar('/path/to/avatar.png');

    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/avatar.png');
    expect(avatar.getBase64()).toBe(mockFileContent.toString('base64'));
  });

  it('should return null when file cannot be loaded', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('File not found');
    });

    const avatar = new Avatar('/path/to/nonexistent.png');

    expect(avatar.getBase64()).toBeNull();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error loading avatar file')
    );

    consoleLogSpy.mockRestore();
  });

  it('should handle different file paths', () => {
    const mockFileContent = Buffer.from('image data');
    vi.mocked(fs.readFileSync).mockReturnValue(mockFileContent);

    const avatar1 = new Avatar('/path1/avatar1.png');
    const avatar2 = new Avatar('/path2/avatar2.jpg');

    expect(fs.readFileSync).toHaveBeenCalledWith('/path1/avatar1.png');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path2/avatar2.jpg');
    expect(avatar1.getBase64()).toBe(mockFileContent.toString('base64'));
    expect(avatar2.getBase64()).toBe(mockFileContent.toString('base64'));
  });

  it('should handle empty file', () => {
    const emptyBuffer = Buffer.from('');
    vi.mocked(fs.readFileSync).mockReturnValue(emptyBuffer);

    const avatar = new Avatar('/path/to/empty.png');

    expect(avatar.getBase64()).toBe('');
  });

  it('should handle binary image data correctly', () => {
    // Simulate actual PNG header bytes
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    vi.mocked(fs.readFileSync).mockReturnValue(pngHeader);

    const avatar = new Avatar('/path/to/image.png');
    const base64 = avatar.getBase64();

    expect(base64).toBe(pngHeader.toString('base64'));
    expect(base64).toBeTruthy();
  });

  it('should log error message when file loading fails', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('ENOENT: no such file or directory');
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw error;
    });

    new Avatar('/nonexistent/path.png');

    expect(consoleLogSpy).toHaveBeenCalledWith(`Error loading avatar file: ${error}`);

    consoleLogSpy.mockRestore();
  });

  it('should handle permission errors gracefully', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const avatar = new Avatar('/protected/file.png');

    expect(avatar.getBase64()).toBeNull();
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
