/**
 * AST Adapter - Converts CST from Parser to AST for Semantic Analyzer
 */

import { ASTNode as CSTNode } from './parser';
import { ASTNode, NodeType } from './semanticAnalyzer';

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
        
        return {
            type: NodeType.VarDeclaration,
            line,
            column,
            varName: identNode?.token?.value || '',
            varType: this.getTypeFromNode(typeNode),
            initializer: null // Will be set during semantic analysis
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

// Type declaration for global scope
declare global {
    interface Window {
        ASTAdapter: typeof ASTAdapter;
    }
}

// Export for both module and browser environments
const exportAdapter = {
    ASTAdapter
};

if (typeof window !== 'undefined') {
    (window as any).ASTAdapter = ASTAdapter;
}
export default ASTAdapter;