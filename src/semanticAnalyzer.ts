/**
 * Semantic analyzer for compiler that displays AST, type and scope checking and error detailing
 */


// import the tokens from the lexer to generate AST
import { ASTNode as CSTNode } from './parser';
import { ASTAdapter } from './astAdapter';
import { LexerLog, Token, TokenType } from './main';

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

// Define error/warning types
interface SemanticIssue {
    type: 'error' | 'warning';
    message: string;
    line: number;
    column: number;
    
}

/**

/**
 * Main Semantic Analyzer class
 */
export class SemanticAnalyzer {

    private ast: ASTNode | null = null;
    private currentScope: number = 0;       // Current scope level (increments with each block entry)
    private scopeStack: number[] = [0];     // Stack of scope levels to handle nested scopes
    private symbolTable: Map<string, SymbolTableEntry[]> = new Map();

    // Track semantic error
    private issues: {type: 'error'|'warning', message: string, line: number, column: number}[] = [];

    private programCounter: number = 1;
    private lexerLogs: LexerLog[] = []; // Store lexer logs separately

   /*  constructor(tokens: Token[], lexerLogs: LexerLog[] = []) {
        this.tokens = tokens;
        this.lexerLogs = lexerLogs; // Store the lexer logs
        this.logs = [...lexerLogs]; // Include lexer logs in our logs
        this.addLog('INFO', `PARSER -- Parsing program ${this.programCounter}...`);
    } */
    
    /**
     * Constructor takes the CST from your parser
     */
    /**
     * Constructor takes the CST from your parser
     */
   /*  constructor(cst: any) {
        this.cst = cst;
        //this.ast = cst;
        // Convert CST to AST using the adapter
        this.ast = ASTAdapter.convert(cst);
        //this.addLog('INFO', `SEMANTIC ANALYZER -- Analyzing program ${this.programCounter}...`);
    } */

     /* // Adding log
     private addLog(level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARNING', message: string): void {
        this.logs.push({ // need to change error messaging 
            level,
            message
        });
    } */

        constructor(cst: any) {
            this.cst = cst;
            
            // Debug check
            if (typeof ASTAdapter === 'undefined') {
                throw new Error("ASTAdapter is not available in global scope");
            }
            if (typeof ASTAdapter.convert !== 'function') {
                throw new Error("ASTAdapter.convert is not a function");
            }
            
            this.ast = ASTAdapter.convert(cst);
        }

    /**
     * Main analysis method
     * Returns analysis results including symbol table and issues
     */
    public analyze(): {
        symbolTable: Map<string, SymbolTableEntry[]>;
        issues: SemanticIssue[];
        ast: ASTNode | null;
    } {
        if (!this.ast) {
            this.addError("Failed to generate AST from parser output", 0, 0);
            return {
                symbolTable: this.symbolTable,
                issues: this.issues,
                ast: null
            };
        }
        
        // Start the recursive analysis from the root of the AST
        this.analyzeNode(this.ast);
        
        // Check for any remaining unused variables in global scope
        this.checkForUnusedVariables(0);
        
        return {
            symbolTable: this.symbolTable,
            issues: this.issues,
            ast: this.ast
        };
    }

    /**
     * Print the analysis results in a readable format
     */
    public printResults(): string {
        let output = `Program 1 Abstract Syntax Tree\n`;
        output += '---------------------------------------------------\n';
        output += this.printAST(this.ast);
        output += '\n';
    
        output += `Program 1 Symbol Table\n`;
        output += '---------------------------------------------------\n';
        output += 'NAME\tTYPE\tisINIT?\tisUSED?\tSCOPE\n';
        output += '---------------------------------------------------\n';
        
        // Add symbol table entries
        this.symbolTable.forEach((entries, name) => {
            entries.forEach(entry => {
                output += `${name}\t${entry.type}\t${entry.initialized}\t${entry.used}\t${entry.scope}\n`;
            });
        });
    
        output += '\nSEMANTIC ANALYZER --> ';
        if (this.issues.some(issue => issue.type === 'error')) {
            output += 'Semantic Analysis completed with errors\n';
        } else {
            output += 'Semantic Analysis completed successfully\n';
        }
        
        return output;
    }

    /**
 * Print the AST in a readable format
 */
private printAST(node: ASTNode | null, indent: string = ''): string {
    if (!node) return '';
    
    let output = '';
    switch (node.type) {
        case NodeType.Program:
            output += `${indent}<Program>\n`;
            if (node.children) {
                for (const child of node.children) {
                    output += this.printAST(child, indent + '  ');
                }
            }
            break;
        case NodeType.Block:
            output += `${indent}<Block>\n`;
            if (node.children) {
                for (const child of node.children) {
                    output += this.printAST(child, indent + '  ');
                }
            }
            break;
        // Add cases for other node types as needed
        default:
            output += `${indent}<${NodeType[node.type]}>\n`;
            if (node.children) {
                for (const child of node.children) {
                    output += this.printAST(child, indent + '  ');
                }
            }
    }
    return output;
}

