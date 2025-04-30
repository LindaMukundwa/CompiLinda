/**
 * 6502a Code Generator
 * 
 * This class handles the generation of 6502a machine code from an AST for the compiler
 */

import { ASTAdapter, NodeType } from "./combinedAnalyzer";
//import { Lexer } from "./main";

// Define opcodes for 6502a instruction set
const OPCODES = {
    LDA_CONST: 0xA9,  // Load accumulator with constant
    LDA_MEM: 0xAD,    // Load accumulator from memory
    STA: 0x8D,        // Store accumulator in memory
    ADC: 0x6D,        // Add with carry
    LDX_CONST: 0xA2,  // Load X register with constant
    LDX_MEM: 0xAE,    // Load X register from memory
    LDY_CONST: 0xA0,  // Load Y register with constant
    LDY_MEM: 0xAC,    // Load Y register from memory
    NOP: 0xEA,        // No operation
    BRK: 0x00,        // Break
    CPX: 0xEC,        // Compare X register with memory
    BNE: 0xD0,        // Branch if not equal
    INC: 0xEE,        // Increment value
    SYS: 0xFF         // System call
};

// Define system call types
const SYSCALLS = {
    PRINT_INT: 0x01,
    PRINT_STRING: 0x02
};

// Special values for boolean representation
const BOOLEAN_VALUES = {
    TRUE: 0xF5,  // Representing "true"
    FALSE: 0xF0  // Representing "false"
};

// Define the structure of our AST node
interface ASTNode {
    type: NodeType;
    name?: string;
    value?: any;
    children?: ASTNode[];
    line?: number;
    column?: number;
    operator?: string; // Add operator property for binary expressions
}

// Define the structure for a symbol in the symbol table
interface Symbol {
    type: string | NodeType; // Allow both string and NodeType
    name: string;
    address: number;
    scope: number;
}

class CodeGenerator {
    private code: number[] = [];
    private staticTable: { [key: string]: number } = {};
    private stringPool: { [key: string]: number } = {};
    private staticStart = 0x0086; // Starting address for static data
    private heapStart = 0x00E0;   // Starting address for heap (strings)
    private currentHeapAddress = 0x00E0;
    private symbolTable: Symbol[] = [];
    private tempCounter = 0;
    private currentScope = 0;

    constructor() {
        // Initialize
    }

    /**
     * Generates code from AST
     */
    public generate(ast: ASTNode): number[] {
        // Reset state for a new compilation
        this.code = [];
        this.staticTable = {};
        this.stringPool = {};
        this.currentHeapAddress = this.heapStart;
        this.tempCounter = 0;
        this.currentScope = 0;

        // Generate code for the AST
        this.visit(ast);

        // Add break instruction at the end
        this.emitByte(OPCODES.BRK);

        // Fill memory with zeroes up to where the string constants begin
        while (this.code.length < this.heapStart - 1) {
            this.emitByte(0x00);
        }

        // Add string constants to the end of the code
        this.addStringConstants();

        return this.code;
    }

