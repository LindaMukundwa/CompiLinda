import { LexerLog, Token, TokenType } from './main';
import { ASTNode as CSTNode } from './parser';

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
    isInitialized: boolean;  // Changed from 'initialized'
    isUsed: boolean;        // Changed from 'used'
}

// Define error/warning types
interface SemanticIssue {
    type: 'error' | 'warning';
    message: string;
    line: number;
    column: number;

}


export class ASTAdapter {

    public static convert(cstRoot: CSTNode): ASTNode | null {
        if (!cstRoot) return null;
        return this.convertNode(cstRoot);
    }

    /**
     * Convert a CST node to an AST node
     */
    private static convertNode(cstNode: CSTNode): ASTNode | null {
        if (!cstNode) return null;

        // Get line and column from token or first child if available
        const line = cstNode.token?.line || cstNode.children?.[0]?.token?.line || 0;
        const column = cstNode.token?.column || cstNode.children?.[0]?.token?.column || 0;

        switch (cstNode.name) {
            case 'Programs':
                return this.convertPrograms(cstNode, line, column);
            case 'Program':
                return this.convertProgram(cstNode, line, column);
            case 'Block':
                return this.convertBlock(cstNode, line, column);
            case 'PrintStatement':
                return this.convertPrintStatement(cstNode, line, column);
            case 'VariableDeclaration':
                return this.convertVarDeclaration(cstNode, line, column);
            case 'AssignmentStatement':
                return this.convertAssignment(cstNode, line, column);
            case 'WhileStatement':
                return this.convertWhileStatement(cstNode, line, column);
            case 'IfStatement':
                return this.convertIfStatement(cstNode, line, column);
            case 'BooleanExpression':
                return this.convertBooleanExpression(cstNode, line, column);
            case 'Expression':
                return this.convertExpression(cstNode, line, column);
            case 'StringExpression':
                return this.convertStringExpression(cstNode, line, column);
            case 'StatementList':
                // Handle empty statement lists
                if (!cstNode.children || cstNode.children.length === 0) {
                    return {
                        type: NodeType.Block,
                        line,
                        column,
                        children: []
                    };
                }
                // Convert all statements in the list
                const statements: ASTNode[] = [];
                for (const child of cstNode.children) {
                    const converted = this.convertNode(child);
                    if (converted) statements.push(converted);
                }
                return {
                    type: NodeType.Block,
                    line,
                    column,
                    children: statements
                };
            case 'Identifier':
                return {
                    type: NodeType.Identifier,
                    name: cstNode.token?.value || '',
                    line,
                    column,
                    value: cstNode.token?.value || ''
                };
            default:
                // Try to process children for unknown node types
                if (cstNode.children?.length) {
                    return this.convertNode(cstNode.children[0]);
                }
                return null;
        }
    }

    /**
     * Convert a Programs node (the root of multiple programs)
     */
    private static convertPrograms(cstNode: CSTNode, line: number, column: number): ASTNode {
        const programs: ASTNode[] = [];

        for (const child of cstNode.children) {
            const programNode = this.convertNode(child);
            if (programNode) {
                programs.push(programNode);
            }
        }

        // Return the first program or create a Program node container
        return programs.length === 1 ? programs[0] : {
            type: NodeType.Program,
            line,
            column,
            children: programs
        };
    }

    /**
     * Convert a Program node
     */
    private static convertProgram(cstNode: CSTNode, line: number, column: number): ASTNode {
        const children: ASTNode[] = [];

        // Convert all relevant children (not just Block)
        for (const child of cstNode.children) {
            if (child.name === 'Block' || this.isStatementNode(child)) {
                const node = this.convertNode(child);
                if (node) {
                    children.push(node);
                }
            }
        }

        return {
            type: NodeType.Program,
            line,
            column,
            children
        };
    }