    /**
     * Analyze a CST node recursively
     */
    private analyzeNode(node: ASTNode): string | null {
        if (!node) return null;

        // Different node types will need different analysis
        switch (node.type) {
            case NodeType.Program:
                return this.analyzeProgram(node);
            case NodeType.Block:
                return this.analyzeBlock(node);
            case NodeType.VarDeclaration:
                return this.analyzeVarDeclaration(node);
            case NodeType.AssignmentStatement:
                return this.analyzeAssignment(node);
            case NodeType.IfStatement:
                return this.analyzeIfStatement(node);
            case NodeType.WhileStatement:
                return this.analyzeWhileStatement(node);
            case NodeType.PrintStatement:
                return this.analyzePrintStatement(node);
            case NodeType.BinaryExpression:
                return this.analyzeBinaryExpression(node);
            case NodeType.Identifier:
                return this.analyzeIdentifier(node);
            case NodeType.IntegerLiteral:
                return 'int';
            case NodeType.StringLiteral:
                return 'string';
            case NodeType.BooleanLiteral:
                return 'boolean';
            default:
                // For other node types or to handle children generically
                if (node.children && Array.isArray(node.children)) {
                    for (const child of node.children) {
                        this.analyzeNode(child);
                    }
                }
                return null;
        }
    }

