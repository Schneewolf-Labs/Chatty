import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MessageManager from './MessageManager';
import ChatMessage from './ChatMessage';

// Mock logger
vi.mock('../../util/Logger', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

// Mock fetch
global.fetch = vi.fn();

describe('MessageManager', () => {
    let messageManager: MessageManager;
    let mockChatChannel: any;
    let mockOptions: any;
    let mockDrawManager: any;
    let mockVoiceService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        mockOptions = {
            'block-while-processing-attachments': false,
            'response-interval': 1000,
            'wake-words': ['bot', 'chatty'],
            'prune-history': false,
            'chat-history-length': 10,
            'chat-max-batch-size': 5,
            'include-responses-in-history': true,
            'selective-responses': false,
            'require-wake-word': false,
            'base-response-chance': 0.1,
            'max-response-chance': 0.9
        };

        mockChatChannel = {
            sendResponse: vi.fn(),
            enqueueResponse: vi.fn().mockReturnValue(1),
            updateLastResponseID: vi.fn(),
            addEventToHistory: vi.fn(),
            getResponse: vi.fn().mockReturnValue(null),
            lastResponseTime: Date.now(),
            responseHandler: {
                persona: {
                    name: 'TestBot'
                }
            }
        };

        messageManager = new MessageManager(mockOptions, mockChatChannel);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should initialize with provided options and chat channel', () => {
            expect(messageManager).toBeDefined();
            expect(messageManager['options']).toEqual(mockOptions);
            expect(messageManager['chatChannel']).toEqual(mockChatChannel);
        });

        it('should initialize with empty chat history', () => {
            expect(messageManager['chatHistory']).toEqual([]);
        });

        it('should initialize with empty message queue', () => {
            expect(messageManager['messageQueue']).toEqual([]);
        });

        it('should set blockOnProcessing from options', () => {
            expect(messageManager['blockOnProcessing']).toBe(false);
        });

        it('should setup interval for responding to message queue', () => {
            const spy = vi.spyOn(messageManager, 'respondToChatFromMessageQueue');
            vi.advanceTimersByTime(1000);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('receiveMessage', () => {
        it('should add message to chat history', () => {
            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            expect(messageManager['chatHistory']).toContain(message);
        });

        it('should add message to message queue', () => {
            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            expect(messageManager['messageQueue']).toContain(0);
        });

        it('should mark message as directReply when wake word is present', () => {
            const message = new ChatMessage('user', 'Hey bot, how are you?');
            messageManager.receiveMessage(message);
            expect(message.directReply).toBe(true);
        });

        it('should not mark message as directReply when no wake word is present', () => {
            const message = new ChatMessage('user', 'Hello world');
            messageManager.receiveMessage(message);
            expect(message.directReply).toBe(false);
        });

        it('should be case insensitive for wake words', () => {
            const message = new ChatMessage('user', 'Hey BOT, how are you?');
            messageManager.receiveMessage(message);
            expect(message.directReply).toBe(true);
        });

        it('should immediately respond when wake word is present', () => {
            const spy = vi.spyOn(messageManager, 'respondToChatFromMessageQueue');
            const message = new ChatMessage('user', 'Hey bot, how are you?');
            messageManager.receiveMessage(message);
            expect(spy).toHaveBeenCalled();
        });

        it('should not process empty messages', () => {
            const message = new ChatMessage('user', '');
            messageManager.receiveMessage(message);
            expect(messageManager['messageQueue'].length).toBe(0);
        });

        it('should handle image attachments when draw manager is set', async () => {
            vi.useRealTimers(); // Use real timers for async operations
            mockDrawManager = {
                extractPrompt: vi.fn().mockReturnValue(null),
                draw: vi.fn(),
                caption: vi.fn(),
                settings: {},
                on: vi.fn()
            };
            messageManager.setDrawManager(mockDrawManager);

            const mockArrayBuffer = new ArrayBuffer(8);
            (global.fetch as any).mockResolvedValue({
                ok: true,
                arrayBuffer: () => Promise.resolve(mockArrayBuffer)
            });

            const message = new ChatMessage('user', 'Check this out');
            message.attachments.push({
                url: 'https://example.com/image.jpg',
                processing: false
            } as any);

            messageManager.receiveMessage(message);

            // Wait for promise to resolve
            await Promise.resolve();
            await Promise.resolve();

            expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg');

            vi.useFakeTimers(); // Restore fake timers for other tests
        });

        it('should extract drawing prompt when draw manager is set', () => {
            mockDrawManager = {
                extractPrompt: vi.fn().mockReturnValue('a beautiful sunset'),
                draw: vi.fn().mockReturnValue(true),
                caption: vi.fn(),
                settings: {},
                on: vi.fn()
            };
            messageManager.setDrawManager(mockDrawManager);

            const message = new ChatMessage('user', 'draw a beautiful sunset');
            messageManager.receiveMessage(message);

            expect(mockDrawManager.extractPrompt).toHaveBeenCalledWith('draw a beautiful sunset');
            expect(mockDrawManager.draw).toHaveBeenCalledWith('a beautiful sunset', null);
        });

        it('should send rejected response when drawing is not enqueued', () => {
            mockDrawManager = {
                extractPrompt: vi.fn().mockReturnValue('inappropriate content'),
                draw: vi.fn().mockReturnValue(false),
                caption: vi.fn(),
                settings: {
                    rejected_response: 'Cannot draw that'
                },
                on: vi.fn()
            };
            messageManager.setDrawManager(mockDrawManager);

            const message = new ChatMessage('user', 'draw inappropriate content');
            message.channel = 'test-channel';
            messageManager.receiveMessage(message);

            expect(mockChatChannel.sendResponse).toHaveBeenCalledWith('Cannot draw that', 'test-channel');
        });
    });

    describe('respondToChatFromMessageQueue', () => {
        it('should not respond when queue is empty', () => {
            messageManager.respondToChatFromMessageQueue();
            expect(mockChatChannel.enqueueResponse).not.toHaveBeenCalled();
        });

        it('should not respond when voice service is blocking', () => {
            mockVoiceService = {
                isBlocking: vi.fn().mockReturnValue(true)
            };
            messageManager.setVoiceService(mockVoiceService);

            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            messageManager['messageQueue'] = [0]; // Manually set queue

            messageManager.respondToChatFromMessageQueue();
            expect(mockChatChannel.enqueueResponse).not.toHaveBeenCalled();
        });

        it('should respond when selective responses is disabled', () => {
            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            messageManager.respondToChatFromMessageQueue();

            expect(mockChatChannel.enqueueResponse).toHaveBeenCalled();
        });

        it('should respond when directly mentioned', () => {
            mockOptions['selective-responses'] = true;
            const message = new ChatMessage('user', 'Hey bot');
            message.directReply = true;
            messageManager.receiveMessage(message);
            messageManager.respondToChatFromMessageQueue();

            expect(mockChatChannel.enqueueResponse).toHaveBeenCalled();
        });

        it('should update last response ID after responding', () => {
            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            messageManager.respondToChatFromMessageQueue();

            expect(mockChatChannel.updateLastResponseID).toHaveBeenCalled();
        });

        it('should dequeue messages after responding', () => {
            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            expect(messageManager['messageQueue'].length).toBe(1);

            messageManager.respondToChatFromMessageQueue();
            expect(messageManager['messageQueue'].length).toBe(0);
        });

        it('should include chat history in response', () => {
            const message1 = new ChatMessage('user', 'First message');
            const message2 = new ChatMessage('user', 'Second message');

            messageManager.receiveMessage(message1);
            messageManager['messageQueue'] = []; // Clear queue
            messageManager.receiveMessage(message2);

            messageManager.respondToChatFromMessageQueue();

            const callArgs = mockChatChannel.enqueueResponse.mock.calls[0];
            expect(callArgs[1]).toBeDefined(); // history array
            expect(callArgs[1].length).toBeGreaterThan(0);
        });

        it('should not respond if require-wake-word is true and no wake word present', () => {
            mockOptions['require-wake-word'] = true;
            const message = new ChatMessage('user', 'Hello');
            messageManager.receiveMessage(message);
            messageManager.respondToChatFromMessageQueue();

            expect(mockChatChannel.enqueueResponse).not.toHaveBeenCalled();
        });

        it('should block on processing attachments when enabled', () => {
            mockOptions['block-while-processing-attachments'] = true;
            messageManager = new MessageManager(mockOptions, mockChatChannel);

            const message = new ChatMessage('user', 'Hello');
            message.attachments.push({
                url: 'https://example.com/image.jpg',
                processing: true
            } as any);

            messageManager.receiveMessage(message);
            messageManager.respondToChatFromMessageQueue();

            expect(mockChatChannel.enqueueResponse).not.toHaveBeenCalled();
        });
    });

    describe('setDrawManager', () => {
        it('should set draw manager', () => {
            mockDrawManager = {
                extractPrompt: vi.fn(),
                draw: vi.fn(),
                caption: vi.fn(),
                settings: {},
                on: vi.fn()
            };
            messageManager.setDrawManager(mockDrawManager);
            expect(messageManager['drawManager']).toBe(mockDrawManager);
        });

        it('should register event listeners on draw manager', () => {
            mockDrawManager = {
                extractPrompt: vi.fn(),
                draw: vi.fn(),
                caption: vi.fn(),
                settings: {},
                on: vi.fn()
            };
            messageManager.setDrawManager(mockDrawManager);

            expect(mockDrawManager.on).toHaveBeenCalledWith('prompt', expect.any(Function));
            expect(mockDrawManager.on).toHaveBeenCalledWith('image', expect.any(Function));
            expect(mockDrawManager.on).toHaveBeenCalledWith('caption', expect.any(Function));
        });

        it('should handle null draw manager', () => {
            messageManager.setDrawManager(null);
            expect(messageManager['drawManager']).toBe(null);
        });
    });

    describe('setVoiceService', () => {
        it('should set voice service', () => {
            mockVoiceService = {
                isBlocking: vi.fn()
            };
            messageManager.setVoiceService(mockVoiceService);
            expect(messageManager['voiceService']).toBe(mockVoiceService);
        });
    });

    describe('pruneHistory', () => {
        it('should not prune when history is below max length', () => {
            for (let i = 0; i < 5; i++) {
                const message = new ChatMessage('user', `Message ${i}`);
                messageManager.receiveMessage(message);
            }

            const historyLength = messageManager['chatHistory'].length;
            messageManager.pruneHistory();
            expect(messageManager['chatHistory'].length).toBe(historyLength);
        });

        it('should prune when history exceeds max length', () => {
            mockOptions['chat-history-length'] = 5;
            messageManager = new MessageManager(mockOptions, mockChatChannel);

            for (let i = 0; i < 10; i++) {
                const message = new ChatMessage('user', `Message ${i}`);
                messageManager['chatHistory'].push(message);
            }

            messageManager.pruneHistory();

            // With 10 items and maxLength 5, it deletes items at indices 4, 3, 2, 1 (not 0 due to i > 0)
            // historyLength - maxLength - 1 = 10 - 5 - 1 = 4
            expect(messageManager['chatHistory'][1]).toBeUndefined();
            expect(messageManager['chatHistory'][4]).toBeUndefined();
            expect(messageManager['chatHistory'][0]).toBeDefined(); // index 0 is not pruned (i > 0 condition)
            expect(messageManager['chatHistory'][5]).toBeDefined(); // indices >= 5 are kept
            expect(messageManager['chatHistory'][9]).toBeDefined();
        });
    });

    describe('_calculateResponseChance', () => {
        it('should calculate response chance based on elapsed time', () => {
            const currentTime = Date.now();
            mockChatChannel.lastResponseTime = currentTime - 10000; // 10 seconds ago

            const chance = messageManager['_calculateResponseChance']();
            expect(chance).toBeGreaterThanOrEqual(0);
            expect(chance).toBeLessThanOrEqual(1);
        });

        it('should return higher chance for longer elapsed time', () => {
            const currentTime = Date.now();

            mockChatChannel.lastResponseTime = currentTime - 1000;
            const chance1 = messageManager['_calculateResponseChance']();

            mockChatChannel.lastResponseTime = currentTime - 100000;
            const chance2 = messageManager['_calculateResponseChance']();

            expect(chance2).toBeGreaterThan(chance1);
        });

        it('should not exceed max response chance', () => {
            mockChatChannel.lastResponseTime = Date.now() - 1000000; // Very long time ago
            const chance = messageManager['_calculateResponseChance']();
            expect(chance).toBeLessThanOrEqual(1.0);
        });

        it('should not go below 0', () => {
            mockChatChannel.lastResponseTime = Date.now();
            const chance = messageManager['_calculateResponseChance']();
            expect(chance).toBeGreaterThanOrEqual(0.0);
        });
    });

    describe('integration scenarios', () => {
        it('should handle multiple messages in batch', () => {
            const message1 = new ChatMessage('user1', 'Hello');
            const message2 = new ChatMessage('user2', 'Hi there');
            const message3 = new ChatMessage('user3', 'Good morning');

            messageManager.receiveMessage(message1);
            messageManager.receiveMessage(message2);
            messageManager.receiveMessage(message3);

            messageManager.respondToChatFromMessageQueue();

            const callArgs = mockChatChannel.enqueueResponse.mock.calls[0];
            expect(callArgs[0].length).toBeGreaterThan(0);
        });

        it('should handle wake word triggering immediate response', () => {
            const spy = vi.spyOn(messageManager, 'respondToChatFromMessageQueue');
            const message = new ChatMessage('user', 'Hey chatty, tell me a joke');

            messageManager.receiveMessage(message);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(message.directReply).toBe(true);
        });

        it('should respect response interval', () => {
            const spy = vi.spyOn(messageManager, 'respondToChatFromMessageQueue');

            vi.advanceTimersByTime(500);
            expect(spy).toHaveBeenCalledTimes(0);

            vi.advanceTimersByTime(500);
            expect(spy).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(1000);
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });
});