    /**
     * Main visitor function that dispatches to the appropriate code generator
     */
    private visit(node: ASTNode): void {
        switch (node.type) {
            case NodeType.Block:
                this.generateBlock(node);
                break;
            case NodeType.VarDeclaration:
                this.generateVarDecl(node);
                break;
            case NodeType.AssignmentStatement:
                this.generateAssignment(node);
                break;
            case NodeType.PrintStatement:
                this.generatePrintStatement(node);
                break;
            case NodeType.IfStatement:
                this.generateIfStatement(node);
                break;
            case NodeType.WhileStatement:
                this.generateWhileStatement(node);
                break;
            case NodeType.BinaryExpression:
                this.generateComparison(node);
                break;
            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

    /**
     * Generate code for a block
     */
    private generateBlock(node: ASTNode): void {
        // Enter a new scope
        this.currentScope++;

        // Generate code for each child node
        if (node.children) {
            node.children.forEach(child => {
                this.visit(child);
            });
        }

        // Exit the scope
        this.currentScope--;
    }

    /**
     * Generate code for variable declaration
     */
    private generateVarDecl(node: ASTNode): void {
        if (!node.children || node.children.length < 2) {
            throw new Error('Invalid VarDeclaration node');
        }

        const type = node.children[0].type;
        const name = node.children[1].name;

        if (!name) {
            throw new Error('Variable name not found');
        }

        // Allocate memory for the variable
        const address = this.allocateStatic(name);

        // Add to symbol table
        this.symbolTable.push({
            type,
            name,
            address,
            scope: this.currentScope
        });

        // Initialize variable to default value (0)
        this.emitLdaConst(0x00);
        this.emitSta(address);
    }

    /**
     * Generate code for assignment statement
     */
    private generateAssignment(node: ASTNode): void {
        if (!node.children || node.children.length < 2) {
            throw new Error('Invalid AssignmentStatement node');
        }

        const varName = node.children[0].name;
        const valueNode = node.children[1];

        if (!varName) {
            throw new Error('Variable name not found');
        }

        // Find variable in symbol table
        const symbol = this.findSymbol(varName);

        if (!symbol) {
            throw new Error(`Undefined variable: ${varName}`);
        }

        // Generate code based on the value type
        if (valueNode.type === NodeType.IntegerLiteral) {
            // Integer assignment
            this.emitLdaConst(valueNode.value);
            this.emitSta(symbol.address);
        } else if (valueNode.type === NodeType.BooleanLiteral) {
            // Boolean assignment
            const boolValue = valueNode.value === true ? BOOLEAN_VALUES.TRUE : BOOLEAN_VALUES.FALSE;
            this.emitLdaConst(boolValue);
            this.emitSta(symbol.address);
        } else if (valueNode.type === NodeType.StringLiteral) {
            // String assignment
            const stringAddr = this.getStringAddress(valueNode.value);
            this.emitLdaConst(stringAddr);
            this.emitSta(symbol.address);
        } else if (valueNode.type === NodeType.Identifier) {
            // Variable-to-variable assignment
            const sourceSymbol = this.findSymbol(valueNode.name!);
            if (!sourceSymbol) {
                throw new Error(`Undefined variable: ${valueNode.name}`);
            }
            this.emitLdaMem(sourceSymbol.address);
            this.emitSta(symbol.address);
        } else {
            throw new Error(`Unsupported value type: ${valueNode.type}`);
        }
    }

    /**
     * Generate code for print statement
     */
    private generatePrintStatement(node: ASTNode): void {
        if (!node.children || node.children.length === 0) {
            throw new Error('Invalid PrintStatement node');
        }

        const exprNode = node.children[0];

        if (exprNode.type === NodeType.IntegerLiteral) {
            // Print integer constant
            this.emitLdaConst(exprNode.value);
            this.generatePrintInt();
        } else if (exprNode.type === NodeType.BooleanLiteral) {
            // Print boolean constant
            const boolValue = exprNode.value === true ? BOOLEAN_VALUES.TRUE : BOOLEAN_VALUES.FALSE;
            this.emitLdaConst(boolValue);
            this.generatePrintBool();
        } else if (exprNode.type === NodeType.StringLiteral) {
            // Print string constant
            const stringAddr = this.getStringAddress(exprNode.value);
            this.emitLdyConst(stringAddr);
            this.emitLdxConst(SYSCALLS.PRINT_STRING);
            this.emitSys();
        } else if (exprNode.type === NodeType.Identifier) {
            // Print variable
            const symbol = this.findSymbol(exprNode.name!);

            if (!symbol) {
                throw new Error(`Undefined variable: ${exprNode.name}`);
            }

            // Load the variable value into Y register
            this.emitLdyMem(symbol.address);

            // Determine print type based on variable type
            if (symbol.type === 'int') {
                this.emitLdxConst(SYSCALLS.PRINT_INT);
                this.emitSys();
            } else if (symbol.type === 'boolean') {
                this.emitLdxConst(SYSCALLS.PRINT_STRING);
                this.emitSys();
            } else if (symbol.type === 'string') {
                this.emitLdxConst(SYSCALLS.PRINT_STRING);
                this.emitSys();
            }
        }
    }

    /**
     * Generate code for if statement
     */
    private generateIfStatement(node: ASTNode): void {
        if (!node.children || node.children.length < 2) {
            throw new Error('Invalid IfStatement node');
        }

        const conditionNode = node.children[0];
        const bodyNode = node.children[1];

        // Generate condition code
        this.generateComparisonCode(conditionNode);

        // Store result in a temporary location
        const tempAddr = 0x0000;  // Using zero page for temporary storage
        this.emitSta(tempAddr);

        // Compare to 0 (false)
        this.emitLdxMem(tempAddr);
        this.emitCpx(tempAddr);

        // Calculate jump distance for skipping the body
        const jumpDistance = this.calculateJumpDistance(bodyNode);

        // If condition is false (Z flag set), skip the body
        this.emitByte(OPCODES.BNE);
        this.emitByte(0x05);  // Jump over the body code + jump instruction

        // Generate code for body
        this.visit(bodyNode);
    }

    /**
     * Generate code for while statement
     */
    private generateWhileStatement(node: ASTNode): void {
        if (!node.children || node.children.length < 2) {
            throw new Error('Invalid WhileStatement node');
        }

        // Store the current position for loop start
        const loopStartPosition = this.code.length;

        const conditionNode = node.children[0];
        const bodyNode = node.children[1];

        // Generate condition code
        this.generateComparisonCode(conditionNode);

        // Store result in a temporary location
        const tempAddr = 0x0000;  // Using zero page for temporary storage
        this.emitSta(tempAddr);

        // Compare to 0 (false)
        this.emitLdxMem(tempAddr);
        this.emitCpx(tempAddr);

        // Calculate jump distance for skipping the body
        const jumpInstPosition = this.code.length;
        this.emitByte(OPCODES.BNE);
        this.emitByte(0x00);  // Placeholder for jump distance

        // Generate code for body
        this.visit(bodyNode);

        // Jump back to loop start
        this.emitByte(OPCODES.LDA_CONST);
        this.emitByte(0x01);  // Always true
        this.emitByte(OPCODES.BNE);

        // Calculate distance back to start of loop
        const distanceBack = this.code.length - loopStartPosition + 2;
        this.emitByte(0xFF - distanceBack + 1);  // Relative jump is 2's complement

        // Update the forward jump distance placeholder
        const bodySize = this.code.length - jumpInstPosition - 2;
        this.code[jumpInstPosition + 1] = bodySize + 2;  // +2 for the backward jump instruction
    }

    /**
     * Generate code for comparison operations
     */
    private generateComparison(node: ASTNode): void {
        this.generateComparisonCode(node);
    }

    /**
     * Generate code for comparison logic
     */
    private generateComparisonCode(node: ASTNode): void {
        if (!node.children || node.children.length < 2) {
            throw new Error('Invalid comparison node');
        }

        const leftNode = node.children[0];
        const rightNode = node.children[1];

        // Get the left operand
        if (leftNode.type === NodeType.Identifier) {
            const symbol = this.findSymbol(leftNode.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${leftNode.name}`);
            }
            this.emitLdxMem(symbol.address);
        } else if (leftNode.type === NodeType.IntegerLiteral) {
            this.emitLdxConst(leftNode.value);
        } else {
            throw new Error(`Unsupported left operand type: ${leftNode.type}`);
        }

        // Get the right operand
        if (rightNode.type === NodeType.Identifier) {
            const symbol = this.findSymbol(rightNode.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${rightNode.name}`);
            }
            this.emitLdaConst(symbol.address);
        } else if (rightNode.type === NodeType.IntegerLiteral) {
            this.emitLdaConst(rightNode.value);
        } else {
            throw new Error(`Unsupported right operand type: ${rightNode.type}`);
        }

        // Compare X register with accumulator
        this.emitCpx(0x00);  // Compare with accumulator

        // Set result based on comparison
        this.emitLdaConst(0x00);  // Default to false

        // Check if this is an equality comparison
        if (node.operator === '==') {
            // If Z flag is clear (not equal), skip the next instruction
            this.emitByte(OPCODES.BNE);
            this.emitByte(0x02);
            this.emitLdaConst(0x01);  // Set to true if equal
        } else if (node.operator === '!=') {
            // If Z flag is set (equal), skip the next instruction
            this.emitByte(OPCODES.BNE);
            this.emitByte(0x02);
            this.emitLdaConst(0x00);  // Set to false if equal
        } else {
            throw new Error(`Unsupported comparison operator: ${node.operator}`);
        }
    }

    /**
     * Helper method to calculate jump distance for if statements
     */
    private calculateJumpDistance(bodyNode: ASTNode): number {
        // This is a simplified approach - in a real compiler you'd need to calculate
        // the exact byte size of the generated body code
        return 5;  // Default jump distance
    }

    /**
     * Helper method to generate code for printing integers
     */
    private generatePrintInt(): void {
        // Move value from accumulator to Y register
        const tempAddr = this.getTempVar();
        this.emitSta(tempAddr);
        this.emitLdyMem(tempAddr);

        // Set X register to print integer syscall
        this.emitLdxConst(SYSCALLS.PRINT_INT);

        // Make syscall
        this.emitSys();
    }

    /**
     * Helper method to generate code for printing booleans
     */
    private generatePrintBool(): void {
        // Similar to print int, but handles boolean values
        const tempAddr = this.getTempVar();
        this.emitSta(tempAddr);
        this.emitLdyMem(tempAddr);

        // Set X register to print string syscall (booleans are printed as strings)
        this.emitLdxConst(SYSCALLS.PRINT_STRING);

        // Make syscall
        this.emitSys();
    }

    /**
     * Allocate static memory for a variable
     */
    private allocateStatic(name: string): number {
        if (this.staticTable[name]) {
            return this.staticTable[name];
        }

        const address = this.staticStart++;
        this.staticTable[name] = address;
        return address;
    }

    /**
     * Get a temporary variable address
     */
    private getTempVar(): number {
        return 0x0000 + this.tempCounter++;
    }

    /**
     * Find a symbol in the symbol table
     */
    private findSymbol(name: string): Symbol | undefined {
        // Search from innermost scope outward
        for (let i = this.symbolTable.length - 1; i >= 0; i--) {
            const symbol = this.symbolTable[i];
            if (symbol.name === name && symbol.scope <= this.currentScope) {
                return symbol;
            }
        }
        return undefined;
    }

    /**
     * Get or create address for a string constant
     */
    private getStringAddress(value: string): number {
        if (this.stringPool[value] !== undefined) {
            return this.stringPool[value];
        }

        const address = this.currentHeapAddress;
        this.stringPool[value] = address;

        // Update heap address for next string (account for null terminator)
        this.currentHeapAddress += value.length + 1;

        return address;
    }

    /**
     * Add string constants to the code
     */
    private addStringConstants(): void {
        // Create array of [address, string] pairs
        const strings = Object.entries(this.stringPool).map(
            ([str, addr]) => ({ str, addr })
        );

        // Sort by address (descending) to maintain proper memory layout
        strings.sort((a, b) => b.addr - a.addr);

        // Add each string to the code
        for (const { str, addr } of strings) {
            // Ensure we're at the right position
            while (this.code.length < addr) {
                this.emitByte(0x00);
            }

            // Add string bytes (ASCII values)
            for (let i = 0; i < str.length; i++) {
                this.emitByte(str.charCodeAt(i));
            }

            // Add null terminator
            this.emitByte(0x00);
        }
    }

    /**
     * Emit instructions and helper methods
     */
    private emitByte(value: number): void {
        this.code.push(value & 0xFF);
    }

    private emitWord(value: number): void {
        // 6502 is little-endian
        this.emitByte(value & 0xFF);
        this.emitByte((value >> 8) & 0xFF);
    }

    private emitLdaConst(value: number): void {
        this.emitByte(OPCODES.LDA_CONST);
        this.emitByte(value);
    }

    private emitLdaMem(address: number): void {
        this.emitByte(OPCODES.LDA_MEM);
        this.emitWord(address);
    }

    private emitSta(address: number): void {
        this.emitByte(OPCODES.STA);
        this.emitWord(address);
    }

    private emitLdxConst(value: number): void {
        this.emitByte(OPCODES.LDX_CONST);
        this.emitByte(value);
    }

    private emitLdxMem(address: number): void {
        this.emitByte(OPCODES.LDX_MEM);
        this.emitWord(address);
    }

    private emitLdyConst(value: number): void {
        this.emitByte(OPCODES.LDY_CONST);
        this.emitByte(value);
    }

    private emitLdyMem(address: number): void {
        this.emitByte(OPCODES.LDY_MEM);
        this.emitWord(address);
    }

    private emitCpx(address: number): void {
        this.emitByte(OPCODES.CPX);
        this.emitWord(address);
    }

    private emitSys(): void {
        this.emitByte(OPCODES.SYS);
    }

    /**
     * Get the generated code as a hex string
     */
    public getHexCode(): string {
        return this.code.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }
}

// Export for browser
declare global {
    interface Window {
        CodeGenerator: typeof CodeGenerator;
    }
}

// Browser exposure
if (typeof window !== 'undefined') {
    window.CodeGenerator = CodeGenerator;
}