    /**
     * Analyze program (root node)
     */
    private analyzeProgram(node: any): string | null {
        // Process all children of the program node
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                this.analyzeNode(child);
            }
        }
        return null;
    }

    /**
     * Analyze a code block
     */
    private analyzeBlock(node: any): string | null {
        // Enter a new scope
        this.enterScope();
        
        // Process all statements in the block
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                this.analyzeNode(child);
            }
        }
        
        // Exit the scope when done with the block
        this.exitScope();
        return null;
    }

    /**
     * Analyze variable declaration
     */
    private analyzeVarDeclaration(node: any): string | null {
        const type = node.varType; // 'int', 'string', or 'boolean'
        const name = node.varName;
        const line = node.line;
        const column = node.column;
        
        // Add to symbol table
        this.addSymbol(name, type, line, column);
        
        // If there's an initializer, analyze it
        if (node.initializer) {
            const initType = this.analyzeNode(node.initializer);
            
            // Type checking
            if (initType !== type) {
                this.addError(
                    `Type mismatch in initialization: Cannot assign ${initType} to ${type}`,
                    line, column
                );
            }
            
            // Mark as initialized
            this.markInitialized(name);
        } else {
            // Warning for uninitialized variable
            this.addWarning(
                `Variable '${name}' declared but not initialized`,
                line, column
            );
        }
        
        return type;
    }

    /**
     * Analyze assignment statement
     */
    private analyzeAssignment(node: any): string | null {
        const name = node.identifier.value;
        const line = node.line;
        const column = node.column;
        
        // Check if variable exists
        const symbol = this.getSymbol(name);
        if (!symbol) {
            this.addError(
                `Assignment to undeclared variable '${name}'`,
                line, column
            );
            return null;
        }
        
        // Mark as initialized and used
        this.markInitialized(name);
        this.markUsed(name);
        
        // Type check the expression
        const exprType = this.analyzeNode(node.expression);
        if (exprType !== symbol.type) {
            this.addError(
                `Type mismatch in assignment: Cannot assign ${exprType} to ${symbol.type}`,
                line, column
            );
        }
        
        return symbol.type;
    }

    /**
     * Analyze if statement
     */
    private analyzeIfStatement(node: any): string | null {
        // Check condition type
        const conditionType = this.analyzeNode(node.condition);
        if (conditionType !== 'boolean') {
            this.addError(
                `If condition must be boolean, got ${conditionType}`,
                node.line, node.column
            );
        }
        
        // Analyze then-branch
        this.analyzeNode(node.thenBranch);
        
        // Analyze else-branch if it exists
        if (node.elseBranch) {
            this.analyzeNode(node.elseBranch);
        }
        
        return null;
    }

    /**
     * Analyze while statement
     */
    private analyzeWhileStatement(node: any): string | null {
        // Check condition type
        const conditionType = this.analyzeNode(node.condition);
        if (conditionType !== 'boolean') {
            this.addError(
                `While condition must be boolean, got ${conditionType}`,
                node.line, node.column
            );
        }
        
        // Analyze body
        this.analyzeNode(node.body);
        
        return null;
    }

    /**
     * Analyze print statement
     */
    private analyzePrintStatement(node: any): string | null {
        // Just analyze the expression to ensure it's valid
        this.analyzeNode(node.expression);
        return null;
    }

    /**
     * Analyze binary expression
     */
    private analyzeBinaryExpression(node: any): string | null {
        const leftType = this.analyzeNode(node.left);
        const rightType = this.analyzeNode(node.right);
        const operator = node.operator;
        
        // Type checking based on operator
        switch (operator) {
            case '+':
                // Addition works only on int
                if (leftType !== 'int' || rightType !== 'int') {
                    this.addError(
                        `Operator '+' can only be applied to integers`,
                        node.line, node.column
                    );
                    return 'int'; // Assume int for error recovery
                }
                return 'int';
                
            case '==':
            case '!=':
                // Equality operators require same types
                if (leftType !== rightType) {
                    this.addError(
                        `Cannot compare ${leftType} with ${rightType}`,
                        node.line, node.column
                    );
                }
                return 'boolean';
                
            // Add other operators as needed
            
            default:
                this.addError(
                    `Unknown operator: ${operator}`,
                    node.line, node.column
                );
                return null;
        }
    }

    /**
     * Analyze identifier reference
     */
    private analyzeIdentifier(node: any): string | null {
        const name = node.value;
        
        // Look up the symbol
        const symbol = this.getSymbol(name);
        if (!symbol) {
            this.addError(
                `Undefined variable '${name}'`,
                node.line, node.column
            );
            return null;
        }
        
        // Mark as used
        this.markUsed(name);
        
        // Check if it's initialized
        if (!symbol.initialized) {
            this.addWarning(
                `Using uninitialized variable '${name}'`,
                node.line, node.column
            );
        }
        
        return symbol.type;
    }

    // ===== Scope Management Methods =====

    /**
     * Enter a new scope
     */
    private enterScope(): void {
        this.currentScope++;
        this.scopeStack.push(this.currentScope);
    }

    /**
     * Exit the current scope
     */
    private exitScope(): void {
        // Check for unused variables in the scope we're exiting
        this.checkForUnusedVariables(this.currentScope);
        
        this.scopeStack.pop();
        this.currentScope = this.scopeStack[this.scopeStack.length - 1];
    }

    /**
     * Check for unused variables in a specific scope
     */
    private checkForUnusedVariables(scope: number): void {
        this.symbolTable.forEach((entries, name) => {
            entries.forEach(entry => {
                if (entry.scope === scope) {
                    if (!entry.used) {
                        this.addWarning(
                            `Variable '${name}' declared but never used`,
                            entry.line, entry.column
                        );
                    }
                    if (entry.initialized && !entry.used) {
                        this.addWarning(
                            `Variable '${name}' initialized but never used`,
                            entry.line, entry.column
                        );
                    }
                }
            });
        });
    }

    // ===== Symbol Table Methods =====

    /**
     * Add a symbol to the symbol table
     */
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
        
        // Check for redeclaration in the same scope
        const existingEntries = this.symbolTable.get(name) || [];
        for (const existing of existingEntries) {
            if (existing.scope === this.currentScope) {
                this.addError(
                    `Redeclaration of '${name}' in the same scope`,
                    line, column
                );
                return;
            }
        }
        
        // Add the new entry
        existingEntries.push(entry);
        this.symbolTable.set(name, existingEntries);
    }

    /**
     * Get a symbol from the symbol table
     * Returns the closest scoped variable visible from current scope
     */
    private getSymbol(name: string): SymbolTableEntry | null {
        const entries = this.symbolTable.get(name);
        if (!entries || entries.length === 0) {
            return null;
        }
        
        // Find the entry in the most immediate enclosing scope
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const currentScope = this.scopeStack[i];
            
            for (const entry of entries) {
                if (entry.scope <= currentScope) {
                    return entry;
                }
            }
        }
        
        return null;
    }

    /**
     * Mark a symbol as initialized
     */
    private markInitialized(name: string): void {
        const symbol = this.getSymbol(name);
        if (symbol) {
            symbol.initialized = true;
        }
    }

    /**
     * Mark a symbol as used
     */
    private markUsed(name: string): void {
        const symbol = this.getSymbol(name);
        if (symbol) {
            symbol.used = true;
        }
    }

    // ===== Error Handling Methods =====

  /*  
     * Add an error to the issues list
     */
    private addError(message: string, line: number, column: number): void {
        this.issues.push({
            type: 'error',
            message,
            line,
            column
        });
    }

    /**
     * Add a warning to the issues list
     */
    private addWarning(message: string, line: number, column: number): void {
        this.issues.push({
            type: 'warning',
            message,
            line,
            column
        });
    } 
}

// Export for browser
declare global {
    interface Window {
        SemanticAnalyzer: typeof SemanticAnalyzer;
    }
}

(window as any).SemanticAnalyzer = SemanticAnalyzer;