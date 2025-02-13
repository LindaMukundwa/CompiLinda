import { Token, TokenType, LexerLog } from './types';

export class Lexer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private logs: LexerLog[] = [];
    private errors: number = 0;

    constructor(input: string) {
        this.input = input;
        this.addLog('INFO', `Lexer - Lexing program 1..`);
    }

    private currentChar(): string {
        return this.input[this.position] || '';
    }

    private advance(): void {
        if (this.currentChar() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
    }

    private addLog(level: 'INFO' | 'DEBUG', message: string): void {
        this.logs.push({ level, message });
    }

    private logToken(type: TokenType, value: string, line: number, column: number): void {
        let tokenName = type.toString();
        this.addLog('DEBUG', `Lexer - ${tokenName} [ ${value} ] found at (${line}:${column})`);
    }

    public tokenize(): { tokens: Token[], logs: LexerLog[] } {
        const tokens: Token[] = [];

        while (this.position < this.input.length) {
            const char = this.currentChar();
            const currentLine = this.line;
            const currentColumn = this.column;

            switch (char) {
                case '{':
                    tokens.push({
                        type: TokenType.OPEN_BLOCK,
                        value: char,
                        line: currentLine,
                        column: currentColumn
                    });
                    this.logToken(TokenType.OPEN_BLOCK, char, currentLine, currentColumn);
                    this.advance();
                    break;

                case '}':
                    tokens.push({
                        type: TokenType.CLOSE_BLOCK,
                        value: char,
                        line: currentLine,
                        column: currentColumn
                    });
                    this.logToken(TokenType.CLOSE_BLOCK, char, currentLine, currentColumn);
                    this.advance();
                    break;

                case '$':
                    tokens.push({
                        type: TokenType.EOP,
                        value: char,
                        line: currentLine,
                        column: currentColumn
                    });
                    this.logToken(TokenType.EOP, char, currentLine, currentColumn);
                    this.advance();
                    break;

                case ' ':
                case '\n':
                case '\t':
                case '\r':
                    this.advance();
                    break;

                default:
                    this.errors++;
                    throw new Error(`Unexpected character '${char}' at line ${currentLine}, column ${currentColumn}`);
            }
        }

        this.addLog('INFO', `Lex completed with ${this.errors} errors`);
        return { tokens, logs: this.logs };
    }
}

/* // At the bottom of src/lexer.ts
declare global {
    interface Window {
        Lexer: typeof Lexer;
    }
}
window.Lexer = Lexer; */

(window as any).Lexer = Lexer;