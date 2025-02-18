/**
 * Main logic for the lexer and possibly the parser in future versions - very verbose and detailed
 */

// Token types for the lexer as defined in the language grammar
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

// Token interface for the lexer
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

// Lexer log interface for the lexer
export interface LexerLog {
    level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING';
    message: string;
}

// Lexer log interface for the lexer
export interface LexerLog {
    level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING';
    message: string;
    color?: string;
}

// Lexer class for the lexer    
export class Lexer {

    // Private properties for the lexer
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
    private stringStartLine: number = 0;  // Tracks where string starts for multiline detection
    private stringStartColumn: number = 0;

    // Constructor for the lexer
    constructor(input: string) {
        this.input = input;
        this.addLog('INFO', `Lexer - Lexing program ${this.programCounter}..`);
    }

    // Private methods for the lexer
    private currentChar(): string {
        return this.input[this.position] || '';
    }

    // Peek method for the lexer
    private peek(offset: number = 1): string {
        return this.input[this.position + offset] || '';
    }

    // Advance method for the lexer
    private advance(): void {
        if (this.currentChar() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
    }

    // Add warning method for the lexer
    private addWarning(message: string, line: number, column: number): void {
        this.warnings++;
        this.addLog('WARNING', `Lexer - Warning:${line}:${column} ${message}`);
    }

    // Helper method which will validate each string character in a method for the lexer
    private validateStringChar(char: string, line: number, column: number): boolean {
        if (!this.isLetter(char)) {
            this.handleError(`Invalid character '${char}' in string, only lowercase a-z allowed`, line, column);
            return false;
        }
        return true;
    }

    // Handle string method for the lexer
    private handleString(tokens: Token[]): void {
        this.stringStartLine = this.line;
        this.stringStartColumn = this.column;
    
        // Add opening quote token
        tokens.push({
            type: TokenType.QUOTE,
            value: '"',
            line: this.line,
            column: this.column
        });
        this.logToken(TokenType.QUOTE, '"', this.line, this.column);
        this.advance();
    
        // Process each character inside the string
        while (this.position < this.input.length) {
            // Check for end of string
            if (this.currentChar() === '"') {
                break;
            }
    
            // Check for newline in string
            if (this.currentChar() === '\n') {
                this.handleError('Multiline strings are not allowed', this.stringStartLine, this.stringStartColumn);
                return;
            }
            
            // Validate and process current character
            const currentChar = this.currentChar();
            const currentLine = this.line;
            const currentColumn = this.column;
            
            if (this.validateStringChar(currentChar, currentLine, currentColumn)) {
                tokens.push({
                    type: TokenType.CHAR,
                    value: currentChar,
                    line: currentLine,
                    column: currentColumn
                });
                this.logToken(TokenType.CHAR, currentChar, currentLine, currentColumn);
            }
            this.advance();
        }
    
        // Handle the closing quote or unterminated string
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

    // Skip comment method for the lexer
    private skipComment(): void {
        this.commentDepth++;
        const startLine = this.line;
        const startColumn = this.column;
        let foundEnd = false;

        while (this.position < this.input.length) {
            if (this.currentChar() === '/' && this.peek() === '*') {
                // Nested comment start
                this.advance(); // skip /
                this.advance(); // skip *
                this.commentDepth++;
            } else if (this.currentChar() === '*' && this.peek() === '/') {
                // Comment end
                this.advance(); // skip *
                this.advance(); // skip /
                this.commentDepth--;
                if (this.commentDepth === 0) {
                    foundEnd = true;
                    break;
                }
            } else {
                // Skip all other characters inside the comment
                this.advance();
            }
        }

        if (!foundEnd) {
            this.handleError('Unterminated comment block', startLine, startColumn);
            // Skip to the end of the input or the next valid token
            while (this.position < this.input.length && this.currentChar() !== '\n') {
                this.advance();
            }
        }
    }

    // Check if character is a letter for the lexer
    private isLetter(char: string): boolean {
        return /[a-z]/.test(char);
    }

    // Check if character is a digit for the lexer
    private isDigit(char: string): boolean {
        return /[0-9]/.test(char);
    }

    // Check if character is a valid identifier character for the lexer
    private isIdentifierChar(char: string): boolean {
        return this.isLetter(char) || this.isDigit(char) || char === '_';
    }

    // Check if word is a keyword for the lexer
    private isKeyword(word: string): boolean {
        const keywords = ['int', 'string', 'boolean', 'print', 'while', 'if', 'else', 'true', 'false'];
        return keywords.includes(word.toLowerCase());
    }

    // Read number method for the lexer
    private readNumber(): string {
        if (this.position < this.input.length && this.isDigit(this.currentChar())) {
            const digit = this.currentChar();
            this.advance(); // Move to the next character
            return digit;
        }
        return '';
    }

    // Process identifier method for the lexer
    private processIdentifier(word: string, line: number, column: number): Token {
        // Check for boolean values first
        if (word.toLowerCase() === 'true' || word.toLowerCase() === 'false') {
            return { type: TokenType.BOOLEAN_VALUE, value: word, line, column };
        }
        // If it's not a boolean value, it's a regular identifier
        return { type: TokenType.IDENTIFIER, value: word, line, column };
    }

    // Read buffer method for the lexer
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
                // Advances position to end of keyword
                this.position = chars[i].pos + 1;
                // Updates column
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

    // Add log method for the lexer and also determines the color of the log
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

    // Log token method for the lexer and specific type of token
    private logToken(type: TokenType, value: string, line: number, column: number): void {
        let tokenName = type.toString();
        this.addLog('DEBUG', `Lexer - ${tokenName} [ ${value} ] found at (${line}:${column})`);
    }

    // Reads print keyword method for the lexer
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

    // Process print content method for the lexer
    private processPrintContent(): void {
        // Skip whitespace after 'print' keyword
        while (this.currentChar() === ' ') {
            this.advance();
        }
    
        // Expect opening parenthesis
        if (this.currentChar() !== '(') {
            this.handleError(`Unexpected character: '${this.currentChar()}', expected '('`, this.line, this.column);
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
                    const currentChar = this.currentChar();
                    const charLine = this.line;
                    const charColumn = this.column;
                    
                    if (this.validateStringChar(currentChar, charLine, charColumn)) {
                        const charToken: Token = {
                            type: TokenType.CHAR,
                            value: currentChar,
                            line: charLine,
                            column: charColumn
                        };
                        this.logToken(TokenType.CHAR, currentChar, charLine, charColumn);
                    }
                    // Always advance to the next character regardless of validation result
                    this.advance();
                }
                
                if (this.currentChar() === '"') {
                    this.advance(); // Skip closing quote
                }
            } else if (char !== ' ') {
                this.handleError(`Unexpected character: '${char}'`, currentLine, currentColumn);
                this.advance();
            } else {
                this.advance(); // Skip whitespace
            }
        }
    
        // Check for closing parenthesis
        if (this.currentChar() !== ')') {
            this.handleError(`Unexpected character: '${this.currentChar()}', expected ')'`, this.line, this.column);
            return;
        }
        this.advance();
    }

