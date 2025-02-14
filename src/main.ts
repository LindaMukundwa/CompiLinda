export enum TokenType {
    // Keywords
    I_TYPE = 'I_TYPE',       // int
    S_TYPE = 'S_TYPE',       // string
    B_TYPE = 'B_TYPE',       // boolean
    PRINT = 'PRINT',       // print
    WHILE = 'WHILE',       // while
    IF = 'IF',            // if
    ELSE = 'ELSE',        // else
    BOOLEAN_VALUE = 'BOOLEAN_VALUE',  // true, false
    
    // Symbols
    LEFT_BRACE = 'LEFT_BRACE',     // {
    RIGHT_BRACE = 'RIGHT_BRACE',   // }
    LEFT_PAREN = 'LEFT_PAREN',     // (
    RIGHT_PAREN = 'RIGHT_PAREN',   // )
    ASSIGN = 'ASSIGN',             // =
    EQUALS = 'EQUALS',             // == 
    NOT_EQUALS = 'NOT_EQUALS',     // !=
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
    level: 'INFO' | 'DEBUG' | 'ERROR';
    message: string;
}

//import { Token, TokenType, LexerLog } from './types';

export interface LexerLog {
    level: 'INFO' | 'DEBUG' | 'ERROR';
    message: string;
}

export class Lexer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private logs: LexerLog[] = [];
    private errors: number = 0;
    private programCounter: number = 1;
    private inPrintStatement: boolean = false;

    constructor(input: string) {
        this.input = input;
        this.addLog('INFO', `Lexer - Lexing program ${this.programCounter}..`);
    }

    private currentChar(): string {
        return this.input[this.position] || '';
    }

    private peek(offset: number = 1): string {
        return this.input[this.position + offset] || '';
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

    private skipComment(): void {
        while (this.position < this.input.length) {
            if (this.currentChar() === '*' && this.peek() === '/') {
                this.advance(); // skip *
                this.advance(); // skip /
                return;
            }
            this.advance();
        }
    }

    private isLetter(char: string): boolean {
        return /[a-zA-Z]/.test(char);
    }

    private readIdentifier(): string {
        let result = '';
        while (this.position < this.input.length && this.isLetter(this.currentChar())) {
            result += this.currentChar();
            this.advance();
        }
        return result;
    }

    private addLog(level: 'INFO' | 'DEBUG' | 'ERROR', message: string): void {
        this.logs.push({ level, message });
    }

    private logToken(type: TokenType, value: string, line: number, column: number): void {
        let tokenName = type.toString();
        this.addLog('DEBUG', `Lexer - ${tokenName} [ ${value} ] found at (${line}:${column})`);
    }

    private handleError(char: string, line: number, column: number): void {
        this.errors++;
        this.addLog('ERROR', `Lexer - Error:${line}:${column} Unrecognized Token: ${char})`);
        this.advance();
    }

    private readPrintKeyword(): Token | null {
        const startColumn = this.column;
        let word = '';
        
        // Read potential 'print' keyword
        while (this.isLetter(this.currentChar())) {
            word += this.currentChar();
            this.advance();
        }

        if (word.toLowerCase() === 'print') {
            return {
                type: TokenType.PRINT,
                value: word,
                line: this.line,
                column: startColumn
            };
        }
        return null;
    }

    private processPrintContent(): void {
        // Skip any whitespace after 'print' keyword
        while (this.currentChar() === ' ') {
            this.advance();
        }

        // Expect opening parenthesis
        if (this.currentChar() !== '(') {
            this.handleError(this.currentChar(), this.line, this.column);
            return;
        }
        this.advance();

        // Process characters until closing parenthesis
        while (this.position < this.input.length && this.currentChar() !== ')') {
            const char = this.currentChar();
            const currentLine = this.line;
            const currentColumn = this.column;

            if (char === '"') {
                this.advance(); // Skip opening quote
                // Process all characters until closing quote
                while (this.currentChar() !== '"' && this.position < this.input.length) {
                    const charToken: Token = {
                        type: TokenType.CHAR,
                        value: this.currentChar(),
                        line: this.line,
                        column: this.column
                    };
                    this.logToken(TokenType.CHAR, this.currentChar(), this.line, this.column);
                    this.advance();
                }
                if (this.currentChar() === '"') {
                    this.advance(); // Skip closing quote
                }
            } else if (char !== ' ') {
                this.handleError(char, currentLine, currentColumn);
            }
            this.advance();
        }

        // Check for closing parenthesis
        if (this.currentChar() !== ')') {
            this.handleError(this.currentChar(), this.line, this.column);
            return;
        }
        this.advance();
    }

    private processKeyword(word: string, line: number, column: number): Token | null {
        switch (word.toLowerCase()) {
            case 'int':
                return { type: TokenType.I_TYPE, value: word, line, column };
            case 'string':
                return { type: TokenType.S_TYPE, value: word, line, column };
            case 'boolean':
                return { type: TokenType.B_TYPE, value: word, line, column };
            case 'while':
                return { type: TokenType.WHILE, value: word, line, column};
            case 'if':
                return { type: TokenType.IF, value: word, line, column};
            case 'else':
                return { type: TokenType.ELSE, value: word, line, column};
            case 'print':
                this.inPrintStatement = true;
                return { type: TokenType.PRINT, value: word, line, column};
            default:              
                return null;
        }
    }

    // complete the function to process the identifier such as int a 
    private processIdentifier(word: string, line: number, column: number): Token | null {
        if (word.toLowerCase() === 'true' || word.toLowerCase() === 'false') {
            return { type: TokenType.BOOLEAN_VALUE, value: word, line, column };
        }
        return null;
    }

    public tokenize(): { tokens: Token[], logs: LexerLog[] } {
        const tokens: Token[] = [];

        while (this.position < this.input.length) {
            const char = this.currentChar();
            const currentLine = this.line;
            const currentColumn = this.column;

            try {
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

                    case '(':
                        tokens.push({
                            type: TokenType.LEFT_PAREN,
                            value: char,
                            line: currentLine,
                            column: currentColumn
                        }); 
                        this.logToken(TokenType.LEFT_PAREN, char, currentLine, currentColumn);
                        this.advance();
                        break;

                    case ')':
                        tokens.push({
                            type: TokenType.RIGHT_PAREN,
                            value: char,
                            line: currentLine,
                            column: currentColumn
                        });
                        this.logToken(TokenType.RIGHT_PAREN, char, currentLine, currentColumn);
                        this.advance();
                        break;

                    case '"':
                        tokens.push({
                            type: TokenType.QUOTE,
                            value: char,
                            line: currentLine,
                            column: currentColumn
                        }); 
                        this.logToken(TokenType.QUOTE, char, currentLine, currentColumn);
                        this.advance();
                        break;
                    
                    case '=':
                        tokens.push({
                            type: TokenType.ASSIGN,
                            value: char,
                            line: currentLine,
                            column: currentColumn
                        });
                        this.logToken(TokenType.ASSIGN, char, currentLine, currentColumn);
                        this.advance();
                        break;
                    
                    case '!=':
                        tokens.push({
                            type: TokenType.NOT_EQUALS,
                            value: char,
                            line: currentLine,
                            column: currentColumn
                        });
                        this.logToken(TokenType.NOT_EQUALS, char, currentLine, currentColumn);
                        this.advance();
                        break;
                    case '+':
                        tokens.push({
                            type: TokenType.INT_OP, 
                            value: char,
                            line: currentLine,
                            column: currentColumn
                        });
                        this.logToken(TokenType.INT_OP, char, currentLine, currentColumn);
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
                        
                        // Add completion message for current program
                        if (this.errors > 0) {
                            this.addLog('ERROR', `Lexer - Lex failed with ${this.errors} error(s)`);
                        }

                        // Add completion message for current program
                        if (this.errors == 0) {
                            this.addLog('INFO',` Lexer - Lex completed with 0 errors`);
                        }
                        
                        // Reset for next program
                        this.programCounter++;
                        if (this.position < this.input.length) {
                            this.addLog('INFO', `Lexer - Lexing program ${this.programCounter}..`);
                            this.errors = 0;
                        }
                        break;

                    case '/':
                        if (this.peek() === '*') {
                            this.advance(); // skip /
                            this.advance(); // skip *
                            this.skipComment();
                        } else {
                            this.handleError(char, currentLine, currentColumn);
                        }
                        break;

                    case ' ':
                    case '\n':
                    case '\t':
                    case '\r':
                        this.advance();
                        break;

                    default:
                        if (this.isLetter(char)) {
                            const startColumn = currentColumn;
                            const word = this.readIdentifier();
                            const token = this.processKeyword(word, currentLine, startColumn);
                            if (token) {
                                tokens.push(token);
                                this.logToken(token.type, token.value, currentLine, startColumn,);
                                    if (token.type === TokenType.PRINT) {
                                        this.inPrintStatement = true;
                                    }
                            } else {
                                this.handleError(word, currentLine, startColumn);
                            }
                        } else {
                            this.handleError(char, currentLine, currentColumn);
                        }
                }
            } catch (error) {
                this.handleError(char, currentLine, currentColumn);
            }
        }
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