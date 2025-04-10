/**
 * AST Adapter - Converts CST from Parser to AST for Semantic Analyzer
 */

import { ASTNode as CSTNode } from './parser';
import { ASTNode, NodeType } from './semanticAnalyzer';

export class ASTAdapter {


    /**
     * Convert the CST from the Parser to the AST format expected by SemanticAnalyzer
     */
    public static convert(cstRoot: CSTNode): ASTNode | null {
        if (!cstRoot) return null;

        // Start conversion at the root
        return this.convertNode(cstRoot);
    }

    /**
     * Convert a CST node to an AST node
     */
    private static convertNode(cstNode: CSTNode): ASTNode | null {
        if (!cstNode) return null;

        // Get line and column from token if available
        const line = cstNode.token?.line || 0;
        const column = cstNode.token?.column || 0;

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
                if (cstNode.children && cstNode.children.length > 0) {
                    // For nodes that just pass through to children
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
        const children: ASTNode[] = [];
        
        // Process statements if they exist
        for (const child of cstNode.children) {
            if (child.name === 'StatementList') {
                for (const statement of child.children) {
                    const statementNode = this.convertNode(statement);
                    if (statementNode) {
                        children.push(statementNode);
                    }
                }
            }
        }
        
        // Return Block node even if empty
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
        let type = "";
        let name = "";

        // Extract the type
        const typeNode = cstNode.children.find(child => child.name === 'Type');
        if (typeNode && typeNode.children.length > 0) {
            const typeChild = typeNode.children[0];
            if (typeChild.name === 'IntType') {
                type = "int";
            } else if (typeChild.name === 'StringType') {
                type = "string";
            } else if (typeChild.name === 'BooleanType') {
                type = "boolean";
            }
        }

        // Extract the identifier name
        const identNode = cstNode.children.find(child => child.name === 'Identifier');
        if (identNode && identNode.token) {
            name = identNode.token.value;
        }

        return {
            type: NodeType.VarDeclaration,
            line,
            column,
            varName: name,
            varType: type,
            initializer: null // No initializer in your grammar
        };
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
                expression = this.convertNode(child);
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
        // In your grammar, expressions are just identifiers or literals
        for (const child of cstNode.children) {
            if (child.name === 'Identifier') {
                return {
                    type: NodeType.Identifier,
                    line,
                    column,
                    name: child.token?.value || "",
                    value: child.token?.value || ""
                };
            }
        }

        // Default to integer literal if no specific type found
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
        // Extract all character tokens to form the string
        let value = "";

        for (const child of cstNode.children) {
            if (child.name === 'Char' && child.token) {
                value += child.token.value;
            }
        }

        return {
            type: NodeType.StringLiteral,
            line,
            column,
            value
        };
    }
}

// Export for browser
declare global {
    interface Window {
        astAdapter: typeof ASTAdapter;
    }
}

(window as any).astAdapter = ASTAdapter;