import logger from '../../util/Logger';
import * as badwords from 'bad-words';
import * as Sentiment from 'sentiment';

interface MessageSanitizerOptions {
    'reject-profanity': boolean;
    'profanity-replacement': string;
    'reject-negativity': boolean;
    'sentiment-threshold': number;
    'remove-actions': boolean;
    [key: string]: any;
}

interface Persona {
    name: string;
}

interface ProfanityFilter {
    isProfane(text: string): boolean;
}

interface SentimentAnalyzer {
    analyze(text: string): { score: number };
}

class MessageSanitizer {
    private options: MessageSanitizerOptions;
    private persona: Persona;
    private chatDelimiter: string;
    private speechBuffer?: string;
    private filter: ProfanityFilter;
    private sentiment: SentimentAnalyzer;

    constructor(
        options: MessageSanitizerOptions,
        persona: Persona,
        chatDelimiter: string,
        profanityFilter?: ProfanityFilter,
        sentimentAnalyzer?: SentimentAnalyzer
    ) {
        this.options = options;
        this.persona = persona;
        this.chatDelimiter = chatDelimiter;
        this.filter = profanityFilter || new badwords();
        this.sentiment = sentimentAnalyzer || new Sentiment();
    }

    shouldReject(message: string): boolean {
        // Check for profanity
        if (this.options['reject-profanity'] && this.filter.isProfane(message)) {
            logger.debug(`got profrane message`);
            const replacement = this.options['profanity-replacement'];
            this.speechBuffer = replacement;
            return true;
        }
        // Check for negativity
        if (this.options['reject-negativity']) {
            const score = this.sentiment.analyze(message).score;
            const threshold = this.options['sentiment-threshold'];
            logger.debug(`sentiment score: ${score}`);
            if (score < threshold) {
                logger.debug(`rejected negative (${score}) message`);
                return true;
            }
        }
        return false;
    }

    sanitize(message: string): string {
        // Strip persona name chat prefix
        message = message.replace(this.persona.name+":", '');
        // Strip any mentions from the message
        message = message.replace(/@[\S]+/g, '');
        // Strip any URLs from the message
        message = message.replace(/(?:https?|ftp):\/\/[^\s]+/g, '');
        // Strip things contained in [] brackets
        message = message.replace(/\[.*?\]/g, '');
        // Remove actions in *'s
        if (this.options['remove-actions']) message = message.replace(/\*.*?\*/g, '');

        return message;
    }

    trimResponse(message: string): string {
        // End response before first \"
        const end = message.indexOf(this.chatDelimiter);
        if (end > 0) message = message.substring(0, end);
        // Strip any trailing whitespace
        message = message.trim();
        // If there is http(s) strip it and everything after
        const httpIdx = message.indexOf('http');
        if (httpIdx > -1) {
            message = message.substring(0, httpIdx);
            console.warn(`Stripped http(s) from response: ${message}`);
        }
        return message;
    }
}

export default MessageSanitizer;