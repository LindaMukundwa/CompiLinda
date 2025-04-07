/**
 * Semantic analyzer for compiler that displays AST, type and scope checking and error detailing
 */


// import the tokens from the lexer to generate AST
import { Token, TokenType } from './main'; 

// AST Node Types
export enum NodeType {
    Program,
    Block,
    VarDeclaration,
    PrintStatement,
    WhileStatement,
    IfStatement,
    AssignmentStatement,
    BinaryExpression,
    Identifier,
    IntegerLiteral,
    StringLiteral,
    BooleanLiteral
}

// AST Node interface
export interface ASTNode {
    type: NodeType;
    line: number;
    column: number;
    children?: ASTNode[];
    [key: string]: any; // For additional properties specific to any of the node types
}

// Symbol Table Entry inteface
export interface SymbolTableEntry {
    name: string;
    type: string;
    scope: number;
    line: number;
    column: number;
    initialized: boolean;
    used: boolean;
}

// Semantic Analyzer class
export class SemanticAnalyzer {
    private tokens: Token[];
    private currentTokenIndex: number = 0;
    private currentScope: number = 0;
    private scopeStack: number[] = [0];
    private symbolTable: Map<string, SymbolTableEntry[]> = new Map();
    private errors: string[] = [];
    private warnings: string[] = [];
    
    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    // Gets the current token
    private currentToken(): Token {
        return this.tokens[this.currentTokenIndex];
    }

    // Advances to the next token
    private advance(): void {
        this.currentTokenIndex++;
    }

    // Checks if the current token is of a specific type
    private match(type: TokenType): boolean {
        return this.currentToken().type === type;
    }

    // Consumes token if it matches the expected type
    private consume(type: TokenType, errorMessage: string): Token {
        if (this.match(type)) {
            const token = this.currentToken();
            this.advance();
            return token;
        }
        this.addError(errorMessage);
        return this.currentToken(); // Return current token anyway
    }

    // Adds error message
    private addError(message: string): void {
        const token = this.currentToken();
        this.errors.push(`Error at ${token.line}:${token.column} - ${message}`);
    }

    // Adds warning message
    private addWarning(message: string): void {
        const token = this.currentToken();
        this.warnings.push(`Warning at ${token.line}:${token.column} - ${message}`);
    }

    // Enters a new scope
    private enterScope(): void {
        this.currentScope++;
        this.scopeStack.push(this.currentScope);
    }

    // Exits the current scope
    private exitScope(): void {
        this.scopeStack.pop();
        this.currentScope = this.scopeStack[this.scopeStack.length - 1];
        
        // Check for unused variables in the exited scope
        this.checkUnusedVariables();
    }

    // Check for unused variables in the current scope
    private checkUnusedVariables(): void {
        for (const [name, entries] of this.symbolTable.entries()) {
            for (const entry of entries) {
                if (entry.scope === this.currentScope + 1) {
                    if (!entry.used) {
                        this.warnings.push(`Warning at ${entry.line}:${entry.column} - Variable '${entry.name}' declared but never used`);
                    }
                    if (entry.initialized && !entry.used) {
                        this.warnings.push(`Warning at ${entry.line}:${entry.column} - Variable '${entry.name}' initialized but never used`);
                    }
                }
            }
        }
    }

    // Adds symbol to the symbol table
    private addSymbol(name: string, type: string, line: number, column: number): void {
        const entry: SymbolTableEntry = {
            name,
            type,
            scope: this.currentScope,
            line,
            column,
            initialized: false,
            used: false
        };

        // Checks if symbol already exists in current scope
        const existingEntries = this.symbolTable.get(name) || [];
        for (const existing of existingEntries) {
            if (existing.scope === this.currentScope) {
                this.addError(`Redeclaration of variable '${name}'`);
                return;
            }
        }

        existingEntries.push(entry);
        this.symbolTable.set(name, existingEntries);
    }

    // Get symbol from the symbol table
    private getSymbol(name: string): SymbolTableEntry | null {
        const entries = this.symbolTable.get(name);
        if (!entries || entries.length === 0) {
            return null;
        }

        // Find the entry with the closest scope that is still valid
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            for (const entry of entries) {
                if (entry.scope <= scope) {
                    return entry;
                }
            }
        }
        return null;
    }

    // Marks a symbol as initialized
    private markInitialized(name: string): void {
        const symbol = this.getSymbol(name);
        if (symbol) {
            symbol.initialized = true;
        }
    }

    // Marks a symbol as used
    private markUsed(name: string): void {
        const symbol = this.getSymbol(name);
        if (symbol) {
            symbol.used = true;
        } else {
            this.addError(`Use of undeclared variable '${name}'`);
        }
    }

}