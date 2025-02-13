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