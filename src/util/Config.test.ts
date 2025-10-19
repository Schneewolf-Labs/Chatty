import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as YAML from 'yaml';

// Mock modules before importing Config
vi.mock('fs');
vi.mock('yaml');

describe('Config', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    // Clear module cache to allow re-importing with different mocks
    vi.resetModules();
  });

  it('should load config from config.yml file', async () => {
    const mockConfig = {
      output: false,
      output_dir: './output',
      persona_file: './persona.yaml',
      avatar: { enabled: true, location: './avatar.png' },
      api: { enabled: true },
      oobabooga: { output_responses: true },
      voice: { enabled: false },
      twitch: { enabled: true },
      discord: { enabled: false },
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const { default: config } = await import('./Config');

    expect(fs.readFileSync).toHaveBeenCalledWith('./config.yml', 'utf8');
    expect(YAML.parse).toHaveBeenCalledWith('yaml content');
    expect(config.output_dir).toBe('./output');
    expect(config.persona_file).toBe('./persona.yaml');
  });

  it('should create output directory if it does not exist', async () => {
    const mockConfig = {
      output: false,
      output_dir: './new_output',
      persona_file: './persona.yaml',
      avatar: { enabled: false, location: '' },
      api: { enabled: false },
      oobabooga: { output_responses: false },
      voice: { enabled: false },
      twitch: { enabled: false },
      discord: { enabled: false },
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    await import('./Config');

    expect(fs.existsSync).toHaveBeenCalledWith('./new_output');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./new_output');
  });

  it('should not create output directory if it already exists', async () => {
    const mockConfig = {
      output: false,
      output_dir: './existing_output',
      persona_file: './persona.yaml',
      avatar: { enabled: false, location: '' },
      api: { enabled: false },
      oobabooga: { output_responses: false },
      voice: { enabled: false },
      twitch: { enabled: false },
      discord: { enabled: false },
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const mkdirSyncSpy = vi.mocked(fs.mkdirSync);

    await import('./Config');

    expect(fs.existsSync).toHaveBeenCalledWith('./existing_output');
    expect(mkdirSyncSpy).not.toHaveBeenCalled();
  });

  it('should log config when output is true', async () => {
    const mockConfig = {
      output: true,
      output_dir: './output',
      persona_file: './persona.yaml',
      avatar: { enabled: false, location: '' },
      api: { enabled: false },
      oobabooga: { output_responses: false },
      voice: { enabled: false },
      twitch: { enabled: false },
      discord: { enabled: false },
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await import('./Config');

    expect(consoleLogSpy).toHaveBeenCalledWith(mockConfig);
  });

  it('should not log config when output is false', async () => {
    const mockConfig = {
      output: false,
      output_dir: './output',
      persona_file: './persona.yaml',
      avatar: { enabled: false, location: '' },
      api: { enabled: false },
      oobabooga: { output_responses: false },
      voice: { enabled: false },
      twitch: { enabled: false },
      discord: { enabled: false },
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await import('./Config');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should not log config when output is undefined', async () => {
    const mockConfig = {
      output_dir: './output',
      persona_file: './persona.yaml',
      avatar: { enabled: false, location: '' },
      api: { enabled: false },
      oobabooga: { output_responses: false },
      voice: { enabled: false },
      twitch: { enabled: false },
      discord: { enabled: false },
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await import('./Config');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should handle all config properties', async () => {
    const mockConfig = {
      output: false,
      output_dir: './test_output',
      persona_file: './test_persona.yaml',
      avatar: {
        enabled: true,
        location: './test_avatar.png',
      },
      api: {
        enabled: true,
      },
      oobabooga: {
        output_responses: true,
      },
      voice: {
        enabled: true,
      },
      twitch: {
        enabled: true,
      },
      discord: {
        enabled: true,
      },
      custom_field: 'custom_value',
    };

    vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
    vi.mocked(YAML.parse).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const { default: config } = await import('./Config');

    expect(config.avatar.enabled).toBe(true);
    expect(config.avatar.location).toBe('./test_avatar.png');
    expect(config.api.enabled).toBe(true);
    expect(config.oobabooga.output_responses).toBe(true);
    expect(config.voice.enabled).toBe(true);
    expect(config.twitch.enabled).toBe(true);
    expect(config.discord.enabled).toBe(true);
    expect(config.custom_field).toBe('custom_value');
  });
});
