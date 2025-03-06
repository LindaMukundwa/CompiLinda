/**
 * Parser implementation for CompiLinda language
 */

import { Token, TokenType, LexerLog } from './main';

// Node interface for the CST
export interface ASTNode {
    type: string;
    value?: string | number | boolean;
    children: ASTNode[];
    token?: Token;
}

// Parser class that implements recursive descent parsing
export class Parser {
    private tokens: Token[];
    private current: number = 0;
    private logs: LexerLog[] = [];
    private errors: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.addLog('INFO', 'Parser - Starting parsing process...');
    }

    // Main parse method
    public parse(): { ast: ASTNode | null, logs: LexerLog[] } {
        try {
            const ast = this.program();
            
            if (this.errors === 0) {
                this.addLog('INFO', 'Parser - Parsing completed successfully');
            } else {
                this.addLog('ERROR', `Parser - Parsing failed with ${this.errors} error(s)`);
            }
            
            return { ast, logs: this.logs };
        } catch (error) {
            this.addLog('ERROR', `Parser - Fatal error: ${error instanceof Error ? error.message : String(error)}`);
            return { ast: null, logs: this.logs };
        }
    }

    // Grammar rule: program → block EOP
    private program(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing program');
        
        const node: ASTNode = {
            type: 'Program',
            children: []
        };
        
        // Check if program starts with a block
        if (this.check(TokenType.OPEN_BLOCK)) {
            const blockNode = this.block();
            node.children.push(blockNode);
            
            // Expect end of program symbol
            if (this.check(TokenType.EOP)) {
                const eopToken = this.advance();
                node.children.push({
                    type: 'EndOfProgram',
                    value: eopToken.value,
                    children: [],
                    token: eopToken
                });
            } else {
                this.error('Expected end of program symbol ($)');
            }
        } else {
            this.error('Program must start with an opening brace ({)');
        }
        
        return node;
    }

    // Grammar rule: block → "{" statement* "}"
    private block(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing block');
        
        const openToken = this.advance(); // Consume the opening brace
        
        const node: ASTNode = {
            type: 'Block',
            children: [],
            token: openToken
        };
        
        // Process statements until we find a closing brace
        while (!this.isAtEnd() && !this.check(TokenType.CLOSE_BLOCK)) {
            try {
                const statement = this.statement();
                node.children.push(statement);
            } catch (error) {
                this.synchronize();
                
                // If we're at the end or at a closing brace, break to avoid infinite loop
                if (this.isAtEnd() || this.check(TokenType.CLOSE_BLOCK)) {
                    break;
                }
            }
        }
        
        // Expect closing brace
        if (this.check(TokenType.CLOSE_BLOCK)) {
            const closeToken = this.advance();
            node.children.push({
                type: 'BlockEnd',
                value: closeToken.value,
                children: [],
                token: closeToken
            });
        } else {
            this.error('Expected closing brace (})');
        }
        
        return node;
    }

    // Grammar rule: statement → printStmt | whileStmt | ifStmt | varDeclaration | expressionStmt
    private statement(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing statement');
        
        if (this.check(TokenType.PRINT)) {
            return this.printStatement();
        }
        if (this.check(TokenType.WHILE)) {
            return this.whileStatement();
        }
        if (this.check(TokenType.IF)) {
            return this.ifStatement();
        }
        if (this.check(TokenType.I_TYPE) || this.check(TokenType.S_TYPE) || this.check(TokenType.B_TYPE)) {
            return this.varDeclaration();
        }
        
        // Default to expression statement
        return this.expressionStatement();
    }

    // Grammar rule: printStmt → "print" "(" expression ")" 
    private printStatement(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing print statement');
        
        const printToken = this.advance(); // Consume 'print'
        
        const node: ASTNode = {
            type: 'PrintStatement',
            children: [],
            token: printToken
        };
        
        // Expect left parenthesis
        if (this.check(TokenType.LEFT_PAREN)) {
            const leftParenToken = this.advance();
            node.children.push({
                type: 'LeftParen',
                value: leftParenToken.value,
                children: [],
                token: leftParenToken
            });
            
            // Parse the expression inside the print statement
            // Special case: Handle string literals directly
            if (this.check(TokenType.QUOTE)) {
                const stringNode = this.stringLiteral();
                node.children.push(stringNode);
            } else {
                // Otherwise handle expression
                const expressionNode = this.expression();
                node.children.push(expressionNode);
            }
            
            // Expect right parenthesis
            if (this.check(TokenType.RIGHT_PAREN)) {
                const rightParenToken = this.advance();
                node.children.push({
                    type: 'RightParen',
                    value: rightParenToken.value,
                    children: [],
                    token: rightParenToken
                });
            } else {
                this.error('Expected closing parenthesis after print statement');
            }
        } else {
            this.error('Expected opening parenthesis after print keyword');
        }
        
        return node;
    }

    // Grammar rule: whileStmt → "while" "(" expression ")" block
    private whileStatement(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing while statement');
        
        const whileToken = this.advance(); // Consume 'while'
        
        const node: ASTNode = {
            type: 'WhileStatement',
            children: [],
            token: whileToken
        };
        
        // Expect left parenthesis
        if (this.check(TokenType.LEFT_PAREN)) {
            const leftParenToken = this.advance();
            node.children.push({
                type: 'LeftParen',
                value: leftParenToken.value,
                children: [],
                token: leftParenToken
            });
            
            // Parse the condition
            const conditionNode = this.expression();
            node.children.push(conditionNode);
            
            // Expect right parenthesis
            if (this.check(TokenType.RIGHT_PAREN)) {
                const rightParenToken = this.advance();
                node.children.push({
                    type: 'RightParen',
                    value: rightParenToken.value,
                    children: [],
                    token: rightParenToken
                });
                
                // Parse the body block
                if (this.check(TokenType.OPEN_BLOCK)) {
                    const bodyNode = this.block();
                    node.children.push(bodyNode);
                } else {
                    this.error('Expected block after while condition');
                }
            } else {
                this.error('Expected closing parenthesis after while condition');
            }
        } else {
            this.error('Expected opening parenthesis after while keyword');
        }
        
        return node;
    }

    // Grammar rule: ifStmt → "if" "(" expression ")" block ( "else" block )?
    private ifStatement(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing if statement');
        
        const ifToken = this.advance(); // Consume 'if'
        
        const node: ASTNode = {
            type: 'IfStatement',
            children: [],
            token: ifToken
        };
        
        // Expect left parenthesis
        if (this.check(TokenType.LEFT_PAREN)) {
            const leftParenToken = this.advance();
            node.children.push({
                type: 'LeftParen',
                value: leftParenToken.value,
                children: [],
                token: leftParenToken
            });
            
            // Parse the condition
            const conditionNode = this.expression();
            node.children.push(conditionNode);
            
            // Expect right parenthesis
            if (this.check(TokenType.RIGHT_PAREN)) {
                const rightParenToken = this.advance();
                node.children.push({
                    type: 'RightParen',
                    value: rightParenToken.value,
                    children: [],
                    token: rightParenToken
                });
                
                // Parse the then block
                if (this.check(TokenType.OPEN_BLOCK)) {
                    const thenNode = this.block();
                    thenNode.type = 'ThenBlock';
                    node.children.push(thenNode);
                    
                    // Check for optional else clause
                    if (this.check(TokenType.ELSE)) {
                        const elseToken = this.advance();
                        const elseNode: ASTNode = {
                            type: 'ElseClause',
                            children: [],
                            token: elseToken
                        };
                        
                        // Parse the else block
                        if (this.check(TokenType.OPEN_BLOCK)) {
                            const elseBlockNode = this.block();
                            elseBlockNode.type = 'ElseBlock';
                            elseNode.children.push(elseBlockNode);
                        } else {
                            this.error('Expected block after else keyword');
                        }
                        
                        node.children.push(elseNode);
                    }
                } else {
                    this.error('Expected block after if condition');
                }
            } else {
                this.error('Expected closing parenthesis after if condition');
            }
        } else {
            this.error('Expected opening parenthesis after if keyword');
        }
        
        return node;
    }

    // Grammar rule: varDeclaration → type IDENTIFIER ( "=" expression )?
    private varDeclaration(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing variable declaration');
        
        const typeToken = this.advance(); // Consume type token
        
        const node: ASTNode = {
            type: 'VariableDeclaration',
            children: [],
            token: typeToken
        };
        
        // Add type node
        node.children.push({
            type: 'Type',
            value: typeToken.value,
            children: [],
            token: typeToken
        });
        
        // Expect identifier
        if (this.check(TokenType.IDENTIFIER)) {
            const identifierToken = this.advance();
            node.children.push({
                type: 'Identifier',
                value: identifierToken.value,
                children: [],
                token: identifierToken
            });
            
            // Check for optional initialization
            if (this.check(TokenType.ASSIGN)) {
                const assignToken = this.advance();
                node.children.push({
                    type: 'AssignOperator',
                    value: assignToken.value,
                    children: [],
                    token: assignToken
                });
                
                // Parse the initialization expression
                const initNode = this.expression();
                node.children.push(initNode);
            }
        } else {
            this.error('Expected identifier after type');
        }
        
        return node;
    }

    // Grammar rule: expressionStmt → expression
    private expressionStatement(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing expression statement');
        
        const node: ASTNode = {
            type: 'ExpressionStatement',
            children: []
        };
        
        const expr = this.expression();
        node.children.push(expr);
        
        return node;
    }

    // Grammar rule: expression → assignment
    private expression(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing expression');
        return this.assignment();
    }

    // Grammar rule: assignment → IDENTIFIER "=" assignment | equality
    private assignment(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing assignment');
        
        // First parse as if it's an equality
        const expr = this.equality();
        
        // Check if it's actually an assignment
        if (this.check(TokenType.ASSIGN)) {
            const equalsToken = this.advance();
            
            // The target must be a valid identifier
            if (expr.type === 'Identifier') {
                const value = this.assignment();
                
                const node: ASTNode = {
                    type: 'Assignment',
                    children: [
                        expr,
                        {
                            type: 'AssignOperator',
                            value: equalsToken.value,
                            children: [],
                            token: equalsToken
                        },
                        value
                    ]
                };
                
                return node;
            } else {
                this.error('Invalid assignment target');
            }
        }
        
        return expr;
    }

    // Grammar rule: equality → comparison ( ( "!=" | "==" ) comparison )*
    private equality(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing equality');
        
        let expr = this.comparison();
        
        while (this.match(TokenType.EQUALS, TokenType.NOT_EQUALS)) {
            const operatorToken = this.previous();
            const right = this.comparison();
            
            expr = {
                type: 'BinaryExpression',
                children: [
                    expr,
                    {
                        type: 'Operator',
                        value: operatorToken.value,
                        children: [],
                        token: operatorToken
                    },
                    right
                ]
            };
        }
        
        return expr;
    }

    // Grammar rule: comparison → term
    private comparison(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing comparison');
        return this.term();
    }

    // Grammar rule: term → factor ( "+" factor )*
    private term(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing term');
        
        let expr = this.factor();
        
        while (this.match(TokenType.INT_OP)) {
            const operatorToken = this.previous();
            const right = this.factor();
            
            expr = {
                type: 'BinaryExpression',
                children: [
                    expr,
                    {
                        type: 'Operator',
                        value: operatorToken.value,
                        children: [],
                        token: operatorToken
                    },
                    right
                ]
            };
        }
        
        return expr;
    }

    // Grammar rule: factor → primary
    private factor(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing factor');
        return this.primary();
    }

    // Grammar rule: primary → NUMBER | STRING | BOOLEAN | IDENTIFIER | "(" expression ")"
    private primary(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing primary');
        
        if (this.check(TokenType.DIGIT)) {
            return this.numberLiteral();
        }
        
        if (this.check(TokenType.QUOTE)) {
            return this.stringLiteral();
        }
        
        if (this.check(TokenType.BOOLEAN_VALUE)) {
            const boolToken = this.advance();
            return {
                type: 'BooleanLiteral',
                value: boolToken.value.toLowerCase() === 'true',
                children: [],
                token: boolToken
            };
        }
        
        if (this.check(TokenType.IDENTIFIER)) {
            const identToken = this.advance();
            return {
                type: 'Identifier',
                value: identToken.value,
                children: [],
                token: identToken
            };
        }
        
        if (this.check(TokenType.LEFT_PAREN)) {
            const leftParen = this.advance();
            
            const node: ASTNode = {
                type: 'GroupExpression',
                children: [
                    {
                        type: 'LeftParen',
                        value: leftParen.value,
                        children: [],
                        token: leftParen
                    }
                ]
            };
            
            const expr = this.expression();
            node.children.push(expr);
            
            if (this.check(TokenType.RIGHT_PAREN)) {
                const rightParen = this.advance();
                node.children.push({
                    type: 'RightParen',
                    value: rightParen.value,
                    children: [],
                    token: rightParen
                });
            } else {
                this.error('Expected closing parenthesis');
            }
            
            return node;
        }
        
        this.error(`Expected expression, got ${this.peek().type}`);
        return { type: 'Error', children: [] }; // This line will never be reached after error() is called
    }

    // Parse a string literal
    private stringLiteral(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing string literal');
        
        const openQuote = this.advance(); // Consume opening quote
        
        const node: ASTNode = {
            type: 'StringLiteral',
            value: '',
            children: [
                {
                    type: 'Quote',
                    value: openQuote.value,
                    children: [],
                    token: openQuote
                }
            ]
        };
        
        let stringValue = '';
        
        // Collect all CHAR tokens until we hit the closing quote
        while (!this.isAtEnd() && this.check(TokenType.CHAR)) {
            const charToken = this.advance();
            stringValue += charToken.value;
            
            node.children.push({
                type: 'Character',
                value: charToken.value,
                children: [],
                token: charToken
            });
        }
        
        // Set the complete string value
        node.value = stringValue;
        
        // Expect closing quote
        if (this.check(TokenType.QUOTE)) {
            const closeQuote = this.advance();
            node.children.push({
                type: 'Quote',
                value: closeQuote.value,
                children: [],
                token: closeQuote
            });
        } else {
            this.error('Unterminated string');
        }
        
        return node;
    }

    // Parse a number literal
    private numberLiteral(): ASTNode {
        this.addLog('DEBUG', 'Parser - Processing number literal');
        
        const digitToken = this.advance();
        return {
            type: 'NumberLiteral',
            value: parseInt(digitToken.value),
            children: [],
            token: digitToken
        };
    }

    // Helper methods for the recursive descent parser
    
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    
    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }
    
    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }
    
    private isAtEnd(): boolean {
        return this.current >= this.tokens.length;
    }
    
    private peek(): Token {
        return this.tokens[this.current];
    }
    
    private previous(): Token {
        return this.tokens[this.current - 1];
    }
    
    private error(message: string): void {
        this.errors++;
        const token = this.peek();
        this.addLog('ERROR', `Parser - Error at line ${token.line}, column ${token.column}: ${message}`);
    }
    
    private synchronize(): void {
        this.advance();
        
        while (!this.isAtEnd()) {
            // Skip until we find a statement boundary
            if (this.previous().type === TokenType.CLOSE_BLOCK) return;
            
            switch (this.peek().type) {
                case TokenType.I_TYPE:
                case TokenType.S_TYPE:
                case TokenType.B_TYPE:
                case TokenType.IF:
                case TokenType.WHILE:
                case TokenType.PRINT:
                    return;
            }
            
            this.advance();
        }
    }
    
    private addLog(level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING', message: string): void {
        let color = '';
        switch (level) {
            case 'ERROR':
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
    
    // Pretty print the CST for display
    public printCST(node: ASTNode | null, indent: number = 0): string {
        if (!node) return 'No parse tree available';
        
        const spacing = '  '.repeat(indent);
        let result = spacing + node.type;
        
        if (node.value !== undefined) {
            result += `: ${node.value}`;
        }
        
        result += '\n';
        
        for (const child of node.children) {
            result += this.printCST(child, indent + 1);
        }
        
        return result;
    }
}

// Make Parser class available in the global scope for browser use
declare global {
    interface Window {
        Parser: typeof Parser;
    }
}

window.Parser = Parser;
(window as any).Parser = Parser;