    // Process keyword method for the lexer from our defined keywords
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

    // Process next token method for the lexer with buffer
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

    // Main tokenize method for the lexer that accounts for different tokens and their logic in each case    
    public tokenize(): { tokens: Token[], logs: LexerLog[] } {
        const tokens: Token[] = [];
        while (this.position < this.input.length) {
            const char = this.currentChar();
            const currentLine = this.line;
            const currentColumn = this.column;

            //this.addLog('DEBUG', `Processing char: ${char} at position ${this.position}`);        // debug log for lexer

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
                        // Checks for assignment or equality
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
                        // Checks for inequality
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

                        // Resets for next program
                        this.programCounter++;
                        if (this.position < this.input.length) {
                            this.addLog('INFO', `Lexer - Lexing program ${this.programCounter}..`);
                            this.errors = 0;
                        }
                        break;

                    case '/':
                        // Checks for block comments or invalid input
                        if (this.peek() === '*') {
                            // Handle block comments
                            this.advance(); // skip /
                            this.advance(); // skip *
                            this.skipComment();
                        } else {
                            // Handle any unexpected input (e.g., // or / followed by anything else)
                            this.handleError(`Unexpected character after '/': ${this.peek()}`, this.line, this.column);
                            this.advance(); // Skip the '/' to avoid infinite loop
                        }
                        break;
                    case '0':
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                    case '5':
                    case '6':
                    case '7':
                    case '8':
                    case '9':
                        const digit = this.readNumber();
                        if (digit) {
                            const digitToken: Token = {
                                type: TokenType.DIGIT,
                                value: digit,
                                line: currentLine,
                                column: currentColumn
                            };
                            tokens.push(digitToken);
                            this.logToken(TokenType.DIGIT, digit, currentLine, currentColumn);
                        }
                        break;

                    case ' ':
                    case '\n':
                    case '\t':
                        //this.handleError('Tabs are not allowed', currentLine, currentColumn);
                        this.advance();
                        break;
                    case '\r':
                        this.advance();
                        break;

                    default:
                        // Checks for letters and processes them
                        if (this.isLetter(char)) {
                            const token = this.processNextToken(currentLine, currentColumn);
                            if (token) {
                                tokens.push(token);
                                this.logToken(token.type, token.value, currentLine, currentColumn);
                                if (token.type === TokenType.PRINT) {
                                    // Skip whitespace after print keyword
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
                                
                                        // Handle quote and string content
                                        if (this.currentChar() === '"') {
                                            this.handleString(tokens); // Use our fixed string handler
                                        } else {
                                            this.handleError(`Expected string after print(, found '${this.currentChar()}'`, this.line, this.column);
                                            this.advance();
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
                                        } else {
                                            this.handleError(`Expected closing parenthesis, found '${this.currentChar()}'`, this.line, this.column);
                                        }
                                    } else {
                                        this.handleError(`Expected opening parenthesis after print, found '${this.currentChar()}'`, this.line, this.column);
                                    }
                                }
                            }
                        } else if (this.isDigit(char)) {
                            // Reads number
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
                            this.advance();
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
    // Handle error method for the lexer
    private handleError(message: string, line: number, column: number): void {
        this.errors++;
        this.addLog('ERROR', `Lexer - Error:${line}:${column} ${message}`);
        //this.advance(); // Skip the invalid character to avoid infinite loops
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