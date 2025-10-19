import { describe, it, expect, beforeEach, vi } from 'vitest';
import ResponseStreamer from './ResponseStreamer';

// Mock logger
vi.mock('../../util/Logger', () => ({
    default: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('ResponseStreamer', () => {
    let responseStreamer: ResponseStreamer;
    let mockOptions: any;
    let mockResponseHandler: any;
    let mockOoba: any;
    let messageHandler: (message: string) => void;
    let tokenHandler: (token: string) => void;

    beforeEach(() => {
        vi.clearAllMocks();

        mockOptions = {
            messages: {
                'chat-delimiter': '---',
                'chat-prefix': 'User:',
                'illegal-response-tokens': ['ILLEGAL', 'BAD'],
                'chunk-delimiters': ['.', '!', '?', '\n']
            }
        };

        mockResponseHandler = {};

        mockOoba = {
            on: vi.fn((event: string, handler: any) => {
                if (event === 'message') messageHandler = handler;
                if (event === 'token') tokenHandler = handler;
            }),
            stop: vi.fn()
        };

        responseStreamer = new ResponseStreamer(mockOptions, mockResponseHandler, mockOoba);
    });

    describe('constructor', () => {
        it('should initialize with provided options, handler, and ooba client', () => {
            expect(responseStreamer).toBeDefined();
            expect(responseStreamer['options']).toEqual(mockOptions);
            expect(responseStreamer['responseHandler']).toEqual(mockResponseHandler);
            expect(responseStreamer['ooba']).toEqual(mockOoba);
        });

        it('should register message event handler on ooba client', () => {
            expect(mockOoba.on).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('should register token event handler on ooba client', () => {
            expect(mockOoba.on).toHaveBeenCalledWith('token', expect.any(Function));
        });

        it('should initialize with empty tokens array', () => {
            expect(responseStreamer['tokens']).toEqual([]);
        });

        it('should initialize with null enclosure state', () => {
            expect(responseStreamer['enclosureState']).toBeNull();
        });

        it('should initialize with abortStream as false', () => {
            expect(responseStreamer['abortStream']).toBe(false);
        });

        it('should set delimiter from options', () => {
            expect(responseStreamer['chatDelimiter']).toBe('---');
        });

        it('should set prefix from options', () => {
            expect(responseStreamer['chatPrefix']).toBe('User:');
        });

        it('should set illegal tokens from options', () => {
            expect(responseStreamer['illegalTokens']).toEqual(['ILLEGAL', 'BAD']);
        });
    });

    describe('ooba event handlers', () => {
        it('should emit chunk when message event is received', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['tokens'] = ['Hello', ' ', 'world'];

            messageHandler('complete message');

            expect(spy).toHaveBeenCalled();
        });

        it('should reset abort flag when message event is received', () => {
            responseStreamer['abortStream'] = true;

            messageHandler('complete message');

            expect(responseStreamer['abortStream']).toBe(false);
        });

        it('should call receiveToken when token event is received', () => {
            const spy = vi.spyOn(responseStreamer, 'receiveToken');

            tokenHandler('token');

            expect(spy).toHaveBeenCalledWith('token');
        });

        it('should not process token when abortStream is true', () => {
            const pushSpy = vi.spyOn(responseStreamer, 'pushToken');
            responseStreamer['abortStream'] = true;

            tokenHandler('token');

            // Token handler checks abortStream and returns early, so pushToken is not called
            expect(pushSpy).not.toHaveBeenCalled();
        });

        it('should not process empty token', () => {
            const pushSpy = vi.spyOn(responseStreamer, 'pushToken');

            tokenHandler('');

            expect(pushSpy).not.toHaveBeenCalled();
        });
    });

    describe('receiveToken', () => {
        it('should push token when it is legal', () => {
            responseStreamer.receiveToken('hello');

            expect(responseStreamer['tokens']).toContain('hello');
        });

        it('should split token containing illegal token', () => {
            const chunkSpy = vi.fn();
            responseStreamer.on('chunk', chunkSpy);

            responseStreamer.receiveToken('helloILLEGAL');

            // abort() is called which emits chunk and clears tokens
            // So we check the emitted chunk instead
            expect(chunkSpy).toHaveBeenCalled();
            expect(chunkSpy.mock.calls[0][0]).toBe('hello');
        });

        it('should abort when illegal token is found', () => {
            const spy = vi.spyOn(responseStreamer, 'abort');

            responseStreamer.receiveToken('helloILLEGAL');

            expect(spy).toHaveBeenCalled();
        });

        it('should split token containing delimiter', () => {
            const chunkSpy = vi.fn();
            responseStreamer.on('chunk', chunkSpy);

            responseStreamer.receiveToken('hello---world');

            // abort() is called which emits chunk and clears tokens
            expect(chunkSpy).toHaveBeenCalled();
            expect(chunkSpy.mock.calls[0][0]).toBe('hello');
        });

        it('should abort when delimiter is found', () => {
            const spy = vi.spyOn(responseStreamer, 'abort');

            responseStreamer.receiveToken('hello---');

            expect(spy).toHaveBeenCalled();
        });

        it('should process tokens after pushing', () => {
            const spy = vi.spyOn(responseStreamer, 'processTokens');

            responseStreamer.receiveToken('hello');

            expect(spy).toHaveBeenCalled();
        });

        it('should handle token with chat prefix', () => {
            const spy = vi.spyOn(responseStreamer, 'abort');

            responseStreamer.receiveToken('helloUser:');

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('getIllegalTokenIndex', () => {
        it('should return -1 when no illegal token is present', () => {
            const index = responseStreamer['getIllegalTokenIndex']('hello world');

            expect(index).toBe(-1);
        });

        it('should return index of first illegal token', () => {
            const index = responseStreamer['getIllegalTokenIndex']('helloILLEGAL');

            expect(index).toBe(5);
        });

        it('should return smallest index when multiple illegal tokens present', () => {
            const index = responseStreamer['getIllegalTokenIndex']('BADhelloILLEGAL');

            expect(index).toBe(0);
        });

        it('should handle token starting with illegal token', () => {
            const index = responseStreamer['getIllegalTokenIndex']('ILLEGALstart');

            expect(index).toBe(0);
        });
    });

    describe('isTokenLegal', () => {
        it('should return true for legal token', () => {
            const isLegal = responseStreamer.isTokenLegal('hello');

            expect(isLegal).toBe(true);
        });

        it('should return false for token containing illegal token', () => {
            const isLegal = responseStreamer.isTokenLegal('helloILLEGAL');

            expect(isLegal).toBe(false);
        });

        it('should return false for token that is illegal token', () => {
            const isLegal = responseStreamer.isTokenLegal('ILLEGAL');

            expect(isLegal).toBe(false);
        });
    });

    describe('getDelimiterIndex', () => {
        it('should return -1 when no delimiter is present', () => {
            const index = responseStreamer['getDelimiterIndex']('hello world');

            expect(index).toBe(-1);
        });

        it('should return index of chat delimiter', () => {
            const index = responseStreamer['getDelimiterIndex']('hello---world');

            expect(index).toBe(5);
        });

        it('should return index of chat prefix', () => {
            const index = responseStreamer['getDelimiterIndex']('helloUser:world');

            expect(index).toBe(5);
        });

        it('should return smallest index when both delimiter and prefix present', () => {
            const index = responseStreamer['getDelimiterIndex']('User:hello---');

            expect(index).toBe(0);
        });
    });

    describe('pushToken', () => {
        it('should add token to tokens array', () => {
            responseStreamer.pushToken('hello');

            expect(responseStreamer['tokens']).toContain('hello');
        });

        it('should emit token event', () => {
            const spy = vi.fn();
            responseStreamer.on('token', spy);

            responseStreamer.pushToken('hello');

            expect(spy).toHaveBeenCalledWith('hello');
        });
    });

    describe('processTokens', () => {
        it('should not emit chunk when token is part of numbered list', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['tokens'] = ['1', '.'];

            responseStreamer.processTokens();

            expect(spy).not.toHaveBeenCalled();
        });

        it('should emit chunk when token contains punctuation', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['tokens'] = ['hello', '.'];

            responseStreamer.processTokens();

            expect(spy).toHaveBeenCalled();
        });

        it('should track opening enclosure', () => {
            responseStreamer['tokens'] = ['{'];
            responseStreamer.processTokens();

            expect(responseStreamer['enclosureState']).toBe('{');
        });

        it('should not emit chunk when inside enclosure', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['enclosureState'] = '{';
            responseStreamer['tokens'] = ['hello', '.'];

            responseStreamer.processTokens();

            expect(spy).not.toHaveBeenCalled();
        });

        it('should emit chunk and clear enclosure state when closing enclosure', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['enclosureState'] = '{';
            responseStreamer['tokens'] = ['hello', '}'];

            responseStreamer.processTokens();

            expect(spy).toHaveBeenCalled();
            expect(responseStreamer['enclosureState']).toBeNull();
        });

        it('should handle mismatched enclosures', () => {
            responseStreamer['enclosureState'] = '{';
            responseStreamer['tokens'] = ['hello', ']'];

            responseStreamer.processTokens();

            expect(responseStreamer['enclosureState']).toBe('{');
        });

        it('should split token with space after punctuation', () => {
            const spy = vi.spyOn(responseStreamer, 'receiveToken');
            responseStreamer['tokens'] = ['hello', '. '];

            responseStreamer.processTokens();

            expect(spy).toHaveBeenCalledWith('');
        });
    });

    describe('emitChunk', () => {
        it('should join tokens and emit chunk event', () => {
            const spy = vi.fn();
            responseStreamer.on('chunk', spy);
            responseStreamer['tokens'] = ['hello', ' ', 'world'];

            responseStreamer.emitChunk();

            expect(spy).toHaveBeenCalledWith('hello world');
        });

        it('should not emit empty chunk', () => {
            const spy = vi.fn();
            responseStreamer.on('chunk', spy);
            responseStreamer['tokens'] = [];

            responseStreamer.emitChunk();

            expect(spy).not.toHaveBeenCalled();
        });

        it('should clear tokens after emitting', () => {
            responseStreamer['tokens'] = ['hello'];

            responseStreamer.emitChunk();

            expect(responseStreamer['tokens']).toEqual([]);
        });

        it('should split chunk containing delimiter', () => {
            const spy = vi.fn();
            responseStreamer.on('chunk', spy);
            responseStreamer['tokens'] = ['hello', '---', 'world'];

            responseStreamer.emitChunk();

            expect(spy).toHaveBeenCalledWith('hello');
        });

        it('should clear enclosure state after emitting', () => {
            responseStreamer['enclosureState'] = '{';
            responseStreamer['tokens'] = ['hello'];

            responseStreamer.emitChunk();

            expect(responseStreamer['enclosureState']).toBeNull();
        });
    });

    describe('clear', () => {
        it('should clear tokens array', () => {
            responseStreamer['tokens'] = ['hello', 'world'];

            responseStreamer.clear();

            expect(responseStreamer['tokens']).toEqual([]);
        });

        it('should clear enclosure state', () => {
            responseStreamer['enclosureState'] = '{';

            responseStreamer.clear();

            expect(responseStreamer['enclosureState']).toBeNull();
        });
    });

    describe('abort', () => {
        it('should emit chunk by default', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['tokens'] = ['hello'];

            responseStreamer.abort();

            expect(spy).toHaveBeenCalled();
        });

        it('should not emit chunk when emit is false', () => {
            const spy = vi.spyOn(responseStreamer, 'emitChunk');
            responseStreamer['tokens'] = ['hello'];

            responseStreamer.abort(false);

            expect(spy).not.toHaveBeenCalled();
        });

        it('should set abortStream flag', () => {
            responseStreamer.abort();

            expect(responseStreamer['abortStream']).toBe(true);
        });

        it('should stop ooba client', () => {
            responseStreamer.abort();

            expect(mockOoba.stop).toHaveBeenCalled();
        });

        it('should clear tokens', () => {
            responseStreamer['tokens'] = ['hello'];

            responseStreamer.abort();

            expect(responseStreamer['tokens']).toEqual([]);
        });
    });

    describe('integration scenarios', () => {
        it('should handle streaming multiple tokens and emit chunks', () => {
            const chunks: string[] = [];
            responseStreamer.on('chunk', (chunk) => chunks.push(chunk));

            tokenHandler('Hello');
            tokenHandler(' ');
            tokenHandler('world');
            tokenHandler('.');

            expect(chunks.length).toBeGreaterThan(0);
        });

        it('should handle token stream with illegal token', () => {
            const chunks: string[] = [];
            responseStreamer.on('chunk', (chunk) => chunks.push(chunk));

            tokenHandler('Hello');
            tokenHandler(' ');
            tokenHandler('worldILLEGAL');

            expect(mockOoba.stop).toHaveBeenCalled();
        });

        it('should handle enclosures correctly', () => {
            const chunks: string[] = [];
            responseStreamer.on('chunk', (chunk) => chunks.push(chunk));

            tokenHandler('{');
            tokenHandler('key');
            tokenHandler(':');
            tokenHandler(' ');
            tokenHandler('value');
            tokenHandler('}');

            // Chunk should only be emitted after closing brace
            expect(chunks.length).toBe(1);
            expect(chunks[0]).toBe('{key: value}');
        });

        it('should handle complete message cycle', () => {
            const chunks: string[] = [];
            responseStreamer.on('chunk', (chunk) => chunks.push(chunk));

            tokenHandler('Hello');
            tokenHandler(' ');
            tokenHandler('world');
            tokenHandler('.');
            messageHandler('complete');

            expect(chunks.length).toBeGreaterThan(0);
            expect(responseStreamer['abortStream']).toBe(false);
        });

        it('should handle delimiter in middle of stream', () => {
            const chunks: string[] = [];
            responseStreamer.on('chunk', (chunk) => chunks.push(chunk));

            tokenHandler('Hello');
            tokenHandler(' ');
            tokenHandler('world---stop');

            expect(mockOoba.stop).toHaveBeenCalled();
            expect(chunks[chunks.length - 1]).not.toContain('---');
        });

        it('should emit tokens individually', () => {
            const tokens: string[] = [];
            responseStreamer.on('token', (token) => tokens.push(token));

            tokenHandler('Hello');
            tokenHandler(' ');
            tokenHandler('world');

            expect(tokens).toEqual(['Hello', ' ', 'world']);
        });
    });
});
