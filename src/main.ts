export enum TokenType {
    // Keywords
    TYPE = 'TYPE',         // int, string, boolean
    PRINT = 'PRINT',       // print
    WHILE = 'WHILE',       // while
    IF = 'IF',            // if
    BOOLEAN_VALUE = 'BOOLEAN_VALUE',  // true, false
    
    // Symbols
    LEFT_BRACE = 'LEFT_BRACE',     // {
    RIGHT_BRACE = 'RIGHT_BRACE',   // }
    LEFT_PAREN = 'LEFT_PAREN',     // (
    RIGHT_PAREN = 'RIGHT_PAREN',   // )
    EQUALS = 'EQUALS',             // =
    BOOLEAN_OP = 'BOOLEAN_OP',     // == or !=
    INT_OP = 'INT_OP',            // +
    QUOTE = 'QUOTE',              // "
    EOF = 'EOF',                  // $
    
    // Values
    IDENTIFIER = 'IDENTIFIER',    // Variables
    DIGIT = 'DIGIT',             // 0-9
    CHAR = 'CHAR',              // a-z
    SPACE = 'SPACE',            // space character
    
    // Comments
    COMMENT_START = 'COMMENT_START',  // /*
    COMMENT_END = 'COMMENT_END',      // */
    OPEN_BLOCK = "OPEN_BLOCK",
    EOP = "EOP",
    CLOSE_BLOCK = "CLOSE_BLOCK"
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

export interface LexerLog {
    level: 'INFO' | 'DEBUG';
    message: string;
}

//import { Token, TokenType, LexerLog } from './types';

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

// At the bottom of src/lexer.ts
declare global {
    interface Window {
        Lexer: typeof Lexer;
    }
}
window.Lexer = Lexer;

(window as any).Lexer = Lexer;