    /**
     * Convert a Block node
     */
    private static convertBlock(cstNode: CSTNode, line: number, column: number): ASTNode {
        // Find the StatementList child if it exists
        const statementList = cstNode.children.find(child => child.name === 'StatementList');

        let children: ASTNode[] = [];
        if (statementList) {
            // Convert all statements in the list
            for (const statement of statementList.children) {
                const converted = this.convertNode(statement);
                if (converted) children.push(converted);
            }
        }

        return {
            type: NodeType.Block,
            line,
            column,
            children
        };
    }

    // Helper to check if a node is a statement type
    private static isStatementNode(node: CSTNode): boolean {
        return [
            'PrintStatement',
            'VariableDeclaration',
            'AssignmentStatement',
            'WhileStatement',
            'IfStatement'
        ].includes(node.name);
    }

    /**
     * Convert a PrintStatement node
     */
    private static convertPrintStatement(cstNode: CSTNode, line: number, column: number): ASTNode {
        let expression: ASTNode | null = null;

        // Find the expression child
        for (const child of cstNode.children) {
            if (child.name === 'Expression' || child.name === 'StringExpression') {
                expression = this.convertNode(child);
                break;
            }
        }

        return {
            type: NodeType.PrintStatement,
            line,
            column,
            expression: expression || {
                type: NodeType.StringLiteral,
                line,
                column,
                value: ""
            }
        };
    }

    /**
     * Convert a VariableDeclaration node
     */
    private static convertVarDeclaration(cstNode: CSTNode, line: number, column: number): ASTNode {
        const typeNode = cstNode.children.find(c => c.name === 'Type');
        const identNode = cstNode.children.find(c => c.name === 'Identifier');

        // Create children array with type and identifier nodes
        const children: ASTNode[] = [];
        
        // Add type node
        if (typeNode) {
            children.push({
                type: NodeType.Identifier,
                name: this.getTypeFromNode(typeNode),
                line: typeNode.token?.line || line,
                column: typeNode.token?.column || column
            });
        }

        // Add identifier node
        if (identNode) {
            children.push({
                type: NodeType.Identifier,
                name: identNode.token?.value || '',
                line: identNode.token?.line || line,
                column: identNode.token?.column || column
            });
        }

        return {
            type: NodeType.VarDeclaration,
            line,
            column,
            children,
            varName: identNode?.token?.value || '',
            varType: this.getTypeFromNode(typeNode)
        };
    }

    private static getTypeFromNode(typeNode: CSTNode | undefined): string {
        if (!typeNode) return 'unknown';
        const typeChild = typeNode.children[0];
        switch (typeChild?.name) {
            case 'IntType': return 'int';
            case 'StringType': return 'string';
            case 'BooleanType': return 'boolean';
            default: return 'unknown';
        }
    }
    /**
     * Convert an AssignmentStatement node
     */
    private static convertAssignment(cstNode: CSTNode, line: number, column: number): ASTNode {
        let identifier: ASTNode | null = null;
        let expression: ASTNode | null = null;

        // Find identifier and expression
        for (const child of cstNode.children) {
            if (child.name === 'Identifier') {
                identifier = this.convertNode(child);
            } else if (child.name === 'Expression' || child.name === 'StringExpression') {
                // For string expressions, we need to preserve the actual string value
                if (child.name === 'StringExpression') {
                    expression = this.convertStringExpression(child, line, column);
                } else {
                    expression = this.convertNode(child);
                }
            }
        }

        return {
            type: NodeType.AssignmentStatement,
            line,
            column,
            identifier: identifier || {
                type: NodeType.Identifier,
                line,
                column,
                name: "",
                value: ""
            },
            expression: expression || {
                type: NodeType.StringLiteral,
                line,
                column,
                value: ""
            }
        };
    }

