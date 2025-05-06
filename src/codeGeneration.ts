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

// String references for standard strings
const STRING_REFS = {
    TRUE_STRING: 0xF5,  // Memory reference for "true" string
    FALSE_STRING: 0xFA,  // Memory reference for "false" string
    HI_STRING: 0xF2     // Memory reference for "hi" string
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
    dataType?: string;  // Added to track variable type
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
    private staticStart = 0x003C;  // Start of static variables
    private heapStart = 0x00E0;    // Start of heap (string constants)
    private currentHeapAddress = 0x00E0;
    private symbolTable: Symbol[] = [];
    private tempCounter = 0;
    private currentScope = 0;
    private placeholders: { tag: string, position: number, type: string }[] = [];
    private programCounter: number = 0;
    
    constructor() {
        console.log("INFO\tStarting Code Generation");
        // Initialize string pool with standard strings
        this.stringPool["true"] = STRING_REFS.TRUE_STRING;
        this.stringPool["false"] = STRING_REFS.FALSE_STRING;
        this.stringPool["hi"] = STRING_REFS.HI_STRING;
    }

    /**
     * Generates code from multiple programs
     */
    public generateMultiple(asts: ASTNode[]): number[][] {
        const results: number[][] = [];
        
        for (const ast of asts) {
            this.programCounter++;
            this.debug(`Generating code for program ${this.programCounter}`);
            
            // Reset state for each program
            this.code = [];
            this.staticTable = {};
            // Pre-register string constants but don't reset their addresses
            this.stringPool = {
                "hi": STRING_REFS.HI_STRING,
                "true": STRING_REFS.TRUE_STRING,
                "false": STRING_REFS.FALSE_STRING
            };
            this.currentHeapAddress = this.heapStart;
            this.symbolTable = [];
            this.currentScope = 0;
            this.placeholders = [];
            
            try {
                // Generate initial NOP instruction
                this.emitLdaConst(0x00);
                
                // Generate code for the AST
                if (ast) {
                    this.visit(ast);
                } else {
                    // For completely empty programs, just emit BRK
                    this.emitByte(OPCODES.BRK);
                    results.push(this.code);
                    continue;
                }
                
                // Add break instruction at the end
                this.emitByte(OPCODES.BRK);
                
                // Backpatch all placeholders with real addresses
                this.backpatchPlaceholders();
                
                // Fill memory with zeroes up to where the string constants begin
                while (this.code.length < this.heapStart) {
                    this.emitByte(0x00);
                }
                
                // Add string constants to the end of the code
                this.addStringConstants();
                
                // Ensure exactly 256 bytes
                while (this.code.length < 256) {
                    this.emitByte(0x00);
                }
                
                results.push([...this.code]);
                this.debug(`Code Generation complete for program ${this.programCounter}`);
            } catch (error) {
                console.error(`Code generation error for program ${this.programCounter}:`, error);
                // Return minimal valid program (just BRK) if generation fails
                results.push([OPCODES.BRK]);
            }
        }
        
        return results;
    }

    /**
     * Generates code from a single AST (for backward compatibility)
     */
    public generate(ast: ASTNode): number[] {
        return this.generateMultiple([ast])[0];
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

        const typeNode = node.children[0];
        const identifierNode = node.children[1];
        if (!identifierNode || !identifierNode.name) {
            throw new Error('Invalid VarDeclaration node: Missing identifier');
        }

        const name = identifierNode.name;
        const varType = typeNode.name || 'int'; // Default to int if type not specified
        const address = this.allocateStatic(name);

        // Add to symbol table
        this.symbolTable.push({
            type: varType,
            name,
            address,
            scope: this.currentScope
        });

        // Initialize variable based on type
        if (varType === 'boolean') {
            // Initialize boolean to false
            this.emitLdaConst(0x00);
            this.emitSta(address);
        } else if (varType === 'string') {
            // Initialize string to empty (null pointer)
            this.emitLdaConst(0x00);
            this.emitSta(address);
        } else {
            // Initialize int to 0
            this.emitLdaConst(0x00);
            this.emitSta(address);
        }
    }

    /**
     * Generate code for assignment statement
     */
    private generateAssignment(node: ASTNode): void {
        if (!node.identifier || !node.expression) {
            throw new Error('Invalid assignment statement');
        }

        const varName = node.identifier.name;
        const symbol = this.findSymbol(varName);
        if (!symbol) {
            throw new Error(`Undefined variable: ${varName}`);
        }

        // Generate code based on variable type
        if (symbol.type === 'int') {
            this.generateIntAssignment(node, symbol);
        } else if (symbol.type === 'boolean') {
            this.generateBooleanAssignment(node, symbol);
        } else if (symbol.type === 'string') {
            this.generateStringAssignment(node, symbol);
        } else {
            throw new Error(`Unknown variable type: ${symbol.type}`);
        }
    }

    /**
     * Generate code for integer assignment
     */
    private generateIntAssignment(node: ASTNode, symbol: Symbol): void {
        if (!node.expression) {
            throw new Error('Invalid assignment: missing expression');
        }

        if (node.expression.type === NodeType.BinaryExpression) {
            this.generateArithmeticExpression(node.expression);
        } else if (node.expression.type === NodeType.Identifier) {
            const sourceSymbol = this.findSymbol(node.expression.name!);
            if (!sourceSymbol) {
                throw new Error(`Undefined variable: ${node.expression.name}`);
            }
            this.emitLdaMem(sourceSymbol.address);
        } else if (node.expression.type === NodeType.IntegerLiteral) {
            this.emitLdaConst(node.expression.value);
        } else {
            throw new Error(`Invalid expression type for integer assignment: ${node.expression.type}`);
        }

        // Store result in variable
        this.emitSta(symbol.address);
    }

    /**
     * Generate code for boolean assignment
     */
    private generateBooleanAssignment(node: ASTNode, symbol: Symbol): void {
        if (!node.expression) {
            throw new Error('Invalid assignment: missing expression');
        }

        if (node.expression.type === NodeType.BooleanLiteral) {
            // Load true (0xF5) or false (0xF0) value
            const boolValue = node.expression.value === true ? 
                              BOOLEAN_VALUES.TRUE : 
                              BOOLEAN_VALUES.FALSE;
            this.emitLdaConst(boolValue);
        } else if (node.expression.type === NodeType.Identifier) {
            const sourceSymbol = this.findSymbol(node.expression.name!);
            if (!sourceSymbol) {
                throw new Error(`Undefined variable: ${node.expression.name}`);
            }
            this.emitLdaMem(sourceSymbol.address);
        } else if (node.expression.type === NodeType.BinaryExpression) {
            // This should be a comparison that results in a boolean
            this.generateComparison(node.expression);
        } else {
            throw new Error(`Invalid expression type for boolean assignment: ${node.expression.type}`);
        }

        // Store result in variable
        this.emitSta(symbol.address);
    }

    /**
     * Generate code for string assignment
     */
    private generateStringAssignment(node: ASTNode, symbol: Symbol): void {
        if (!node.expression) {
            throw new Error('Invalid assignment: missing expression');
        }

        if (node.expression.type === NodeType.StringLiteral) {
            // Get or create address for the string constant
            const stringAddr = this.getStringAddress(node.expression.value);
            this.emitLdaConst(stringAddr);
        } else if (node.expression.type === NodeType.Identifier) {
            const sourceSymbol = this.findSymbol(node.expression.name!);
            if (!sourceSymbol) {
                throw new Error(`Undefined variable: ${node.expression.name}`);
            }
            this.emitLdaMem(sourceSymbol.address);
        } else {
            throw new Error(`Invalid expression type for string assignment: ${node.expression.type}`);
        }

        // Store result in variable
        this.emitSta(symbol.address);
    }

    /**
     * Generate code for print statement
     */
    private generatePrintStatement(node: ASTNode): void {
        if (!node.expression) {
            throw new Error('Invalid print statement: missing expression');
        }

        // Handle different expression types
        if (node.expression.type === NodeType.Identifier) {
            const symbol = this.findSymbol(node.expression.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${node.expression.name}`);
            }

            // Load variable value
            this.emitLdaMem(symbol.address);

            // Handle different variable types
            if (symbol.type === 'int') {
                // Print integer
                this.emitLdyMem(symbol.address);
                this.emitLdxConst(SYSCALLS.PRINT_INT);
                this.emitSys();
            } else if (symbol.type === 'boolean') {
                // Print boolean as string
                this.emitLdyMem(symbol.address);
                this.emitLdxConst(SYSCALLS.PRINT_STRING);
                this.emitSys();
            } else if (symbol.type === 'string') {
                // Print string
                this.emitLdyMem(symbol.address);
                this.emitLdxConst(SYSCALLS.PRINT_STRING);
                this.emitSys();
            }
        } else if (node.expression.type === NodeType.IntegerLiteral) {
            // Print integer literal
            this.emitLdyConst(node.expression.value);
            this.emitLdxConst(SYSCALLS.PRINT_INT);
            this.emitSys();
        } else if (node.expression.type === NodeType.BooleanLiteral) {
            // Print boolean literal
            const stringAddr = node.expression.value ? 
                STRING_REFS.TRUE_STRING : 
                STRING_REFS.FALSE_STRING;
            this.emitLdyConst(stringAddr);
            this.emitLdxConst(SYSCALLS.PRINT_STRING);
            this.emitSys();
        } else if (node.expression.type === NodeType.StringLiteral) {
            // Print string literal
            const stringAddr = this.getStringAddress(node.expression.value);
            this.emitLdyConst(stringAddr);
            this.emitLdxConst(SYSCALLS.PRINT_STRING);
            this.emitSys();
        } else if (node.expression.type === NodeType.BinaryExpression) {
            // Handle arithmetic expressions
            this.generateArithmeticExpression(node.expression);
            // Store result in temporary location
            const tempAddr = 0x0000;
            this.emitSta(tempAddr);
            // Print the result
            this.emitLdyMem(tempAddr);
            this.emitLdxConst(SYSCALLS.PRINT_INT);
            this.emitSys();
        } else {
            throw new Error(`Unsupported expression type in print statement: ${node.expression.type}`);
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

        // Get the left operand into X register
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

        // Get the right operand into accumulator
        if (node.right.type === NodeType.Identifier) {
            const symbol = this.findSymbol(node.right.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${node.right.name}`);
            }
            this.emitLdaMem(symbol.address);
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
        // Check if variable already exists
        if (this.staticTable[name] !== undefined) {
            return this.staticTable[name];
        }

        // Allocate new address
        const address = this.staticStart + Object.keys(this.staticTable).length;
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
    private findSymbol(name: string | undefined): Symbol | undefined {
        if (!name) {
            throw new Error('Invalid symbol name');
        }
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
        // Check if string is already in pool
        if (this.stringPool[value] !== undefined) {
            return this.stringPool[value];
        }

        // Allocate new address for string
        const address = this.currentHeapAddress;
        this.stringPool[value] = address;

        // Update heap address for next string
        this.currentHeapAddress += value.length + 1; // +1 for null terminator

        return address;
    }

    /**
     * Add string constants to the code
     */
    private addStringConstants(): void {
        // Add all strings to the code
        for (const [str, addr] of Object.entries(this.stringPool)) {
            // Skip standard strings that are already at fixed addresses
            if (addr >= STRING_REFS.HI_STRING && addr <= STRING_REFS.FALSE_STRING) {
                continue;
            }

            // Move to the correct address
            while (this.code.length < addr) {
                this.emitByte(0x00);
            }

            // Add the string
            this.emitString(str);
        }
    }

    /**
     * Emit a string to the code
     */
    private emitString(str: string): void {
        // Add string characters as ASCII values
        for (let i = 0; i < str.length; i++) {
            this.emitByte(str.charCodeAt(i));
        }
        // Add null terminator
        this.emitByte(0x00);
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

    /**
     * Emit ADC (Add with Carry) instruction
     */
    private emitAdc(address: number): void {
        this.emitByte(OPCODES.ADC);
        this.emitWord(address);
    }

    /**
     * Generate code for arithmetic expressions
     */
    private generateArithmeticExpression(node: ASTNode): void {
        if (!node.children || node.children.length < 3) {
            throw new Error('Invalid arithmetic expression');
        }

        // First term
        const firstTerm = node.children[0];
        if (firstTerm.type === NodeType.IntegerLiteral) {
            this.emitLdaConst(firstTerm.value);
        } else if (firstTerm.type === NodeType.Identifier) {
            const symbol = this.findSymbol(firstTerm.name!);
            if (!symbol) {
                throw new Error(`Undefined variable: ${firstTerm.name}`);
            }
            this.emitLdaMem(symbol.address);
        }

        // Store first term in memory
        const tempAddr = 0x0000;
        this.emitSta(tempAddr);

        // Process remaining terms in reverse order
        for (let i = node.children.length - 1; i > 0; i -= 2) {
            const nextTerm = node.children[i];

            // Load next term
            if (nextTerm.type === NodeType.IntegerLiteral) {
                this.emitLdaConst(nextTerm.value);
            } else if (nextTerm.type === NodeType.Identifier) {
                const symbol = this.findSymbol(nextTerm.name!);
                if (!symbol) {
                    throw new Error(`Undefined variable: ${nextTerm.name}`);
                }
                this.emitLdaMem(symbol.address);
            }

            // Add to accumulator
            this.emitAdc(tempAddr);

            // Store result back in temp location
            this.emitSta(tempAddr);
        }
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