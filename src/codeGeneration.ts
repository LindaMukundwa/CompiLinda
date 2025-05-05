/**
 * 6502a Code Generator
 * 
 * This class handles the generation of 6502a machine code from an AST for the compiler
 */

import { ASTAdapter, NodeType } from "./combinedAnalyzer";

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
    operator?: string;
    identifier?: ASTNode;
    expression?: ASTNode;
    condition?: ASTNode;
    thenBranch?: ASTNode;
    elseBranch?: ASTNode;
    left?: ASTNode;
    right?: ASTNode;
}

// Define the structure for a symbol in the symbol table
interface Symbol {
    type: string | NodeType; // Allow both string and NodeType
    name: string;
    address: number;
    scope: number;
    placeholderTag?: string; // Add placeholder tag for backpatching
}

class CodeGenerator {
    private code: number[] = [];
    private staticTable: { [key: string]: number } = {};
    private stringPool: { [key: string]: number } = {};
    // Changed to match expected output
    private staticStart = 0x001F; // Starting address for static data (0x1F)
    private heapStart = 0x00E0;   // Starting address for heap (strings)
    private currentHeapAddress = 0x00E0;
    private symbolTable: Symbol[] = [];
    private tempCounter = 0;
    private currentScope = 0;
    
    // Add placeholders for backpatching
    private placeholders: { tag: string, position: number, type: string }[] = [];

    constructor() {
        // Initialize
        console.log("INFO\tStarting Code Generation");
    }

    /**
     * Generates code from AST
     */
    public generate(ast: ASTNode): number[] {
        // Reset state
        this.code = [];
        this.staticTable = {};
        this.stringPool = {};
        this.currentHeapAddress = this.heapStart;
        this.tempCounter = 0;
        this.currentScope = 0;
        this.placeholders = [];
    
        try {
            this.debug("Starting code generation");
            this.debug(`AST type: ${ast.type}`);
            if (ast.children) {
                this.debug(`AST has ${ast.children.length} children`);
            }
            
            // Generate initial NOP instruction
            this.debug("Generating A9 at index 0");
            this.emitLdaConst(0x00);
            
            // Generate code for the AST
            if (ast) {
                this.visit(ast);
            } else {
                // For completely empty programs, just emit BRK
                this.emitByte(OPCODES.BRK);
                return this.code;
            }
    
            // Add break instruction at the end
            this.emitByte(OPCODES.BRK);
            
            // Backpatch all placeholders with real addresses
            this.backpatchPlaceholders();
    
            // Fill memory with zeroes up to where the string constants begin
            while (this.code.length < this.heapStart - 1) {
                this.emitByte(0x00);
            }
    
            // Add string constants to the end of the code
            this.addStringConstants();
            
            this.debug("Code Generation complete with 0 ERROR(S)");
            return this.code;
        } catch (error) {
            console.error("Code generation error:", error);
            // Return minimal valid program (just BRK) if generation fails
            return [OPCODES.BRK];
        }
    }

    /**
     * Main visitor function that dispatches to the appropriate code generator
     */
    private visit(node: ASTNode): void {
        if (!node) {
            this.debug("WARNING: Attempted to visit null node");
            return;
        }

        this.debug(`Visiting node of type: ${node.type}`);
        
        switch (node.type) {
            case NodeType.Block:
                this.generateBlock(node);
                break;
            case NodeType.VarDeclaration:
                this.debug(`Generating Op Codes for [ VarDecl ] in Scope ${this.currentScope}`);
                this.generateVarDecl(node);
                break;
            case NodeType.AssignmentStatement:
                this.debug(`Generating Op Codes for [ AssignmentStatement ] in Scope ${this.currentScope}`);
                this.generateAssignment(node);
                break;
            case NodeType.PrintStatement:
                this.debug(`Generating Op Codes for [ PrintStatement ] in Scope ${this.currentScope}`);
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
                // Handle empty programs or unknown nodes gracefully
                if (node.children && node.children.length > 0) {
                    this.debug(`Processing ${node.children.length} children for unknown node type: ${node.type}`);
                    node.children.forEach(child => this.visit(child));
                }
                break;
        }
    }