    /**
     * Convert a WhileStatement node
     */
    private static convertWhileStatement(cstNode: CSTNode, line: number, column: number): ASTNode {
        let condition: ASTNode | null = null;
        let body: ASTNode | null = null;

        // Find condition and body
        for (const child of cstNode.children) {
            if (child.name === 'BooleanExpression') {
                condition = this.convertNode(child);
            } else if (child.name === 'Block') {
                body = this.convertNode(child);
            }
        }

        return {
            type: NodeType.WhileStatement,
            line,
            column,
            condition: condition || {
                type: NodeType.BooleanLiteral,
                line,
                column,
                value: false
            },
            body: body || {
                type: NodeType.Block,
                line,
                column,
                children: []
            }
        };
    }

    /**
     * Convert an IfStatement node
     */
    private static convertIfStatement(cstNode: CSTNode, line: number, column: number): ASTNode {
        let condition: ASTNode | null = null;
        let thenBranch: ASTNode | null = null;
        let elseBranch: ASTNode | null = null;

        // Find condition, then block, and optional else block
        const children = cstNode.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (child.name === 'BooleanExpression') {
                condition = this.convertNode(child);
            } else if (child.name === 'Block') {
                // First block is the 'then' branch
                if (!thenBranch) {
                    thenBranch = this.convertNode(child);
                }
                // Second block (after "else") is the 'else' branch
                else if (i > 0 && children[i - 1].name === 'ElseKeyword') {
                    elseBranch = this.convertNode(child);
                }
            }
        }

