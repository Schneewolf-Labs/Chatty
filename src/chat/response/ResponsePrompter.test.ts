import { describe, it, expect, beforeEach, vi } from 'vitest';
import ResponsePrompter from './ResponsePrompter';

// Mock logger
vi.mock('../../util/Logger', () => ({
    default: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('ResponsePrompter', () => {
    let responsePrompter: ResponsePrompter;
    let mockConfig: any;
    let mockPersona: any;
    let mockHandler: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockConfig = {
            messages: {
                'datetime-prompt': 'Today is {DATE} at {TIME}\n',
                'persona-prompt': 'You are {NAME}. ',
                'draw-available-prompt': 'You can draw images.\n',
                'prompt': 'System instructions.\n',
                'safety-prompt': 'Be safe.\n',
                'limitations-prompt': 'You have limitations.\n',
                'chat-history-prefix': 'Chat history:\n',
                'chat-prefix': 'User: ',
                'chat-delimiter': '---',
                'prompt-response-prefix': '{NAME}: ',
                'new-chat-prefix': 'New messages:\n',
                'max-tokens': 1000,
                'include-datetime': true,
                'chunk-delimiters': ['\n', '.', '!', '?']
            },
            stable_diffusion: {
                enabled: false
            }
        };

        mockPersona = {
            name: 'TestBot',
            directive: 'You are helpful.',
            insertName: vi.fn((msg: string) => msg.replace('{NAME}', 'TestBot'))
        };

        mockHandler = {
            config: mockConfig
        };

        responsePrompter = new ResponsePrompter(mockConfig, mockPersona, mockHandler);
    });

    describe('constructor', () => {
        it('should initialize with provided config, persona, and handler', () => {
            expect(responsePrompter).toBeDefined();
            expect(responsePrompter['config']).toEqual(mockConfig);
            expect(responsePrompter['persona']).toEqual(mockPersona);
            expect(responsePrompter['handler']).toEqual(mockHandler);
        });

        it('should initialize with empty response buffer', () => {
            expect(responsePrompter['responseBuffer']).toEqual([]);
        });

        it('should setup persona prompt with directive', () => {
            expect(responsePrompter['personaPrompt']).toContain('You are helpful.');
        });

        it('should setup persona prompt without directive if not provided', () => {
            const personaWithoutDirective = { name: 'TestBot', insertName: mockPersona.insertName };
            const prompter = new ResponsePrompter(mockConfig, personaWithoutDirective, mockHandler);
            expect(prompter['personaPrompt']).toBe(mockConfig.messages['persona-prompt'] + '\n');
        });

        it('should include draw prompt when stable diffusion is enabled', () => {
            mockHandler.config.stable_diffusion.enabled = true;
            const prompter = new ResponsePrompter(mockConfig, mockPersona, mockHandler);
            expect(prompter['drawPrompt']).toBeTruthy();
        });

        it('should not include draw prompt when stable diffusion is disabled', () => {
            expect(responsePrompter['drawPrompt']).toBe('');
        });

        it('should calculate prompt tokens', () => {
            expect(responsePrompter['promptTokens']).toBeGreaterThan(0);
        });
    });

    describe('generatePrompt', () => {
        it('should generate prompt with messages', () => {
            const messages = [
                { author: 'user1', text: 'Hello', getText: () => 'Hello' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toBeTruthy();
            expect(result.dequeuedMessages).toBe(1);
        });

        it('should include persona prompt in generated prompt', () => {
            const messages = [
                { author: 'user1', text: 'Hello', getText: () => 'Hello' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            // The persona prompt contains the directive but {NAME} is not replaced in persona-prompt
            expect(result.prompt).toContain('You are helpful.');
        });

        it('should include response prefix in generated prompt', () => {
            const messages = [
                { author: 'user1', text: 'Hello', getText: () => 'Hello' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toContain('TestBot:');
        });

        it('should include datetime when configured', () => {
            const messages = [
                { author: 'user1', text: 'Hello', getText: () => 'Hello' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toMatch(/Today is/);
        });

        it('should not include datetime when disabled', () => {
            mockConfig.messages['include-datetime'] = false;
            responsePrompter = new ResponsePrompter(mockConfig, mockPersona, mockHandler);

            const messages = [
                { author: 'user1', text: 'Hello', getText: () => 'Hello' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).not.toMatch(/Today is/);
        });

        it('should include all messages that fit within token limit', () => {
            const messages = [
                { author: 'user1', text: 'Message 1', getText: () => 'Message 1' },
                { author: 'user2', text: 'Message 2', getText: () => 'Message 2' },
                { author: 'user3', text: 'Message 3', getText: () => 'Message 3' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.dequeuedMessages).toBe(3);
            expect(result.prompt).toContain('Message 1');
            expect(result.prompt).toContain('Message 2');
            expect(result.prompt).toContain('Message 3');
        });

        it('should include history messages', () => {
            const messages = [
                { author: 'user1', text: 'New message', getText: () => 'New message' }
            ];
            const history = [
                { author: 'user2', text: 'Old message', getText: () => 'Old message' }
            ];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toContain('New message');
            expect(result.prompt).toContain('Old message');
        });

        it('should add history messages in correct order', () => {
            const messages = [
                { author: 'user1', text: 'NewMsg', getText: () => 'NewMsg' }
            ];
            const history = [
                { author: 'user2', text: 'FirstHistMsg', getText: () => 'FirstHistMsg' },
                { author: 'user3', text: 'SecondHistMsg', getText: () => 'SecondHistMsg' }
            ];

            const result = responsePrompter.generatePrompt(messages, history);

            // History is iterated from last to first, added to front, then reversed
            // So: Add SecondHist to front, Add FirstHist to front = [FirstHist, SecondHist]
            // Then reverse = [SecondHist, FirstHist], then NewMsg is added
            // Final order: SecondHist, FirstHist, NewMsg
            const firstIndex = result.prompt.indexOf('FirstHistMsg');
            const secondIndex = result.prompt.indexOf('SecondHistMsg');
            const newIndex = result.prompt.indexOf('NewMsg');

            expect(secondIndex).toBeLessThan(firstIndex);
            expect(firstIndex).toBeLessThan(newIndex);
        });

        it('should stop adding messages when token limit is reached', () => {
            mockConfig.messages['max-tokens'] = 10; // Very small limit
            responsePrompter = new ResponsePrompter(mockConfig, mockPersona, mockHandler);

            const messages = [
                { author: 'user1', text: 'Message with lots of words here', getText: () => 'Message with lots of words here' },
                { author: 'user2', text: 'Another message with many words', getText: () => 'Another message with many words' },
                { author: 'user3', text: 'Yet another long message', getText: () => 'Yet another long message' },
                { author: 'user4', text: 'More words in this message', getText: () => 'More words in this message' },
                { author: 'user5', text: 'Final message with words', getText: () => 'Final message with words' }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.dequeuedMessages).toBeLessThan(messages.length);
        });

        it('should clear response buffer after generating prompt', () => {
            const messages = [
                { author: 'user1', text: 'Hello', getText: () => 'Hello' }
            ];
            const history: any[] = [];

            responsePrompter.generatePrompt(messages, history);

            expect(responsePrompter['responseBuffer']).toEqual([]);
        });
    });

    describe('_addMessageToPrompt', () => {
        it('should add message to response buffer', () => {
            const message = { author: 'user1', text: 'Hello', getText: () => 'Hello' };

            const tokens = responsePrompter['_addMessageToPrompt'](message, 0, 1000);

            expect(tokens).toBeGreaterThan(0);
            expect(responsePrompter['responseBuffer'].length).toBe(1);
        });

        it('should add message to front when front is true', () => {
            const message1 = { author: 'user1', text: 'First', getText: () => 'First' };
            const message2 = { author: 'user2', text: 'Second', getText: () => 'Second' };

            responsePrompter['_addMessageToPrompt'](message1, 0, 1000, false);
            responsePrompter['_addMessageToPrompt'](message2, 0, 1000, true);

            expect(responsePrompter['responseBuffer'][0]).toContain('Second');
            expect(responsePrompter['responseBuffer'][1]).toContain('First');
        });

        it('should return -1 when message is null', () => {
            const tokens = responsePrompter['_addMessageToPrompt'](null as any, 0, 1000);

            expect(tokens).toBe(-1);
        });

        it('should return -1 when max tokens would be exceeded', () => {
            const message = { author: 'user1', text: 'Hello world this is a very long message with many words', getText: () => 'Hello world this is a very long message with many words' };

            const tokens = responsePrompter['_addMessageToPrompt'](message, 995, 1000);

            expect(tokens).toBe(-1);
        });

        it('should include author in formatted message', () => {
            const message = { author: 'Alice', text: 'Hello', getText: () => 'Hello' };

            responsePrompter['_addMessageToPrompt'](message, 0, 1000);

            expect(responsePrompter['responseBuffer'][0]).toContain('Alice');
        });

        it('should include chat delimiter in formatted message', () => {
            const message = { author: 'user1', text: 'Hello', getText: () => 'Hello' };

            responsePrompter['_addMessageToPrompt'](message, 0, 1000);

            expect(responsePrompter['responseBuffer'][0]).toContain('---');
        });
    });

    describe('_getTokensPerMessage', () => {
        it('should count tokens by splitting on spaces', () => {
            const tokens = responsePrompter['_getTokensPerMessage']('Hello world');

            expect(tokens).toBe(2);
        });

        it('should return 1 for single word', () => {
            const tokens = responsePrompter['_getTokensPerMessage']('Hello');

            expect(tokens).toBe(1);
        });

        it('should return 0 for empty string', () => {
            const tokens = responsePrompter['_getTokensPerMessage']('');

            expect(tokens).toBe(1); // split('') returns ['']
        });

        it('should handle multiple spaces', () => {
            const tokens = responsePrompter['_getTokensPerMessage']('Hello  world');

            expect(tokens).toBe(3); // split creates empty string between spaces
        });
    });

    describe('_replacePlaceholders', () => {
        it('should replace {DATE} with current date', () => {
            const result = responsePrompter['_replacePlaceholders']('Today is {DATE}');

            expect(result).not.toContain('{DATE}');
            expect(result).toMatch(/Today is \w+,/);
        });

        it('should replace {TIME} with current time', () => {
            const result = responsePrompter['_replacePlaceholders']('The time is {TIME}');

            expect(result).not.toContain('{TIME}');
            expect(result).toMatch(/The time is \d+:/);
        });

        it('should replace {NAME} with persona name when insertName is provided', () => {
            const result = responsePrompter['_replacePlaceholders']('Hello {NAME}');

            expect(result).toBe('Hello TestBot');
        });

        it('should replace {DELIMITER} with chat delimiter', () => {
            const result = responsePrompter['_replacePlaceholders']('End{DELIMITER}');

            expect(result).toBe('End---');
        });

        it('should replace multiple placeholders', () => {
            const result = responsePrompter['_replacePlaceholders']('Date: {DATE}, Time: {TIME}, Name: {NAME}');

            expect(result).not.toContain('{DATE}');
            expect(result).not.toContain('{TIME}');
            expect(result).not.toContain('{NAME}');
        });

        it('should handle message without placeholders', () => {
            const result = responsePrompter['_replacePlaceholders']('No placeholders here');

            expect(result).toBe('No placeholders here');
        });
    });

    describe('integration scenarios', () => {
        it('should generate complete prompt for conversation', () => {
            const messages = [
                { author: 'Alice', text: 'Hi there!', getText: () => 'Hi there!' },
                { author: 'Bob', text: 'Hello!', getText: () => 'Hello!' }
            ];
            const history = [
                { author: 'Alice', text: 'How are you?', getText: () => 'How are you?' }
            ];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toContain('Alice');
            expect(result.prompt).toContain('Bob');
            expect(result.prompt).toContain('Hi there!');
            expect(result.prompt).toContain('Hello!');
            expect(result.prompt).toContain('How are you?');
            expect(result.dequeuedMessages).toBe(2);
        });

        it('should handle empty messages and history', () => {
            const messages: any[] = [];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toBeTruthy();
            expect(result.dequeuedMessages).toBe(0);
        });

        it('should handle very long messages', () => {
            const longText = 'word '.repeat(100);
            const messages = [
                { author: 'user1', text: longText, getText: () => longText }
            ];
            const history: any[] = [];

            const result = responsePrompter.generatePrompt(messages, history);

            expect(result.prompt).toBeTruthy();
        });

        it('should maintain state across multiple prompt generations', () => {
            const messages1 = [
                { author: 'user1', text: 'First batch', getText: () => 'First batch' }
            ];
            const messages2 = [
                { author: 'user2', text: 'Second batch', getText: () => 'Second batch' }
            ];

            const result1 = responsePrompter.generatePrompt(messages1, []);
            const result2 = responsePrompter.generatePrompt(messages2, []);

            expect(result1.prompt).toContain('First batch');
            expect(result1.prompt).not.toContain('Second batch');
            expect(result2.prompt).toContain('Second batch');
            expect(result2.prompt).not.toContain('First batch');
        });
    });
});