    /**
     * Generate code for a block
     */
    private generateBlock(node: ASTNode): void {
        // Enter a new scope
        this.currentScope++;
    
        // Handle empty blocks
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                this.visit(child);
            });
        } else {
            // For empty blocks, just emit a NOP (no operation)
            this.emitByte(OPCODES.NOP);
        }
    
        // Exit the scope
        this.currentScope--;
    }

    /**
     * Generate code for variable declaration
     */
    private generateVarDecl(node: ASTNode): void {
        // Check if node has the required properties
        if (!node || !node.children || node.children.length < 2) {
            throw new Error('Invalid VarDeclaration node: Missing required children');
        }

        // The first child should be the type, second should be the identifier
        const typeNode = node.children[0];
        const identifierNode = node.children[1];

        if (!typeNode || !identifierNode || !identifierNode.name) {
            throw new Error('Invalid VarDeclaration node: Missing type or identifier');
        }

        const type = typeNode.name || 'int'; // Default to 'int' if name is undefined
        const name = identifierNode.name;

        // Create a placeholder tag for this variable
        const placeholderTag = `T${this.tempCounter++}`;
        
        // Allocate memory for the variable
        const address = this.allocateStatic(name);

        // Add to symbol table with the placeholder tag
        this.symbolTable.push({
            type,
            name,
            address,
            scope: this.currentScope,
            placeholderTag
        });

        // Initialize variable to default value (0)
        this.debug(`Generating 8D at index ${this.code.length}`);
        this.emitByte(OPCODES.STA);
        
        // Add placeholder for address
        this.debug(`Generating ${placeholderTag} at index ${this.code.length}`);
        this.addPlaceholder(placeholderTag, "address");
        this.emitByte(0x00);  // Low byte placeholder
        this.debug(`Generating 00 at index ${this.code.length}`);
        this.emitByte(0x00);  // High byte placeholder
    }

    /**
     * Generate code for assignment statement
     */
    private generateAssignment(node: ASTNode): void {
        if (!node.identifier || !node.expression) {
            throw new Error('Invalid AssignmentStatement node');
        }

        const varName = node.identifier.name;
        const valueNode = node.expression;

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
            this.debug(`Generating Op Codes for assigning a Digit to a(n) Id`);
            this.debug(`Generating A9 at index ${this.code.length}`);
            this.emitLdaConst(valueNode.value);
            
            this.debug(`Generating 8D at index ${this.code.length}`);
            this.emitByte(OPCODES.STA);
            
            // Use placeholder for the address
            this.debug(`Generating ${symbol.placeholderTag} at index ${this.code.length}`);
            this.addPlaceholder(symbol.placeholderTag!, "address");
            this.emitByte(0x00);  // Low byte placeholder
            this.debug(`Generating 00 at index ${this.code.length}`);
            this.emitByte(0x00);  // High byte placeholder
        } else if (valueNode.type === NodeType.BooleanLiteral) {
            // Boolean assignment
            const boolValue = valueNode.value === true ? BOOLEAN_VALUES.TRUE : BOOLEAN_VALUES.FALSE;
            this.emitLdaConst(boolValue);
            
            this.emitByte(OPCODES.STA);
            this.addPlaceholder(symbol.placeholderTag!, "address");
            this.emitByte(0x00);
            this.emitByte(0x00);
        } else if (valueNode.type === NodeType.StringLiteral) {
            // String assignment
            const stringAddr = this.getStringAddress(valueNode.value);
            this.emitLdaConst(stringAddr);
            
            this.emitByte(OPCODES.STA);
            this.addPlaceholder(symbol.placeholderTag!, "address");
            this.emitByte(0x00);
            this.emitByte(0x00);
        } else if (valueNode.type === NodeType.Identifier) {
            // Variable-to-variable assignment
            const sourceSymbol = this.findSymbol(valueNode.name!);
            if (!sourceSymbol) {
                throw new Error(`Undefined variable: ${valueNode.name}`);
            }
            
            this.emitByte(OPCODES.LDA_MEM);
            this.addPlaceholder(sourceSymbol.placeholderTag!, "address");
            this.emitByte(0x00);
            this.emitByte(0x00);
            
            this.emitByte(OPCODES.STA);
            this.addPlaceholder(symbol.placeholderTag!, "address");
            this.emitByte(0x00);
            this.emitByte(0x00);
        } else {
            throw new Error(`Unsupported value type: ${valueNode.type}`);
        }
    }

    /**
     * Generate code for print statement
     */
    private generatePrintStatement(node: ASTNode): void {
        if (!node.expression) {
            throw new Error('Invalid PrintStatement node: Missing expression');
        }

        const exprNode = node.expression;

        if (exprNode.type === NodeType.IntegerLiteral) {
            // Print integer constant
            this.debug(`Generating Op Codes for printing a(n) Digit`);
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
            this.debug(`Generating Op Codes for printing a(n) Id`);
            const symbol = this.findSymbol(exprNode.name!);

            if (!symbol) {
                throw new Error(`Undefined variable: ${exprNode.name}`);
            }

            // Load the variable value into Y register
            this.debug(`Generating AC at index ${this.code.length}`);
            this.emitByte(OPCODES.LDY_MEM);
            
            // Use placeholder for address
            this.debug(`Generating ${symbol.placeholderTag} at index ${this.code.length}`);
            this.addPlaceholder(symbol.placeholderTag!, "address");
            this.emitByte(0x00);  // Low byte placeholder
            this.debug(`Generating 00 at index ${this.code.length}`);
            this.emitByte(0x00);  // High byte placeholder

            // Set syscall type based on variable type
            this.debug(`Generating A2 at index ${this.code.length}`);
            this.emitLdxConst(SYSCALLS.PRINT_INT);
            
            // Make syscall
            this.debug(`Generating FF at index ${this.code.length}`);
            this.emitSys();
        } else {
            throw new Error(`Unsupported expression type in print statement: ${exprNode.type}`);
        }
    }

    /**
     * Generate code for if statement
     */
    private generateIfStatement(node: ASTNode): void {
        if (!node.condition || !node.thenBranch) {
            throw new Error('Invalid IfStatement node: Missing condition or then branch');
        }

        // Generate condition code
        this.generateComparisonCode(node.condition);

        // Store result in a temporary location
        const tempAddr = 0x0000;  // Using zero page for temporary storage
        this.emitSta(tempAddr);

        // Compare to 0 (false)
        this.emitLdxMem(tempAddr);
        this.emitCpx(tempAddr);

        // Calculate jump distance for skipping the body
        const jumpDistance = this.calculateJumpDistance(node.thenBranch);

        // If condition is false (Z flag set), skip the body
        this.emitByte(OPCODES.BNE);
        this.emitByte(0x05);  // Jump over the body code + jump instruction

        // Generate code for body
        this.visit(node.thenBranch);

        // Handle else branch if it exists
        if (node.elseBranch) {
            // Jump over the else branch
            this.emitByte(OPCODES.LDA_CONST);
            this.emitByte(0x01);  // Always true
            this.emitByte(OPCODES.BNE);
            this.emitByte(0x05);  // Jump over the else branch

            // Generate code for else branch
            this.visit(node.elseBranch);
        }
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
        if (!node || node.type !== NodeType.BinaryExpression) {
            throw new Error('Invalid comparison node: Expected BinaryExpression');
        }

        if (!node.left || !node.right) {
            throw new Error('Invalid comparison node: Missing left or right operand');
        }

        // Get the left operand
        if (node.left.type === NodeType.Identifier) {
            const symbol = this.findSymbol(node.left.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${node.left.name}`);
            }
            this.emitLdxMem(symbol.address);
        } else if (node.left.type === NodeType.IntegerLiteral) {
            this.emitLdxConst(node.left.value);
        } else {
            throw new Error(`Unsupported left operand type: ${node.left.type}`);
        }

        // Get the right operand
        if (node.right.type === NodeType.Identifier) {
            const symbol = this.findSymbol(node.right.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${node.right.name}`);
            }
            this.emitLdaConst(symbol.address);
        } else if (node.right.type === NodeType.IntegerLiteral) {
            this.emitLdaConst(node.right.value);
        } else {
            throw new Error(`Unsupported right operand type: ${node.right.type}`);
        }

        // Compare X register with accumulator
        this.emitCpx(0x00);  // Compare with accumulator

        // Set result based on comparison
        this.emitLdaConst(0x00);

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

        // Add boolean string constants if not already present
        if (!this.stringPool["true"]) {
            const trueAddr = this.currentHeapAddress;
            const trueStr = "true";
            strings.push({ str: trueStr, addr: trueAddr });
            this.currentHeapAddress += trueStr.length + 1;
        }
        
        if (!this.stringPool["false"]) {
            const falseAddr = this.currentHeapAddress;
            const falseStr = "false";
            strings.push({ str: falseStr, addr: falseAddr });
            this.currentHeapAddress += falseStr.length + 1;
        }

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
     * Add placeholder for backpatching
     */
    private addPlaceholder(tag: string, type: string): void {
        this.placeholders.push({
            tag,
            position: this.code.length,
            type
        });
    }

    /**
     * Backpatch all placeholders with real addresses
     */
    private backpatchPlaceholders(): void {
        for (const placeholder of this.placeholders) {
            // Find the symbol with this placeholder tag
            const symbol = this.symbolTable.find(s => s.placeholderTag === placeholder.tag);
            
            if (symbol) {
                const address = symbol.address;
                
                // Backpatch the address (little-endian: low byte first)
                const lowByte = address & 0xFF;
                const highByte = (address >> 8) & 0xFF;
                
                this.debug(`Backpatching Static Variable Placeholder ${placeholder.tag} at Address: ${placeholder.position.toString(16)} with Memory Address: ${address.toString(16)}`);
                
                this.code[placeholder.position] = lowByte;
                this.code[placeholder.position + 1] = highByte;
            }
        }
    }

    /**
     * Debug helper
     */
    private debug(message: string): void {
        console.log(`DEBUG - Code Gen - ${message}`);
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
        this.debug(`Generating A9 at index ${this.code.length}`);
        this.emitByte(OPCODES.LDA_CONST);
        this.debug(`Generating ${value.toString(16).padStart(2, '0')} at index ${this.code.length}`);
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