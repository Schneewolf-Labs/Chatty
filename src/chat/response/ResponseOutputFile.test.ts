import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import ResponseOutputFile from './ResponseOutputFile';
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

// Mock fs and logger
vi.mock('fs');
vi.mock('../../util/Logger', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('ResponseOutputFile', () => {
    let responseOutputFile: ResponseOutputFile;
    let mockConfig: any;
    const mockOutputPath = path.join(process.cwd(), 'output.txt');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        mockConfig = {
            oobabooga: {
                output_location: 'output.txt'
            },
            messages: {
                'response-expire-time': 5000
            }
        };

        responseOutputFile = new ResponseOutputFile(mockConfig);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should initialize with provided config', () => {
            expect(responseOutputFile).toBeDefined();
            expect(responseOutputFile['config']).toEqual(mockConfig);
        });

        it('should set output path from config', () => {
            expect(responseOutputFile['outputPath']).toBe(mockOutputPath);
        });

        it('should initialize with empty responses array', () => {
            expect(responseOutputFile['responses']).toEqual([]);
        });
    });

    describe('sendMessage', () => {
        it('should receive message text', () => {
            const spy = vi.spyOn(responseOutputFile, 'receiveResponse');
            const message = { text: 'Hello world', author: 'user' };

            responseOutputFile.sendMessage(message);

            expect(spy).toHaveBeenCalledWith('Hello world');
        });

        it('should add message to responses', () => {
            const message = { text: 'Hello world', author: 'user' };

            responseOutputFile.sendMessage(message);

            expect(responseOutputFile['responses']).toContain('Hello world');
        });

        it('should call updateResponseFile', () => {
            const spy = vi.spyOn(responseOutputFile, 'updateResponseFile');
            const message = { text: 'Hello world', author: 'user' };

            responseOutputFile.sendMessage(message);

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('sendImage', () => {
        it('should not throw error', () => {
            expect(() => responseOutputFile.sendImage()).not.toThrow();
        });
    });

    describe('sendTyping', () => {
        it('should not throw error', () => {
            expect(() => responseOutputFile.sendTyping()).not.toThrow();
        });
    });

    describe('receiveResponse', () => {
        it('should add response to responses array', () => {
            responseOutputFile.receiveResponse('Test response');

            expect(responseOutputFile['responses']).toContain('Test response');
        });

        it('should call updateResponseFile', () => {
            const spy = vi.spyOn(responseOutputFile, 'updateResponseFile');

            responseOutputFile.receiveResponse('Test response');

            expect(spy).toHaveBeenCalled();
        });

        it('should expire response after configured time', () => {
            responseOutputFile.receiveResponse('Test response');
            expect(responseOutputFile['responses'].length).toBe(1);

            vi.advanceTimersByTime(5000);

            expect(responseOutputFile['responses'].length).toBe(0);
        });

        it('should call updateResponseFile after expiring response', () => {
            const spy = vi.spyOn(responseOutputFile, 'updateResponseFile');
            spy.mockClear();

            responseOutputFile.receiveResponse('Test response');
            spy.mockClear();

            vi.advanceTimersByTime(5000);

            expect(spy).toHaveBeenCalled();
        });

        it('should handle multiple responses', () => {
            responseOutputFile.receiveResponse('First response');
            responseOutputFile.receiveResponse('Second response');

            expect(responseOutputFile['responses']).toEqual(['First response', 'Second response']);
        });

        it('should expire responses in order', () => {
            responseOutputFile.receiveResponse('First response');
            vi.advanceTimersByTime(1000);
            responseOutputFile.receiveResponse('Second response');

            vi.advanceTimersByTime(4000); // Total 5000ms since first response
            expect(responseOutputFile['responses']).toEqual(['Second response']);

            vi.advanceTimersByTime(1000); // Total 5000ms since second response
            expect(responseOutputFile['responses']).toEqual([]);
        });
    });

    describe('updateResponseFile', () => {
        it('should write empty string when no responses', () => {
            responseOutputFile.updateResponseFile();

            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOutputPath, '');
        });

        it('should write single response to file', () => {
            responseOutputFile.receiveResponse('Test response');

            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOutputPath, 'Test response');
        });

        it('should join multiple responses with space', () => {
            responseOutputFile.receiveResponse('First');
            responseOutputFile.receiveResponse('Second');

            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOutputPath, 'First Second');
        });

        it('should update file with remaining responses after expiration', () => {
            responseOutputFile.receiveResponse('First');
            responseOutputFile.receiveResponse('Second');

            vi.clearAllMocks();
            vi.advanceTimersByTime(5000);

            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOutputPath, 'Second');
        });
    });

    describe('integration scenarios', () => {
        it('should handle rapid message sending', () => {
            responseOutputFile.sendMessage({ text: 'Message 1', author: 'bot' });
            responseOutputFile.sendMessage({ text: 'Message 2', author: 'bot' });
            responseOutputFile.sendMessage({ text: 'Message 3', author: 'bot' });

            expect(responseOutputFile['responses'].length).toBe(3);
            expect(fs.writeFileSync).toHaveBeenLastCalledWith(mockOutputPath, 'Message 1 Message 2 Message 3');
        });

        it('should maintain correct state through expiration cycle', () => {
            responseOutputFile.sendMessage({ text: 'First', author: 'bot' });

            vi.advanceTimersByTime(2000);
            responseOutputFile.sendMessage({ text: 'Second', author: 'bot' });

            vi.advanceTimersByTime(3000); // First message expires
            expect(responseOutputFile['responses']).toEqual(['Second']);

            vi.advanceTimersByTime(2000); // Second message expires
            expect(responseOutputFile['responses']).toEqual([]);
        });

        it('should handle empty message text', () => {
            responseOutputFile.sendMessage({ text: '', author: 'bot' });

            expect(responseOutputFile['responses']).toContain('');
            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOutputPath, '');
        });

        it('should handle messages with special characters', () => {
            const specialText = 'Hello\nWorld\t!@#$%';
            responseOutputFile.sendMessage({ text: specialText, author: 'bot' });

            expect(responseOutputFile['responses']).toContain(specialText);
            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOutputPath, specialText);
        });
    });
});