        return {
            type: NodeType.IfStatement,
            line,
            column,
            condition: condition || {
                type: NodeType.BooleanLiteral,
                line,
                column,
                value: false
            },
            thenBranch: thenBranch || {
                type: NodeType.Block,
                line,
                column,
                children: []
            },
            elseBranch
        };
    }

    /**
     * Convert a BooleanExpression node
     */
    private static convertBooleanExpression(cstNode: CSTNode, line: number, column: number): ASTNode {
        let left: ASTNode | null = null;
        let right: ASTNode | null = null;
        let operator = "=="; // Default

        // Find the operands and operator
        for (const child of cstNode.children) {
            if (child.name === 'Expression') {
                if (!left) {
                    left = this.convertNode(child);
                } else {
                    right = this.convertNode(child);
                }
            } else if (child.name === 'EqualsOp') {
                operator = "==";
            } else if (child.name === 'NotEqualsOp') {
                operator = "!=";
            }
        }

        return {
            type: NodeType.BinaryExpression,
            line,
            column,
            operator,
            left: left || {
                type: NodeType.IntegerLiteral,
                line,
                column,
                value: 0
            },
            right: right || {
                type: NodeType.IntegerLiteral,
                line,
                column,
                value: 0
            }
        };
    }

    /**
     * Convert an Expression node
     */
    private static convertExpression(cstNode: CSTNode, line: number, column: number): ASTNode {
        for (const child of cstNode.children) {
            if (child.name === 'Identifier' && child.token) {
                return {
                    type: NodeType.Identifier,
                    line,
                    column,
                    name: child.token.value || "",
                    value: child.token.value || ""
                };
            } else if (child.name === 'IntLiteral' && child.token) {
                // Handle integer literals
                const intValue = parseInt(child.token.value, 10);
                return {
                    type: NodeType.IntegerLiteral,
                    line,
                    column,
                    value: isNaN(intValue) ? 0 : intValue
                };
            } else if (child.name === 'BooleanLiteral' && child.token) {
                // Handle boolean literals directly
                const boolValue = child.token.value === 'true';
                return {
                    type: NodeType.BooleanLiteral,
                    line,
                    column,
                    value: boolValue
                };
            } else if ((child.name === 'Digit' || child.name === 'Digits') && child.token) {
                // Handle numeric values possibly represented as digits
                const intValue = parseInt(child.token.value, 10);
                return {
                    type: NodeType.IntegerLiteral,
                    line,
                    column,
                    value: isNaN(intValue) ? 0 : intValue
                };
            } else if (child.name === 'true' || child.name === 'false') {
                // Direct boolean keywords
                return {
                    type: NodeType.BooleanLiteral,
                    line,
                    column,
                    value: child.name === 'true'
                };
            }
        }

        // If we couldn't find a more specific type, search for any token with a value
        for (const child of cstNode.children) {
            if (child.token && child.token.value !== undefined) {
                // Try to determine the type from the value
                const value = child.token.value;

                // Check if it's a number
                if (!isNaN(Number(value))) {
                    return {
                        type: NodeType.IntegerLiteral,
                        line,
                        column,
                        value: parseInt(value, 10)
                    };
                }

                // Check if it's a boolean
                if (value === 'true' || value === 'false') {
                    return {
                        type: NodeType.BooleanLiteral,
                        line,
                        column,
                        value: value === 'true'
                    };
                }

                // Default to treating it as an identifier
                return {
                    type: NodeType.Identifier,
                    line,
                    column,
                    name: value,
                    value: value
                };
            }
        }

        // Default to integer literal if nothing else matched
        return {
            type: NodeType.IntegerLiteral,
            line,
            column,
            value: 0
        };
    }

    /**
     * Convert a StringExpression node
     */
    private static convertStringExpression(cstNode: CSTNode, line: number, column: number): ASTNode {
        let value = "";
    
        // First check if there's a direct token value
        if (cstNode.token?.value) {
            // Remove quotes if present
            value = cstNode.token.value.replace(/^["']|["']$/g, '');
        } else if (cstNode.children && cstNode.children.length > 0) {
            // Build value from child character nodes
            for (const child of cstNode.children) {
                if (child.name === 'Char' && child.token?.value) {
                    value += child.token.value;
                }
            }
        }
    
        return {
            type: NodeType.StringLiteral,
            value,
            line,
            column
        };
    }
    
    

    // Add this to your ASTAdapter class
    private static debugNodeStructure(node: CSTNode): string {
        if (!node) return 'null';

        let result = `Node: ${node.name}, `;
        if (node.token) {
            result += `Token: {value: ${node.token.value}, line: ${node.token.line}, col: ${node.token.column}}, `;
        }

        if (node.children && node.children.length > 0) {
            result += `Children: [${node.children.map(c => c.name).join(', ')}]`;
        } else {
            result += 'No children';
        }

        return result;
    }
}


/**
 * Main Semantic Analyzer class
 */
export class SemanticAnalyzer {

    private ast: ASTNode | null = null;
    private currentScope: number = 0;       // Current scope level (increments with each block entry)
    private scopeStack: number[] = [0];     // Stack of scope levels to handle nested scopes
    private symbolTable: Map<string, SymbolTableEntry[]> = new Map();

    // Track semantic error
    private issues: SemanticIssue[] = [];

    private programCounter: number = 1;
    private lexerLogs: LexerLog[] = []; // Store lexer logs separately
    cst: any;


    constructor(cst: any, programNumber?: number) {
        try {
            console.log("SemanticAnalyzer initializing with CST:", cst);
            this.cst = cst;
    
            // Initialize with provided program number or default to 1
            this.programCounter = programNumber || 1;
    
            // Initialize all state fresh for each new instance
            this.ast = ASTAdapter.convert(cst);
            console.log("AST created:", this.ast);
    
            // FIXED: Initialize scope to 0 for global scope
            this.currentScope = 0;
            this.scopeStack = [-1];
            this.enterScope();
            this.symbolTable = new Map();
            this.issues = [];
            this.lexerLogs = [];
        } catch (error) {
            console.error("SemanticAnalyzer constructor error:", error);
            throw error;
        }
    }


    /**
     * Main analysis method
     * Returns analysis results including symbol table and issues
     */
    public analyze(): {
        symbolTable: Map<string, SymbolTableEntry[]>;
        issues: SemanticIssue[];
        ast: ASTNode | null;
        programNumber: number;
        
    } {
        if (!this.ast) {
            this.addError("Failed to generate AST from parser output", 0, 0);
            return {
                symbolTable: this.symbolTable,
                issues: this.issues,
                ast: null,
                programNumber: this.programCounter
            };
        }

        // Start the recursive analysis from the root of the AST
        this.analyzeNode(this.ast);

        // Check for any remaining unused variables in global scope
        this.checkForUnusedVariables(0);

        const hasErrors = this.issues.some(issue => issue.type === 'error');

        return {
            symbolTable: hasErrors ? new Map() : this.symbolTable,
            issues: this.issues,
            ast: this.ast,
            programNumber: this.programCounter
        };
    }

    /**
     * Print the analysis results in a readable format
     */
    public printResults(): string {
        let output = '';
        output += `Program ${this.programCounter} Symbol Table\n`;
        output += '--------------------------------------\n';
        output += 'Name\tType\tInit?\tUsed?\tScope\tLine\n';
        output += '-------------------------------------\n';

        const entries: SymbolTableEntry[] = [];
        this.symbolTable.forEach((symbolEntries, name) => {
            symbolEntries.forEach(entry => {
                entries.push({ ...entry, name });
            });
        });

        // Sort by scope and then by line number
        entries.sort((a, b) => {
            if (a.scope !== b.scope) return a.scope - b.scope;
            return a.line - b.line;
        });

        // Print each entry
        entries.forEach(entry => {
            output += `${entry.name}\t${entry.type}\t${entry.isInitialized}\t${entry.isUsed}\t${entry.scope}\t${entry.line}\n`;
        });

        return output;
    }

    /**
 * Print the AST in a readable format
 */

    public printAST(node: ASTNode | null = null, indent: string = ''): string {
        // If no node is provided, use the root AST
        const astNode = node || this.ast;
        if (!astNode) return 'No AST available';
    
        let output = '';
        
        // Call the private implementation
        output = this.printASTNode(astNode, indent);
        return output;
    }

    private printASTNode(node: ASTNode | null, indent: string = ''): string {
        if (!node) return '';

        let output = '';

        switch (node.type) {
            case NodeType.Program:
                output += `${indent}< PROGRAM >\n`;
                if (node.children) {
                    for (const child of node.children) {
                        output += this.printASTNode(child, indent + '-');
                    }
                }
                break;
            case NodeType.Block:
                output += `${indent}< BLOCK >\n`;
                if (node.children) {
                    for (const child of node.children) {
                        output += this.printASTNode(child, indent + '-');
                    }
                }
                break;
            case NodeType.VarDeclaration:
                output += `${indent}< Variable Declaration >\n`;
                output += `${indent}--[ ${node.varType} ]\n`;
                output += `${indent}--[ ${node.varName} ]\n`;
                break;
            case NodeType.PrintStatement:
                output += `${indent}< Print Statement >\n`;
                if (node.expression) {
                    output += this.printASTNode(node.expression, indent + '--');
                }
                break;
            case NodeType.AssignmentStatement:
                output += `${indent}< Assignment Statement >\n`;
                if (node.identifier) {
                    output += `${indent}---[ ${node.identifier.value || node.identifier.name} ]\n`;
                }
                if (node.expression) {
                    if (node.expression.type === NodeType.IntegerLiteral) {
                        output += `${indent}---[ ${node.expression.value} ]\n`;
                    } else if (node.expression.type === NodeType.StringLiteral) {
                        console.log("Assigning string value:", node.expression.value);
                        output += `${indent}---[ ${node.expression.value} ]\n`;
                    } else if (node.expression.type === NodeType.BooleanLiteral) {
                        output += `${indent}---[ ${node.expression.value ? 'true' : 'false'} ]\n`;
                    } else {
                        output += this.printASTNode(node.expression, indent + '---');
                    }
                }
                break;
            case NodeType.Identifier:
                output += `${indent}[ ${node.name || node.value} ]\n`;
                break;
            case NodeType.IntegerLiteral:
                output += `${indent}[ ${node.value} ]\n`;
                break;
            case NodeType.StringLiteral:
                output += `${indent}[ ${node.value} ]\n`;
                break;
            case NodeType.BooleanLiteral:
                output += `${indent}[ ${node.value ? 'true' : 'false'} ]\n`;
                break;
            case NodeType.IfStatement:
                output += `${indent}< If Statement >\n`;
                output += `${indent}--< Condition >\n`;
                if (node.condition) {
                    output += this.printAST(node.condition, indent + '----');
                }
                output += `${indent}--< Then >\n`;
                if (node.thenBranch) {
                    output += this.printAST(node.thenBranch, indent + '----');
                }
                if (node.elseBranch) {
                    output += `${indent}--< Else >\n`;
                    output += this.printAST(node.elseBranch, indent + '----');
                }
                break;
            case NodeType.WhileStatement:
                output += `${indent}< While Statement >\n`;
                output += `${indent}--< Condition >\n`;
                if (node.condition) {
                    output += this.printAST(node.condition, indent + '----');
                }
                output += `${indent}--< Body >\n`;
                if (node.body) {
                    output += this.printAST(node.body, indent + '----');
                }
                break;
            case NodeType.BinaryExpression:
                output += `${indent}< Binary Expression >\n`;
                output += `${indent}--[ ${node.operator} ]\n`;
                if (node.left) {
                    output += this.printAST(node.left, indent + '----');
                }
                if (node.right) {
                    output += this.printAST(node.right, indent + '----');
                }
                break;
            default:
                output += `${indent}< ${NodeType[node.type]} >\n`;
                if (node.children) {
                    for (const child of node.children) {
                        output += this.printAST(child, indent + '--');
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
        // The program node itself doesn't create a new scope
        // Just process all its children
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
        // Enter a new scope ONLY for Block nodes, not Program nodes
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
        const type = node.varType;
        const name = node.varName;
        const line = node.line;
        const column = node.column;

        // Add to symbol table - starts as uninitialized and unused
        this.addSymbol(name, type, line, column);

        return type;
    }

    /**
     * Analyze assignment statement
     */
    private analyzeAssignment(node: any): string | null {
        const name = node.identifier.name || node.identifier.value;
        const line = node.line;
        const column = node.column;
    
        // Check if variable exists
        const symbol = this.getSymbol(name);
        if (!symbol) {
            this.addError(`Assignment to undeclared variable '${name}'`, line, column);
            return null;
        }
    
        // Mark as initialized
        this.markInitialized(name);
    
        // Get expression type based on node type
        let exprType: string;
        
        if (node.expression.type === NodeType.StringLiteral) {
            exprType = 'string';
        } else if (node.expression.type === NodeType.IntegerLiteral) {
            exprType = 'int';
        } else if (node.expression.type === NodeType.BooleanLiteral) {
            exprType = 'boolean';
        } else if (node.expression.type === NodeType.Identifier) {
            // For identifiers, get the type from the symbol table
            const exprSymbol = this.getSymbol(node.expression.name);
            if (!exprSymbol) {
                this.addError(`Undefined variable '${node.expression.name}' in expression`, line, column);
                return null;
            }
            exprType = exprSymbol.type;
        } else {
            // For other expressions, analyze recursively
            exprType = this.analyzeNode(node.expression) || 'unknown';
        }
        
        // Compare types
        if (symbol.type !== exprType) {
            this.addError(
                `Type mismatch in assignment: Cannot assign ${exprType} to ${symbol.type}`,
                line, column
            );
        }
    
        return symbol.type;
    }
    
    // Helper method to normalize type names for comparison
    private normalizeType(type: string): string {
        // Make sure types match exactly as strings
        type = type.toLowerCase();
        if (type === 'boolean') return 'boolean';
        if (type === 'int' || type === 'integer') return 'int';
        if (type === 'string') return 'string';
        return type;
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
                // Addition works for both int and string in many languages
                if (leftType === 'int' && rightType === 'int') {
                    return 'int';
                } else if (leftType === 'string' && rightType === 'string') {
                    return 'string';
                } else {
                    this.addError(
                        `Type mismatch for operator '+': cannot combine ${leftType} and ${rightType}`,
                        node.line, node.column
                    );
                    return leftType; // Return something for error recovery
                }

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
        const name = node.name || node.value;
        const symbol = this.getSymbol(name);
        
        if (!symbol) {
            this.addError(`Undefined variable '${name}'`, node.line, node.column);
            return null;
        }
    
        // Mark as used
        this.markUsed(name);
        
        return symbol.type;
    }

    // ===== Scope Management Methods =====

    /**
     * Enter a new scope
     */
    private enterScope(): void {
        // Increment scope counter when entering a new block
        this.currentScope++;
        this.scopeStack.push(this.currentScope);
        console.log(`Entering scope ${this.currentScope}, stack: [${this.scopeStack.join(', ')}]`);
    }

    private exitScope(): void {
        // Check for unused variables before exiting
        this.checkForUnusedVariables(this.currentScope);
        
        // Remove the current scope from stack
        this.scopeStack.pop();
        
        // Set current scope to the previous one on stack
        this.currentScope = this.scopeStack[this.scopeStack.length - 1];
        console.log(`Exiting to scope ${this.currentScope}, stack: [${this.scopeStack.join(', ')}]`);
    }

    /**
     * Check for unused variables in a specific scope
     */
    /* private checkForUnusedVariables(scope: number): void {
        this.symbolTable.forEach((entries, name) => {
            entries.forEach(entry => {
                if (entry.scope === scope) {
                    if (!entry.isUsed) {
                        this.addWarning(
                            `Variable '${name}' declared but never used`,
                            entry.line, entry.column
                        );
                    }
                    if (entry.isInitialized && !entry.isUsed) {
                        this.addWarning(
                            `Variable '${name}' initialized but never used`,
                            entry.line, entry.column
                        );
                    }
                }
            });
        });
    } */

    private checkForUnusedVariables(scope: number): void {
        for (const [name, entries] of this.symbolTable.entries()) {
            for (const entry of entries) {
                // Only warn if it wasn't reported as an error before
                const alreadyErrored = this.issues.some(i => i.message.includes(name) && i.type === 'error');
                if (!alreadyErrored) {
                    if (!entry.isUsed) {
                        this.addWarning(`Variable '${name}' declared but never used`, entry.line, entry.column);
                    }
                    if (entry.isInitialized && !entry.isUsed) {
                        this.addWarning(`Variable '${name}' initialized but never used`, entry.line, entry.column);
                    }
                }
            }
        }
        
    }

    // ===== Symbol Table Methods =====

    /**
     * Add a symbol to the symbol table
     */
    private addSymbol(name: string, type: string, line: number, column: number): void {
        const entry: SymbolTableEntry = {
            name,
            type,
            scope: this.currentScope, // This should now be correct
            line,
            column,
            isInitialized: false,
            isUsed: false
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
        console.log(`Added symbol: ${name}, type: ${type}, scope: ${this.currentScope}`);
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
            symbol.isInitialized = true;
        }
    }

    /**
     * Mark a symbol as used
     */
    private markUsed(name: string): void {
        const symbol = this.getSymbol(name);
        if (symbol) {
            symbol.isUsed = true;
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

    // Add method to reset state for next program
    public resetForNextProgram(): void {
        this.currentScope = 0;
        this.scopeStack = [0];
        this.symbolTable.clear();
        this.issues = [];
        // Don't reset programCounter as it should continue incrementing
    }
}

// Export for browser
declare global {
    interface Window {
        SemanticAnalyzer: typeof SemanticAnalyzer;
    }
}

// Browser exposure
if (typeof window !== 'undefined') {
    window.SemanticAnalyzer = SemanticAnalyzer;
}