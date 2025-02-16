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
    level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING';
    message: string;
}

//import { Token, TokenType, LexerLog } from './types';

export interface LexerLog {
    level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING';
    message: string;
    color?: string;
}

export class Lexer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private logs: LexerLog[] = [];
    private errors: number = 0;
    private warnings: number = 0;
    private programCounter: number = 1;
    private inPrintStatement: boolean = false;
    private commentDepth: number = 0;
    private stringStartLine: number = 0;  // Track where string starts for multiline detection
    private stringStartColumn: number = 0;

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

    private addWarning(message: string, line: number, column: number): void {
        this.warnings++;
        this.addLog('WARNING', `Lexer - Warning:${line}:${column} ${message}`);
    }

    

    private handleString(tokens: Token[]): void {
        this.stringStartLine = this.line;
        this.stringStartColumn = this.column;
        
        tokens.push({
            type: TokenType.QUOTE,
            value: '"',
            line: this.line,
            column: this.column
        });
        this.logToken(TokenType.QUOTE, '"', this.line, this.column);
        this.advance();

        while (this.position < this.input.length && this.currentChar() !== '"') {
            // Check for newline in string
            if (this.currentChar() === '\n') {
                this.handleError('Multiline strings are not allowed', this.stringStartLine, this.stringStartColumn);
                return;
            }

            const charToken: Token = {
                type: TokenType.CHAR,
                value: this.currentChar(),
                line: this.line,
                column: this.column
            };
            tokens.push(charToken);
            this.logToken(TokenType.CHAR, this.currentChar(), this.line, this.column);
            this.advance();
        }

        if (this.currentChar() === '"') {
            tokens.push({
                type: TokenType.QUOTE,
                value: '"',
                line: this.line,
                column: this.column
            });
            this.logToken(TokenType.QUOTE, '"', this.line, this.column);
            this.advance();
        } else {
            this.handleError('Unterminated string', this.stringStartLine, this.stringStartColumn);
        }
    }

    private skipComment(): void {
        this.commentDepth++;
        const startLine = this.line;
        const startColumn = this.column;
        let foundEnd = false;
        
        while (this.position < this.input.length) {
            if (this.currentChar() === '/' && this.peek() === '*') {
                this.advance(); // skip /
                this.advance(); // skip *
                this.commentDepth++;
            } else if (this.currentChar() === '*' && this.peek() === '/') {
                this.advance(); // skip *
                this.advance(); // skip /
                this.commentDepth--;
                if (this.commentDepth === 0) {
                    foundEnd = true;
                    break;
                }
            } else {
                this.advance();
            }
        }
        
        if (!foundEnd) {
            this.handleError('Unterminated comment block', startLine, startColumn);
            this.commentDepth = 0; // Reset comment depth after error
        }
    }

    private isLetter(char: string): boolean {
        return /[a-zA-Z]/.test(char);
    }

    private isDigit(char: string): boolean {
        return /[0-9]/.test(char);
    }

    private isIdentifierChar(char: string): boolean {
        return this.isLetter(char) || this.isDigit(char) || char === '_';
    }

    private isKeyword(word: string): boolean {
        const keywords = ['int', 'string', 'boolean', 'print', 'while', 'if', 'else', 'true', 'false'];
        return keywords.includes(word.toLowerCase());
    }

    private readNumber(): string {
        let result = '';
        while (this.position < this.input.length && this.isDigit(this.currentChar())) {
            result += this.currentChar();
            this.advance();
        }
        return result;
    }

    private processIdentifier(word: string, line: number, column: number): Token {
        // Check for boolean values first
        if (word.toLowerCase() === 'true' || word.toLowerCase() === 'false') {
            return { type: TokenType.BOOLEAN_VALUE, value: word, line, column };
        }
        // If it's not a boolean value, it's a regular identifier
        return { type: TokenType.IDENTIFIER, value: word, line, column };
    }

    private readBuffer(): string {
        let buffer = '';
        let tempPosition = this.position;
        let chars = [];

        // Read characters into buffer until we hit a non-identifier character
        while (tempPosition < this.input.length && this.isIdentifierChar(this.input[tempPosition])) {
            chars.push({
                char: this.input[tempPosition],
                pos: tempPosition
            });
            tempPosition++;
        }

        // Try to match the longest possible keyword first
        for (let i = 0; i < chars.length; i++) {
            buffer = chars.slice(0, i + 1).map(c => c.char).join('');

            // If we have a keyword match
            if (this.isKeyword(buffer)) {
                // Advance position to end of keyword
                this.position = chars[i].pos + 1;
                // Update column
                this.column += buffer.length;
                return buffer;
            }
        }

        // If no keyword found, read just one character for the identifier
        if (chars.length > 0) {
            this.position = chars[0].pos + 1;
            this.column++;
            return chars[0].char;
        }

        return '';
    }


    private addLog(level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING', message: string): void {
        let color = '';
        switch (level) {
            case 'ERROR':
                // Using ANSI escape codes for terminal output
                color = '\x1b[31m'; // Red color
                break;
            case 'WARNING':
                color = '\x1b[33m'; // Yellow color
                break;
            case 'INFO':
                color = '\x1b[36m'; // Cyan color
                break;
            case 'DEBUG':
                color = '\x1b[32m'; // Green color
                break;
        }

        this.logs.push({
            level,
            message,
            color
        });
    }

    private logToken(type: TokenType, value: string, line: number, column: number): void {
        let tokenName = type.toString();
        this.addLog('DEBUG', `Lexer - ${tokenName} [ ${value} ] found at (${line}:${column})`);
    }

   /*  private handleError(char: string, line: number, column: number): void {
        this.errors++;
        this.addLog('ERROR', `Lexer - Error:${line}:${column} Unrecognized Token: ${char})`);
        this.advance();
    } */

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
            /*case 'identifier':
                return { type: TokenType.IDENTIFIER, value: word, line, column };*/
            case 'string':
                return { type: TokenType.S_TYPE, value: word, line, column };
            case 'boolean':
                return { type: TokenType.B_TYPE, value: word, line, column };
            case 'while':
                return { type: TokenType.WHILE, value: word, line, column };
            case 'if':
                return { type: TokenType.IF, value: word, line, column };
            case 'else':
                return { type: TokenType.ELSE, value: word, line, column };
            case 'print':
                this.inPrintStatement = true;
                return { type: TokenType.PRINT, value: word, line, column };
            default:
                return null;
        }
    }

    private processNextToken(currentLine: number, currentColumn: number): Token | null {
        const word = this.readBuffer();
        if (!word) return null;

        // Try to match keyword first
        const token = this.processKeyword(word, currentLine, currentColumn);
        if (token) {
            return token;
        }

        // If not a keyword, process as identifier
        return this.processIdentifier(word, currentLine, currentColumn);
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
                        this.handleString(tokens);
                        break;

                    case '=':
                        if (this.peek() === '=') {
                            tokens.push({
                                type: TokenType.EQUALS,
                                value: '==',
                                line: currentLine,
                                column: currentColumn
                            });
                            this.logToken(TokenType.EQUALS, '==', currentLine, currentColumn);
                            this.advance(); // skip first =
                            this.advance(); // skip second =
                        } else {
                            tokens.push({
                                type: TokenType.ASSIGN,
                                value: '=',
                                line: currentLine,
                                column: currentColumn
                            });
                            this.logToken(TokenType.ASSIGN, '=', currentLine, currentColumn);
                            this.advance();
                        }
                        break;

                    case '!':
                        if (this.peek() === '=') {
                            tokens.push({
                                type: TokenType.NOT_EQUALS,
                                value: '!=',
                                line: currentLine,
                                column: currentColumn
                            });
                            this.logToken(TokenType.NOT_EQUALS, '!=', currentLine, currentColumn);
                            this.advance(); // skip !
                            this.advance(); // skip =
                        } else {
                            this.handleError(char, currentLine, currentColumn);
                        }
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
                            this.addLog('INFO', ` Lexer - Lex completed with 0 errors`);
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
                        this.handleError('Tabs are not allowed', currentLine, currentColumn);
                        this.advance();
                        break;
                    case '\r':
                        this.advance();
                        break;

                    default:
                        if (this.isLetter(char)) {
                            const token = this.processNextToken(currentLine, currentColumn);
                            if (token) {
                                tokens.push(token);
                                this.logToken(token.type, token.value, currentLine, currentColumn);
                                if (token.type === TokenType.PRINT) {
                                    // Skip whitespace after print
                                    while (this.currentChar() === ' ') {
                                        this.advance();
                                    }

                                    // Handle left parenthesis
                                    if (this.currentChar() === '(') {
                                        tokens.push({
                                            type: TokenType.LEFT_PAREN,
                                            value: '(',
                                            line: this.line,
                                            column: this.column
                                        });
                                        this.logToken(TokenType.LEFT_PAREN, '(', this.line, this.column);
                                        this.advance();

                                        // Skip whitespace
                                        while (this.currentChar() === ' ') {
                                            this.advance();
                                        }

                                        // Handle quote
                                        if (this.currentChar() === '"') {
                                            tokens.push({
                                                type: TokenType.QUOTE,
                                                value: '"',
                                                line: this.line,
                                                column: this.column
                                            });
                                            this.logToken(TokenType.QUOTE, '"', this.line, this.column);
                                            this.advance();

                                            // Process characters inside quotes
                                            while (this.currentChar() !== '"' && this.position < this.input.length) {
                                                const charToken: Token = {
                                                    type: TokenType.CHAR,
                                                    value: this.currentChar(),
                                                    line: this.line,
                                                    column: this.column
                                                };
                                                tokens.push(charToken);
                                                this.logToken(TokenType.CHAR, this.currentChar(), this.line, this.column);
                                                this.advance();
                                            }

                                            // Handle closing quote
                                            if (this.currentChar() === '"') {
                                                tokens.push({
                                                    type: TokenType.QUOTE,
                                                    value: '"',
                                                    line: this.line,
                                                    column: this.column
                                                });
                                                this.logToken(TokenType.QUOTE, '"', this.line, this.column);
                                                this.advance();
                                            }
                                        }

                                        // Handle right parenthesis
                                        if (this.currentChar() === ')') {
                                            tokens.push({
                                                type: TokenType.RIGHT_PAREN,
                                                value: ')',
                                                line: this.line,
                                                column: this.column
                                            });
                                            this.logToken(TokenType.RIGHT_PAREN, ')', this.line, this.column);
                                            this.advance();
                                        }
                                    }
                                }
                            }
                        } else if (this.isDigit(char)) {
                            const startColumn = currentColumn;
                            const number = this.readNumber();
                            const digitToken: Token = {
                                type: TokenType.DIGIT,
                                value: number,
                                line: currentLine,
                                column: startColumn
                            };
                            tokens.push(digitToken);
                            this.logToken(TokenType.DIGIT, number, currentLine, startColumn);
                        } else {
                            this.handleError(char, currentLine, currentColumn);
                        }
                }
            } catch (error) {
                this.handleError(char, currentLine, currentColumn);
            }
        }

        // Check for missing EOP ($) at the end
        if (tokens.length > 0 && tokens[tokens.length - 1].type !== TokenType.EOP) {
            this.addWarning('Missing end of program symbol ($)', this.line, this.column);
            // Add implicit EOP token
            tokens.push({
                type: TokenType.EOP,
                value: '$',
                line: this.line,
                column: this.column
            });
        }

        // Check for unclosed comment blocks at the end
        if (this.commentDepth > 0) {
            this.handleError(`Unclosed comment block(s)`, this.line, this.column);
        }

        // Add completion messages
        if (this.errors > 0) {
            this.addLog('ERROR', `Lexer - Lex failed with ${this.errors} error(s) and ${this.warnings} warning(s)`);
        } else {
            this.addLog('INFO', `Lexer - Lex completed with ${this.warnings} warning(s)`);
        }

        return { tokens, logs: this.logs };
    }
    private handleError(message: string, line: number, column: number): void {
        this.errors++;
        this.addLog('ERROR', `Lexer - Error:${line}:${column} ${message}`);
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