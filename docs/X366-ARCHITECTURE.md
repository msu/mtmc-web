# X366 Assembly Language Specification

X366 is a simplified 16-bit assembly language inspired by x86, designed for educational purposes.

## Architecture Overview

**Word Size:** 16-bit
**Address Space:** 1KB default (configurable: 1K, 2K, 4K, 8K, or 16K)
**Endianness:** Big-endian (x86 is [Little-endian](https://en.wikipedia.org/wiki/Endianness))
**Instruction Format:** Fixed-length (2 or 4 bytes)

> **vs x86:** X366 uses a much smaller address space (1KB-16KB vs 4GB/64TB) and fixed-length instructions for simplicity.

## Register Set

### General Purpose Registers

```
AX - Accumulator (arithmetic operations, first parameter, return value)
BX - Base register (array indexing, second parameter)
CX - Counter (loop counter, third parameter)
DX - Data register (general purpose, fourth parameter)
EX - Extended register (general purpose, fifth parameter)
FX - Free register (general purpose, sixth parameter)
```

### Byte Register Access

X366 supports accessing the low byte of general-purpose registers using byte register names:

```
AL - Low byte of AX (bits 0-7)
BL - Low byte of BX (bits 0-7)
CL - Low byte of CX (bits 0-7)
DL - Low byte of DX (bits 0-7)
EL - Low byte of EX (bits 0-7)
FL - Low byte of FX (bits 0-7)
```

**Important Notes:**
- Only the **low byte** can be accessed directly (AL, BL, CL, DL, EL, FL)
- High byte registers (AH, BH, CH, DH, EH, FH) are **not supported** in X366
- Byte registers are primarily used with byte load/store instructions
- To access the high byte, shift the register right by 8 bits

**Usage Examples:**
```asm
MOV AL, 65          ; Load byte value into AL (AX = 0x0041)
MOV [addr], BL      ; Store low byte of BX to memory
MOV CL, [addr]      ; Load byte from memory into CL (zero-extended)
```

> **vs x86:** x86 supports both low byte (AL, BL, CL, DL) and high byte (AH, BH, CH, DH) access. X366 simplifies this by only supporting low byte access.

### Special Purpose Registers

```
SP - Stack Pointer (grows downward from end of memory)
FP - Frame Pointer (base pointer for stack frames)
BK - Break Pointer (end of heap/start of free memory)
PC - Program Counter (instruction pointer)
```

### Flags Register

```
ZF - Zero Flag (set when result is zero)
SF - Sign Flag (set when result is negative)
CF - Carry Flag (set on unsigned overflow)
OF - Overflow Flag (set on signed overflow)
```

> **vs x86:** X366 calls it "Frame Pointer" (FP) rather than x86's "Base Pointer" (EBP/RBP). 
> X366 calls it "Program Counter" (PC) rather than x86's "Instruction Pointer" (EIP/RIP). 
> Register names use 16-bit conventions (AX, BX) without 32-bit (EAX) or 64-bit (RAX) variants.

## Memory Layout

### Default (1KB)
```
Address Range       Purpose
─────────────────────────────────────────────
0x0000 - 0x0000     null byte
0x0001 - 0x0008     Signature "Go Cats!" (8 bytes)
0x0008 - 0x001F     Reserved/padding (24 bytes)
0x0020 - (BK-1)     Code and data (grows upward)
BK - (SP-1)         Heap (dynamic allocation space)
SP - 0x03FF         Stack (grows downward)
0x0400              Memory end (1KB)
```

**Key Points:**
- **Total Memory:** 1KB default, configurable to 2K, 4K, 8K, or 16K
- **Code Start:** 0x0020 (after signature and padding)
- **Stack Init:** SP = end of memory (0x0400 for 1KB, 0x0800 for 2KB, etc.)
- **Stack Growth:** Downward from end of memory (first push writes to end-2)
- **Heap:** Between BK (break pointer) and SP
- **Binary Signature:** All binaries start with "Go Cats!" for identification

**Memory Resizing:**
- Memory can be resized at runtime via the `memory <size>` TUI command
- When resizing, everything below BK (heap/data) remains in place
- Stack content at SP and above is moved to the new memory end
- Memory between BK and new SP is zeroed
- Resize fails if new size cannot accommodate existing heap and stack

> **vs x86:** X366 requires all binaries to have a signature for identification. x86 uses various executable formats
> (ELF, PE, Mach-O) with different headers. X366 supports runtime memory reconfiguration, while x86 systems have fixed
> address spaces determined at boot/process creation.

## Program Startup

When an X366 program begins execution, the emulator initializes the system to a known state:

### Initial Register State

```
PC = 0x0020           Program counter points to first instruction
SP = end of memory    0x0400 (1KB), 0x0800 (2KB), 0x1000 (4KB), 0x2000 (8KB), or 0x4000 (16KB)
BK = end of code      Points to first byte after program code and data
AX = input pointer    Points to null-terminated command line input string
                      (or 0 if no input provided)
BX = 0
CX = 0
DX = 0
FP = 0
```

### Command Line Input

The emulator automatically stores any command line input as a null-terminated string in memory and places a pointer to it in **AX**. This allows programs to accept input without needing to call READ_STRING:

```asm
main:
    ; AX already contains pointer to command line input
    ; For example, if run with: x366 program.bin "30 10 20"
    ; AX points to "30 10 20\0" in memory

    MOV BX, AX
    SYSCALL ATOI        ; Parse first number
    ; ... process input
```

If no command line input is provided, AX is set to 0 (null pointer).

### Startup Sequence

1. Emulator loads binary into memory starting at 0x0000
2. Verifies "Go Cats!" signature at 0x0001-0x0008
3. Initializes SP to end of memory
4. Sets BK to first address after loaded program
5. If command line input provided, stores it in memory and sets AX to its address
6. Sets PC to 0x0020 (first instruction after header)
7. Begins instruction execution

**Example Program Using Command Line Input:**

```asm
; Echo program - prints command line input
main:
    ; AX already points to input string
    SYSCALL PRINT_STRING
    SYSCALL EXIT
```

> **vs x86:** x86 programs receive command line arguments via the stack (argc/argv in C). X366 uses a simpler
> model with a single input string pointer in AX, suitable for educational purposes.

## Assembly Syntax

### Operand Separators

X366 assemblers support **flexible operand separation** for improved readability and ease of learning:

**Commas are optional** - Operands can be separated by:
- Commas: `MOV AX, 10`
- Spaces: `MOV AX 10`
- Both: `MOV AX , 10`

All of the following are equivalent and produce identical machine code:
```asm
MOV AX, 10      ; Traditional x86 style (comma-separated)
MOV AX 10       ; Space-separated
ADD BX, CX      ; With comma
ADD BX CX       ; Without comma
```

**Note:** While x86 assembly traditionally requires commas, X366 makes them optional to reduce syntax errors for beginners. Students can use whichever style they prefer, or mix both styles in the same program.

### Numeric Literals

X366 supports multiple numeric formats:

```asm
MOV AX, 42        ; Decimal
MOV BX, 0xFF      ; Hexadecimal (0x prefix)
MOV CX, 0b1010    ; Binary (0b prefix)
MOV DL, 'A'       ; Character literal (evaluates to 65)
```

All numeric formats can be used in any context that accepts immediate values.

## Instruction Encoding

X366 uses **fixed-length instructions**: either 2 bytes or 4 bytes.

### 2-Byte Instructions
```
Byte 0: Opcode
Byte 1: Register code or parameter
```

Used for: NOP, HLT, RET, SYSCALL, single-register operations (INC, DEC, PUSH, POP, MUL, DIV, NOT)

### 4-Byte Instructions
```
Byte 0: Opcode
Byte 1: Destination register or mode
Bytes 2-3: Immediate value, address, or offset (little-endian)
```

Used for: MOV, arithmetic, logical, comparisons, jumps, calls, memory operations

### Register Encoding

```
Code  Register
────  ────────
 0    AX
 1    BX
 2    CX
 3    DX
 4    EX
 5    FX
 6    SP
 7    FP

Internal-only (no register code):
  PC - Program Counter
  BK - Break Pointer
  CB - Code Base
  IR - Instruction Register
  DR - Data Register
```

> **vs x86:** x86 uses variable-length instructions (1-15 bytes) with complex prefix bytes and ModR/M encoding. X366's 
> fixed-length format is much simpler.

## Complete Instruction Set

### Data Movement (15 instructions)

| Instruction              | Opcode    | Bytes | Description                           | Example           |
|--------------------------|-----------|-------|---------------------------------------|-------------------|
| `MOV dst, src`           | 0x10-0x15 | 2-4   | Move data between registers/memory    | `MOV AX, BX`      |
| `MOV dst, imm`           | 0x11      | 4     | Load immediate value                  | `MOV AX, 42`      |
| `MOV dst, [addr]`        | 0x12      | 4     | Load from memory (absolute)           | `MOV AX, [0x100]` |
| `MOV [addr], src`        | 0x13      | 4     | Store to memory (absolute)            | `MOV [0x100], AX` |
| `MOV dst, [base±offset]` | 0x14      | 4     | Load register-relative                | `MOV AX, [FP+4]`  |
| `MOV [base±offset], src` | 0x15      | 4     | Store register-relative               | `MOV [FP-2], AX`  |
| `MOV dst_byte, [addr]`   | 0x16      | 4     | Load byte from memory (zero-extend)   | `MOV AL, [0x100]` |
| `LEA dst, [base±offset]` | 0x17      | 4     | Load effective address (register-rel) | `LEA AX, [FP-4]`  |
| `MOV [addr], src_byte`   | 0x18      | 4     | Store byte to memory                  | `MOV [0x100], BL` |
| `MOV dst_byte, [base±offset]` | 0x19 | 4     | Load byte register-relative (zero-extend) | `MOV CL, [FP+4]` |
| `MOV [base±offset], src_byte` | 0x1A | 4     | Store byte register-relative          | `MOV [FP-2], DL` |
| `MOV [base], imm`        | 0x1B      | 4     | Store 16-bit immediate to register-indirect  | `MOV [CX], 1000`     |
| `MOV [addr], imm`        | 0x1C      | 4     | Store 8-bit immediate to memory (0-255)        | `MOV [count], 42` |
| `MOV dst, [base+index]`  | 0x2D      | 4     | Load indexed (base + index register)  | `MOV AX, [BX+CX]` |
| `MOV [base+index], src`  | 0x2E      | 4     | Store indexed (base + index register) | `MOV [BX+CX], AX` |

**Encoding Details:**
- **0x10**: MOV reg, reg - `[0x10][dst][src][0x00]`
- **0x11**: MOV reg, imm - `[0x11][dst][imm_hi][imm_lo]`
- **0x12**: LOAD reg, [addr] - `[0x12][dst][addr_hi][addr_lo]`
- **0x13**: STORE [addr], reg - `[0x13][src][addr_lo][addr_hi]`
- **0x14**: LOADR reg, [base+offset] - `[0x14][dst][base][offset]`
- **0x15**: STORER [base+offset], reg - `[0x15][src][base][offset]`
- **0x16**: LOADB reg, [addr] - `[0x16][dst][addr_hi][addr_lo]` (load byte, zero-extend)
- **0x17**: LEA reg, [base+offset] - `[0x17][dst][base][offset]`
- **0x18**: STOREB [addr], reg_low - `[0x18][src][addr_lo][addr_hi]` (store low byte)
- **0x19**: LOADBR reg, [base+offset] - `[0x19][dst][base][offset]` (load byte, zero-extend)
- **0x1A**: STOREBR [base+offset], reg_low - `[0x1A][src][base][offset]` (store low byte)
- **0x1B**: STOREI [base], imm - `[0x1B][base][imm_hi][imm_lo]` (store immediate to [reg])
- **0x1C**: STOREI_DIRECT [addr], byte_imm - `[0x1C][addr_hi][addr_lo][byte_imm]` (store byte immediate to direct address)
- **0x2D**: LOAD_INDEXED reg, [base+index] - `[0x2D][dst][base][index]` (load from base+index)
- **0x2E**: STORE_INDEXED [base+index], reg - `[0x2E][src][base][index]` (store to base+index)

**Byte Operations:**

Byte load operations (0x16, 0x19) read a single byte from memory and **zero-extend** it to 16 bits before storing in the destination register.

Byte store operations (0x18, 0x1A) write only the **low byte** of the source register to memory.

**Examples:**
```asm
; Byte register usage
MOV AL, 'A'           ; AL = 0x41, AX = 0x0041
MOV [buffer], BL      ; Store low byte of BX to buffer

; Load byte (zero-extended)
MOV AL, [message]     ; Load byte, AX = 0x00XX

; Store byte
MOV CL, 0             ; CL = 0
MOV [buffer], CL      ; Store null terminator

; Register-relative byte operations
MOV AL, [BX+0]        ; Load byte from BX pointer
MOV [CX+5], DL        ; Store byte at offset 5 from CX

; Store immediate to register-indirect address
MOV CX, buffer        ; CX = address of buffer
MOV [CX], 0           ; Store 0 (word) to [buffer] - useful for null termination

; Store byte immediate to direct address (common for initialization)
MOV [counter], 0      ; Initialize counter to 0
MOV [flag], 1         ; Set flag to 1
MOV [max_value], 255  ; Set maximum value

; Indexed addressing for array access
MOV BX, array         ; Base address
MOV CX, 4             ; Index (element 2 * 2 bytes)
MOV AX, [BX+CX]       ; Load array[2]
MOV [BX+CX], DX       ; Store to array[2]
```

**Indexed Addressing Mode:**

Indexed addressing enables efficient array access with runtime-computed indices:

```asm
; Example: zero out array using indexed addressing
    MOV BX, array     ; BX = array base address
    MOV CX, 0         ; CX = index (in bytes)
    MOV AX, 0         ; AX = value to store
    MOV DX, 10        ; DX = count

fill_loop:
    MOV [BX+CX], AX   ; Store 0 to array[index]
    ADD CX, 2         ; Next element (words are 2 bytes)
    DEC DX
    JNZ fill_loop
```

**Indexed Addressing Details:**
- Syntax (load): `MOV dst, [base+index]` where both base and index are registers
- Syntax (store): `MOV [base+index], src` where both base and index are registers
- Address calculated as: `memory[base_reg + index_reg]`
- Useful for array traversal with variable indices
- Both base and index can be any general-purpose register (AX-FX)
- Supported with MOV instruction (opcodes 0x2D load, 0x2E store)

**Comparison with Register-Relative Addressing:**
- **Register-Relative**: `MOV AX, [FP-4]` - offset is a constant (-128 to +127)
  - Good for: stack frames, fixed-offset data structures
- **Indexed**: `MOV AX, [BX+CX]` - offset is in a register (0 to 65535)
  - Good for: arrays, dynamic indexing, runtime-computed offsets

**Array Access Examples:**
```asm
; Read and write array elements
array: DW 10, 20, 30, 40, 50

main:
    MOV BX, array     ; Base address
    MOV CX, 4         ; Index = 2 (element 2) * 2 bytes = 4
    MOV AX, [BX+CX]   ; Load array[2] (value 30)
    ADD AX, 100       ; Add 100
    MOV [BX+CX], AX   ; Store back to array[2] (now 130)
```

**Note on MOV with immediate values:**
- `MOV [reg], imm` (0x1B): Works with register-indirect addressing (e.g., `MOV [CX], 0`)
  - Stores full 16-bit word value (0-65535)
  - Useful for initializing memory via pointer
- `MOV [addr], byte_imm` (0x1C): Works with direct addresses (e.g., `MOV [count], 42`)
  - **Limited to byte values (0-255)** due to 4-byte instruction format
  - Stores value as 16-bit word (zero-extended to 16 bits)
  - For values > 255, use two-instruction sequence: `MOV AX, value; MOV [label], AX`
  - Common use cases: flags, counters, small constants

> **vs x86:** x86 supports full 32-bit immediate values with direct memory addressing. X366 limits direct-address stores to 8-bit immediates to maintain 4-byte instruction size (1 byte opcode + 2 bytes address + 1 byte immediate). For 16-bit immediates, use register-indirect `MOV [reg], imm` or the two-instruction workaround. X366's indexed addressing `[base+index]` is similar to x86's `[base+index]` mode but without scaling factors.

> **vs x86:** X366 uses separate opcodes for each addressing mode. x86 encodes addressing modes in the ModR/M byte with the same opcode. LEA only supports register-relative addressing in X366; use MOV for loading immediate addresses. X366 only supports low-byte access (AL, BL, CL, DL), unlike x86 which also supports high-byte access (AH, BH, CH, DH). X366's indexed mode is simpler than x86's, with no scale/index/base (SIB) byte complexity.

### Arithmetic (6 instructions)

| Instruction              | Opcode           | Bytes | Description                            | Example           |
|--------------------------|------------------|-------|----------------------------------------|-------------------|
| `ADD dst, src`           | 0x20-0x21,0x28-0x29 | 4     | Addition                               | `ADD AX, BX`      |
| `ADD dst, [addr]`        | 0x28             | 4     | Add from memory (absolute)             | `ADD AX, [0x100]` |
| `ADD dst, [base±offset]` | 0x29             | 4     | Add from memory (register-relative)    | `ADD AX, [FP+4]`  |
| `SUB dst, src`           | 0x22-0x23,0x2A-0x2B | 4     | Subtraction                            | `SUB AX, 10`      |
| `SUB dst, [addr]`        | 0x2A             | 4     | Subtract from memory (absolute)        | `SUB AX, [0x100]` |
| `SUB dst, [base±offset]` | 0x2B             | 4     | Subtract from memory (register-relative) | `SUB AX, [FP-2]`  |
| `INC reg`                | 0x24             | 2     | Increment register                     | `INC CX`          |
| `INC [addr]`             | 0x1D             | 4     | Increment word in memory (x86-compatible) | `INC [counter]` |
| `INC [base±offset]`      | 0x1F             | 4     | Increment word register-relative (x86-compatible) | `INC [FP-2]` |
| `DEC reg`                | 0x25             | 2     | Decrement register                     | `DEC DX`          |
| `DEC [addr]`             | 0x1E             | 4     | Decrement word in memory (x86-compatible) | `DEC [count]`   |
| `DEC [base±offset]`      | 0x2C             | 4     | Decrement word register-relative (x86-compatible) | `DEC [SP+4]` |
| `MUL src`                | 0x26             | 2     | Multiply (AX = AX * src)               | `MUL BX`          |
| `DIV src`                | 0x27             | 2     | Divide (AX = AX / src, DX = remainder) | `DIV CX`          |

**Encoding Details:**
- **0x20**: ADD reg, reg - `[0x20][dst][src][0x00]`
- **0x21**: ADD reg, imm - `[0x21][dst][imm_hi][imm_lo]`
- **0x28**: ADD reg, [addr] - `[0x28][dst][addr_hi][addr_lo]`
- **0x29**: ADD reg, [base+offset] - `[0x29][dst][base][offset]`
- **0x22**: SUB reg, reg - `[0x22][dst][src][0x00]`
- **0x23**: SUB reg, imm - `[0x23][dst][imm_hi][imm_lo]`
- **0x2A**: SUB reg, [addr] - `[0x2A][dst][addr_hi][addr_lo]`
- **0x2B**: SUB reg, [base+offset] - `[0x2B][dst][base][offset]`

> **Note:** MUL and DIV always use AX as destination. DIV places remainder in DX. ADD and SUB now support memory operands with both absolute and register-relative addressing, consistent with MOV instructions.

### Logical & Bitwise (6 instructions)

| Instruction      | Opcode    | Bytes | Description           | Example        |
|------------------|-----------|-------|-----------------------|----------------|
| `AND dst, src`   | 0x30/0x31 | 4     | Bitwise AND           | `AND AX, 0xFF` |
| `OR dst, src`    | 0x32/0x33 | 4     | Bitwise OR            | `OR BX, CX`    |
| `XOR dst, src`   | 0x34/0x35 | 4     | Bitwise XOR           | `XOR AX, AX`   |
| `NOT reg`        | 0x36      | 2     | Bitwise NOT           | `NOT DX`       |
| `SHL dst[, count]` | 0x37      | 4     | Shift left (logical)  | `SHL AX, 2`    |
| `SHR dst[, count]` | 0x38      | 4     | Shift right (logical) | `SHR BX, 4`    |

**Encoding Details:**
- Even opcodes (0x30, 0x32, 0x34): register-register operations
- Odd opcodes (0x31, 0x33, 0x35): register-immediate operations

> **vs x86:** X366 only supports logical shifts. x86 also has arithmetic shifts (SAL/SAR) and rotates (ROL/ROR/RCL/RCR).

### Comparison & Jumps (8 instructions)

| Instruction              | Opcode           | Bytes | Description                         | Example          |
|--------------------------|------------------|-------|-------------------------------------|------------------|
| `CMP op1, op2`           | 0x40-0x41,0x42-0x43 | 4     | Compare (sets flags)                | `CMP AX, 0`      |
| `CMP op1, [addr]`        | 0x42             | 4     | Compare with memory (absolute)      | `CMP AX, [0x100]`|
| `CMP op1, [base±offset]` | 0x43             | 4     | Compare with memory (register-relative) | `CMP AX, [FP+4]` |
| `JMP addr`               | 0x50             | 4     | Unconditional jump                  | `JMP loop`       |
| `JE addr` / `JZ addr`    | 0x51             | 4     | Jump if equal / zero (ZF=1)         | `JE done`        |
| `JNE addr` / `JNZ addr`  | 0x52             | 4     | Jump if not equal / not zero (ZF=0) | `JNE loop`       |
| `JL addr`                | 0x53             | 4     | Jump if less (signed)               | `JL negative`    |
| `JG addr`                | 0x54             | 4     | Jump if greater (signed)            | `JG positive`    |
| `JLE addr`               | 0x55             | 4     | Jump if less or equal (signed)      | `JLE done`       |
| `JGE addr`               | 0x56             | 4     | Jump if greater or equal (signed)   | `JGE start`      |
| `LOOP addr`              | 0x57             | 4     | Decrement CX and jump if CX != 0    | `LOOP again`     |

**Encoding Details:**
- **0x40**: CMP reg, reg - `[0x40][op1][op2][0x00]`
- **0x41**: CMP reg, imm - `[0x41][op1][imm_hi][imm_lo]`
- **0x42**: CMP reg, [addr] - `[0x42][op1][addr_hi][addr_lo]`
- **0x43**: CMP reg, [base+offset] - `[0x43][op1][base][offset]`
- **0x50-0x57**: Jump instructions - `[opcode][0x00][addr_hi][addr_lo]`

**Conditional Jump Aliases:**
- **JZ/JNZ** are aliases for **JE/JNE** (same opcodes, same behavior)
- Use **JE/JNE** after comparisons (thinking about equality): `CMP AX, BX; JE equal`
- Use **JZ/JNZ** after tests or arithmetic (thinking about zero): `TEST AX, AX; JZ is_zero`
- This matches standard x86 assembly practice for code clarity

**LOOP Instruction:**

The LOOP instruction provides a convenient way to implement counted loops:

```asm
; Print numbers 1-10
    MOV CX, 10
print_loop:
    MOV AX, CX
    SYSCALL PRINT_INT
    LOOP print_loop    ; Decrements CX and jumps if CX != 0
```

**LOOP Behavior:**
1. Decrement CX by 1
2. If CX != 0, jump to target address
3. If CX == 0, continue to next instruction

**Example - Array initialization:**
```asm
    MOV BX, array     ; BX = array pointer
    MOV CX, 10        ; 10 elements
    MOV AX, 0         ; Value to store
fill_loop:
    MOV [BX], AX
    ADD BX, 2         ; Next word
    LOOP fill_loop    ; CX decremented automatically
```

> **vs x86:** X366's LOOP instruction is identical to x86's LOOP instruction. It decrements CX and jumps if CX != 0, providing a compact way to implement counted loops.

> **vs x86:** X366 uses absolute addresses for jumps/calls. x86 primarily uses relative offsets (IP-relative).
> CMP supports memory operands with both absolute and register-relative addressing.
> Like x86, X366 supports JZ/JNZ as aliases for JE/JNE and LOOP for counted loops.

### Stack & Functions (4 instructions)

| Instruction | Opcode | Bytes | Description                   | Example     |
|-------------|--------|-------|-------------------------------|-------------|
| `PUSH src`  | 0x60   | 2     | Push register onto stack      | `PUSH AX`   |
| `POP dst`   | 0x61   | 2     | Pop from stack to register    | `POP FP`    |
| `CALL addr` | 0x70   | 4     | Call function (push PC, jump) | `CALL func` |
| `RET`       | 0x71   | 2     | Return from function (pop PC) | `RET`       |

**Encoding Details:**
- **0x60**: PUSH reg - `[0x60][src][pad][pad]` (only 2 bytes used)
- **0x61**: POP reg - `[0x61][dst][pad][pad]` (only 2 bytes used)
- **0x70**: CALL addr - `[0x70][0x00][addr_lo][addr_hi]`
- **0x71**: RET - `[0x71][0x00]`

> **Stack Behavior:** SP decrements by 2 before each PUSH (pre-decrement), increments by 2 after each POP 
> (post-increment). Stack grows downward.

### System (3 instructions)

| Instruction    | Opcode | Bytes | Description    | Example        |
|----------------|--------|-------|----------------|----------------|
| `NOP`          | 0x00   | 2     | No operation   | `NOP`          |
| `HLT/HALT`     | 0x01   | 2     | Halt execution | `HLT`          |
| `SYSCALL name` | 0x90   | 2     | System call    | `SYSCALL EXIT` |

**SYSCALL Encoding:**
- Format: `[0x90][syscall_code]`
- Syscall code is in the instruction, not in a register

**System Call Table:**

| Code | Name         | Arguments      | Returns | Description                  |
|------|--------------|----------------|---------|------------------------------|
| 0    | EXIT         | -              | -       | Terminate program            |
| 1    | PRINT_CHAR   | AX=char        | -       | Print character              |
| 2    | PRINT_STRING | AX=addr        | -       | Print null-terminated string |
| 3    | PRINT_INT    | AX=int         | -       | Print signed integer         |
| 4    | READ_CHAR    | -              | AX=char | Read character               |
| 5    | READ_INT     | -              | AX=int  | Read integer                 |
| 6    | READ_STRING  | AX=buf, BX=max | AX=len  | Read string                  |
| 7    | ATOI         | AX=str         | AX=int, BX=ptr | Parse integer from string    |
| 8    | SBRK         | AX=increment   | AX=old_BK | Allocate heap memory         |
| 9    | SCREEN       | -              | -       | Show/initialize screen window |
| 10   | SET_COLOR    | AX=color       | -       | Set draw color (0-15)        |
| 11   | DRAW_PIXEL   | AX=x, BX=y     | -       | Draw pixel at coordinates    |
| 12   | DRAW_LINE    | AX=x1, BX=y1, CX=x2, DX=y2 | - | Draw line between points |
| 13   | DRAW_RECT    | AX=x, BX=y, CX=width, DX=height | - | Draw filled rectangle |
| 14   | DRAW_CIRCLE  | AX=x, BX=y, CX=radius | - | Draw filled circle       |
| 15   | CLEAR_SCREEN | -              | -       | Clear screen to current color |
| 16   | DRAW_TEXT    | AX=x, BX=y, CX=addr | - | Draw text at coordinates |
| 17   | PAINT_DISPLAY | -              | -       | Update screen display        |
| 18   | SLEEP        | AX=milliseconds | -      | Sleep for specified time     |
| 19   | READ_FILE    | AX=filename, BX=buffer, CX=maxlen | AX=bytes_read | Read file contents |
| 20   | MALLOC       | AX=size        | AX=ptr  | Allocate memory block (optional, not implemented) |
| 21   | FREE         | AX=ptr         | -       | Free allocated memory block (optional, not implemented) |

**Examples:**
```asm
SYSCALL EXIT          ; Assembles to: 90 00
SYSCALL PRINT_CHAR    ; Assembles to: 90 01
SYSCALL PRINT_INT     ; Assembles to: 90 03
SYSCALL READ_INT      ; Assembles to: 90 05
SYSCALL ATOI          ; Assembles to: 90 07
SYSCALL SBRK          ; Assembles to: 90 08
SYSCALL SCREEN        ; Assembles to: 90 09
SYSCALL DRAW_PIXEL    ; Assembles to: 90 0B
SYSCALL SLEEP         ; Assembles to: 90 12
SYSCALL READ_FILE     ; Assembles to: 90 13
```

**Note:** SYSCALL 20 (MALLOC) and SYSCALL 21 (FREE) are reserved but not implemented in the JavaScript emulator. These are intended as optional student exercises for implementing dynamic memory allocation.

**ATOI Details:**

ATOI (ASCII to Integer) parses an integer from a string with automatic whitespace handling:

- **Input**: AX = pointer to string position
- **Output**:
  - AX = parsed integer value (0 if no digits found)
  - BX = pointer to first character after the parsed number
- **Behavior**:
  - Automatically skips leading whitespace (space, tab, newline, carriage return)
  - Parses consecutive digit characters ('0'-'9')
  - Stops at first non-digit character
  - Returns pointer positioned after the last digit consumed
  - Useful for parsing space-separated numbers in a single string

**Example Usage:**
```asm
; Parse numbers from command line input
; Run with: x366 program.bin "30 10 20"
main:
    ; AX already points to command line input "30 10 20"
    MOV BX, AX

    ; Parse first number
    MOV AX, BX
    SYSCALL ATOI        ; AX = 30, BX points to " 10 20"
    PUSH AX             ; Save first number

    ; Parse second number
    MOV AX, BX
    SYSCALL ATOI        ; AX = 10, BX points to " 20"
    PUSH AX             ; Save second number

    ; Parse third number
    MOV AX, BX
    SYSCALL ATOI        ; AX = 20, BX points to null terminator
    PUSH AX             ; Save third number

    ; Process numbers...
```

**ATOI with Loop:**
```asm
; Parse all numbers from input and push onto stack
main:
    MOV BX, AX          ; BX = pointer to input

parse_loop:
    MOV AX, [BX+0]      ; Check if at end
    AND AX, 0xFF
    CMP AX, 0
    JE done

    MOV AX, BX
    SYSCALL ATOI        ; Parse next number
    PUSH AX             ; Save on stack
    JMP parse_loop

done:
    ; Numbers are now on stack
```

**SBRK Details:**

SBRK (Set Break) adjusts the heap boundary for dynamic memory allocation:

- **Input**: AX = number of bytes to increment BK (can be negative to deallocate)
- **Output**: AX = old BK value (pointer to newly allocated memory)
- **Behavior**:
  - Increments BK by the value in AX
  - Returns the old BK value, which points to the start of the newly allocated region
  - Similar to Unix sbrk() system call
  - Useful for implementing malloc/free

**Example Usage:**
```asm
; Allocate 100 bytes on heap
MOV AX, 100
SYSCALL SBRK        ; AX now points to allocated memory
MOV BX, AX          ; Save pointer to allocated memory

; Use the allocated memory
MOV [BX+0], CX      ; Store values
MOV [BX+2], DX

; Deallocate (optional - usually just let BK grow)
MOV AX, -100
SYSCALL SBRK        ; BK decreases by 100
```

**READ_FILE Details:**

READ_FILE loads file contents into a memory buffer:

- **Input**:
  - AX = pointer to null-terminated filename string
  - BX = pointer to buffer where content will be stored
  - CX = maximum number of characters to read
- **Output**:
  - AX = number of bytes read (or -1 on error)
  - Buffer at BX is filled with file content and null-terminated
- **Behavior**:
  - Reads up to CX characters from the file
  - Automatically null-terminates the buffer
  - Returns -1 in AX if file cannot be read
  - Useful for loading configuration files or data files

**Example Usage:**
```asm
; Read a file
MOV AX, filename     ; Pointer to "data.txt\0"
MOV BX, buffer       ; Pointer to buffer
MOV CX, 1024         ; Max bytes to read
SYSCALL READ_FILE    ; Read file
CMP AX, -1           ; Check for error
JE file_error
; File content is now in buffer, AX contains bytes read

filename: DB "data.txt", 0
buffer: DB 1024 DUP(0)  ; 1KB buffer
```

**MALLOC and FREE (Optional, Not Implemented):**

SYSCALL 20 (MALLOC) and SYSCALL 21 (FREE) are reserved syscall numbers for dynamic memory allocation but are **not implemented** in the JavaScript emulator. These are intended as optional student exercises.

**Suggested MALLOC Implementation:**
- **Input**: AX = number of bytes to allocate
- **Output**: AX = pointer to allocated memory block (or -1 on failure)
- Should use a free list to reuse previously freed blocks
- Should grow the heap via SBRK when needed

**Suggested FREE Implementation:**
- **Input**: AX = pointer to memory block to free
- **Output**: None
- Should return blocks to a free list for reuse by MALLOC

**For Now, Use SBRK:**

Until you implement MALLOC/FREE, use SBRK for dynamic memory allocation:

```asm
; Allocate 100 bytes using SBRK
MOV AX, 100
SYSCALL SBRK        ; AX now points to allocated memory
MOV BX, AX          ; Save pointer

; Use the allocated memory
MOV [BX+0], 1000
MOV [BX+2], 2000
```

**Note:** SBRK does not support freeing memory - once allocated, the heap only grows. Implementing MALLOC/FREE with a free list allows memory reuse.

> **vs x86:** x86 Linux uses INT 0x80 or SYSCALL instruction with syscall number in EAX/RAX. X366 encodes
> syscall number in the instruction itself. The graphics syscalls (SCREEN, SET_COLOR, DRAW_*, etc.) and MALLOC/FREE
> are unique to X366 for educational purposes. In real systems, malloc/free are typically library functions, not syscalls.

## Addressing Modes

X366 supports 6 addressing modes:

```asm
Immediate:         MOV AX, 42          ; Load constant
Register:          MOV AX, BX          ; Register to register
Direct:            MOV AX, [0x100]     ; Absolute memory address
Register-indirect: MOV AX, [BX]        ; Memory address in register
Register-relative: MOV AX, [FP+4]      ; Base + signed offset
                   MOV AX, [FP-2]      ; Negative offset for locals
Indexed:           MOV AX, [BX+CX]     ; Base + index register
                   MOV [BX+CX], AX     ; Store with indexed addressing
```

**Memory Operations Support:**

The following instructions support memory operands with both absolute, register-relative, and indexed addressing:

- **MOV**: Load/store operations
  - `MOV reg, [addr]` - Load from absolute address
  - `MOV [addr], reg` - Store to absolute address
  - `MOV reg, [base±offset]` - Load with base+offset (signed byte offset: -128 to +127)
  - `MOV [base±offset], reg` - Store with base+offset
  - `MOV reg, [base+index]` - Load with indexed addressing (both registers)
  - `MOV [base+index], reg` - Store with indexed addressing (both registers)

- **ADD/SUB**: Arithmetic operations (read-only from memory)
  - `ADD reg, [addr]` - Add value from absolute address to register
  - `ADD reg, [base±offset]` - Add value from register-relative address to register
  - `SUB reg, [addr]` - Subtract value from absolute address from register
  - `SUB reg, [base±offset]` - Subtract value from register-relative address from register

- **CMP**: Comparison operations (read-only from memory)
  - `CMP reg, [addr]` - Compare register with value at absolute address
  - `CMP reg, [base±offset]` - Compare register with value at register-relative address

**Examples:**
```asm
; MOV operations
MOV AX, [0x200]       ; Load from address 0x200
MOV [0x300], BX       ; Store to address 0x300
MOV AX, [FP+6]        ; Load parameter (positive offset)
MOV [FP-2], CX        ; Store local variable (negative offset)
MOV BX, [SP+4]        ; Access stack-relative data

; Indexed addressing
MOV AX, [BX+CX]       ; Load from base+index
MOV [BX+DX], AX       ; Store to base+index

; Arithmetic with memory
ADD AX, [0x100]       ; Add value from memory to AX
SUB BX, [FP-4]        ; Subtract local variable from BX
ADD CX, [data]        ; Add value from label 'data' to CX

; Comparison with memory
CMP AX, [0x200]       ; Compare AX with value at address
CMP BX, [FP+8]        ; Compare BX with parameter

; LEA operations (register-relative only)
LEA AX, [FP-4]        ; AX = FP - 4 (address of local variable)
LEA BX, [SP+8]        ; BX = SP + 8 (address calculation)

; For loading constant addresses, use MOV instead of LEA
MOV AX, 0x200         ; AX = 0x200 (load immediate address)
```

**LEA (Load Effective Address) Use Cases:**
- **Get address of local variable**: `LEA AX, [FP-4]` - useful for passing pointers to locals
- **Compute stack addresses**: `LEA AX, [SP+8]` - calculate addresses on the stack
- **Pointer arithmetic**: Compute addresses without dereferencing memory

**Note:** LEA only supports register-relative addressing `[reg±offset]`. For loading constant addresses, use `MOV reg, imm` instead (e.g., `MOV AX, 0x200`).

**Important Notes:**
- Memory operands in ADD, SUB, and CMP are **read-only** - the destination must be a register
- For example, `ADD [addr], AX` is **not supported** - use `MOV BX, [addr]; ADD BX, AX; MOV [addr], BX` instead
- This design keeps the instruction set simple while supporting common patterns like comparing against constants in memory or adding array elements

> **vs x86:** X366's register-relative mode uses a signed byte offset (-128 to +127). x86 supports much larger
> displacements (32-bit). X366 doesn't support scaled index modes like x86's [base + index*scale + disp]. However, X366's support for memory operands in ADD/SUB/CMP is similar to x86's approach.

## Data Directives

X366 supports two data definition directives and a memory configuration directive:

### .MEMORY (Memory Size Declaration)

Declares the amount of memory required by the program.

```asm
.MEMORY size

Examples:
.MEMORY 1K               ; 1024 bytes (default)
.MEMORY 2K               ; 2048 bytes
.MEMORY 4K               ; 4096 bytes
.MEMORY 8K               ; 8192 bytes
.MEMORY 16K              ; 16384 bytes
```

**Usage Notes:**
- Must be specified before any code or data directives
- Only valid sizes are: 1K, 2K, 4K, 8K, or 16K
- The assembler stores the memory size in the binary header (0x000A-0x000B)
- The emulator reads this value and automatically allocates the required memory
- If not specified, defaults to 1K (1024 bytes)

**Example:**
```asm
.MEMORY 16K

; Now you can use 16KB of memory
buffer: DB 8192 DUP(0)    ; Large buffer
stack: DB 4096 DUP(?)     ; Large stack space

main:
    ; Your code here
```

### DB (Define Byte)

Define byte-sized data (8-bit values).

```asm
DB value [, value, ...]

Examples:
msg: DB "Hello", 0           ; String with null terminator
data: DB 10, 20, 30          ; Array of bytes
mixed: DB "AB", 0, 65        ; Mixed string and numeric

; DUP (Duplicate) syntax - x86 compatible
buffer: DB 100 DUP(0)        ; 100 bytes initialized to 0
stack: DB 1024 DUP(?)        ; 1024 bytes uninitialized (? = 0)
spaces: DB 10 DUP(32)        ; 10 space characters
mixed: DB "Name:", 0, 50 DUP(?), 0  ; String + 50-byte buffer + null

; Character literals - x86 compatible
msg: DB 'H', 'e', 'l', 'l', 'o', '\n', '\0'  ; Character literals
space: DB ' ', 0             ; Space character
newline: DB '\n', 0          ; Newline character
tab: DB '\t', 0              ; Tab character
null: DB '\0'                ; Null terminator
backslash: DB '\\'           ; Backslash character
quote: DB '\''               ; Single quote character
```

### DW (Define Word)

Define word-sized data (16-bit values, big-endian).

```asm
DW value [, value, ...]

Examples:
array: DW 1000, 2000, 3000   ; Array of 16-bit integers
value: DW 0x1234             ; Single word (stored as 12 34 big-endian)
multi: DW 100, 200, 300      ; Multiple words

; DUP (Duplicate) syntax - x86 compatible
buffer: DW 50 DUP(0)         ; 50 words (100 bytes) initialized to 0
array: DW 25 DUP(?)          ; 25 words uninitialized (? = 0)
flags: DW 10 DUP(1)          ; 10 words initialized to 1
```

**Usage with Labels:**
```asm
JMP start

msg: DB "Hello", 0
count: DW 0

start:
    LEA AX, msg              ; AX = address of msg
    SYSCALL PRINT_STRING

    MOV AX, [count]          ; Load word from count
    INC AX
    MOV [count], AX          ; Store back
```

> **Important:** Data directives place data at the current address. If code starts at 0x0020, the data will be
> there. Use JMP to skip over data sections, or place data at the end of the program.

## Character Literals

X366 supports **character literals** (x86-compatible syntax) for improved code readability. Character literals can be used anywhere an immediate value is expected, including in instructions and data directives.

### Syntax

```asm
'c'          ; Single character (e.g., 'A' = 65, ' ' = 32)
'\X'         ; Escape sequence for special characters
```

### Supported Escape Sequences

| Escape | Value | Description |
|--------|-------|-------------|
| `'\n'` | 10 | Newline (line feed) |
| `'\t'` | 9 | Tab (horizontal tab) |
| `'\r'` | 13 | Carriage return |
| `'\0'` | 0 | Null terminator |
| `'\\'` | 92 | Backslash |
| `'\''` | 39 | Single quote |

### Usage in Instructions

Character literals make code more readable by replacing numeric ASCII values:

```asm
; Character comparisons
MOV AL, [buffer]
CMP AL, '\0'              ; Check for null terminator (instead of CMP AL, 0)
JE done
CMP AL, ' '               ; Check for space (instead of CMP AL, 32)
JE skip_space
CMP AL, '\n'              ; Check for newline (instead of CMP AL, 10)
JE new_line

; Character printing
MOV AL, 'A'               ; Load 'A' (instead of MOV AL, 65)
SYSCALL PRINT_CHAR
MOV AL, '\n'              ; Load newline (instead of MOV AL, 10)
SYSCALL PRINT_CHAR

; Character storage
MOV [buffer], 'X'         ; Store character (instead of MOV [buffer], 88)
MOV AL, '\0'
MOV [buffer+5], AL        ; Null-terminate string
```

### Usage in Data Directives

Character literals and escape sequences can be used in both DB directives and string literals:

```asm
; String literals support escape sequences (preferred syntax)
prompt: DB "Enter: \0"
message: DB "Hello, World!\n\0"
path: DB "C:\\Users\\name\0"

; Character literals (less common, but supported)
data: DB 'A', 'B', 'C', '\n', '\0'
separator: DB '\t', '\t', '\n', '\0'
line_end: DB '\r', '\n', '\0'         ; Windows-style line ending

; Both syntaxes are equivalent
msg1: DB "test\n\0"                   ; Preferred: escape sequences in strings
msg2: DB "test", '\n', '\0'           ; Also works: separate character literals
```

**Recommended Style:** Use escape sequences directly within string literals (`"Hello\n\0"`) rather than separate character literals (`"Hello", '\n', '\0'`). This is more concise and matches standard x86 assembly practice.

### Examples

**Parsing with character literals:**
```asm
; Parse until space or null
parse_loop:
    MOV AL, [BX]
    CMP AL, '\0'          ; End of string
    JE done
    CMP AL, ' '           ; Space separator
    JE done
    INC BX
    JMP parse_loop
```

**Character classification:**
```asm
; Check if character is a digit ('0'-'9')
is_digit:
    MOV AL, [BX]
    CMP AL, '0'           ; Below '0'?
    JL not_digit
    CMP AL, '9'           ; Above '9'?
    JG not_digit
    ; It's a digit
    RET
not_digit:
    ; Not a digit
    RET
```

**Building strings:**
```asm
; Build a CSV line
build_csv:
    MOV [buffer+0], 'A'
    MOV [buffer+1], ','
    MOV [buffer+2], 'B'
    MOV [buffer+3], ','
    MOV [buffer+4], 'C'
    MOV [buffer+5], '\n'
    MOV [buffer+6], '\0'
    RET
```

> **vs x86:** Character literal syntax in X366 is identical to x86 assembly. Both use single quotes for character literals and support the same escape sequences.

## Calling Convention

X366 uses a **register-based calling convention**, similar to modern architectures (x86-64, ARM, RISC-V).

### Parameter Passing

```
Register   Purpose
────────────────────────────
AX         First parameter / Return value
BX         Second parameter
CX         Third parameter
DX         Fourth parameter
EX         Fifth parameter
FX         Sixth parameter
```

**Maximum:** 6 parameters per function

> **vs x86-32:** x86-32 (cdecl) passes all parameters on the stack.

> **vs x86-64:** x86-64 System V ABI uses RDI, RSI, RDX, RCX, R8, R9 for the first 6 parameters. X366 uses AX, BX, CX,
> DX, EX, FX for 6 parameters - matching x86-64's parameter count.

### Register Preservation

```
Caller-saved (scratch):  AX, BX, CX, DX, EX, FX
  - Not preserved across function calls
  - Caller must save if needed after call

Callee-saved:  SP, FP
  - Must be preserved by callee
  - Callee must restore before returning
```

### Function Call Protocol

**Caller:**
1. Save any needed values in AX-FX (push them)
2. Place parameters in AX, BX, CX, DX, EX, FX (up to 6)
3. Execute `CALL function`
4. Result is returned in AX

**Callee:**
1. Parameters are already in AX, BX, CX, DX, EX, FX
2. If using FP: `PUSH FP; MOV FP, SP`
3. If using locals: `SUB SP, size`
4. Perform computation
5. Place return value in AX
6. If using locals: `MOV SP, FP`
7. If saved FP: `POP FP`
8. Execute `RET`

### Simple Function Example

```asm
; add(a, b) returns a + b
add:
    ADD AX, BX           ; AX = AX + BX
    RET                  ; Return with result in AX

; Caller
main:
    MOV AX, 10           ; First parameter
    MOV BX, 20           ; Second parameter
    CALL add             ; Result in AX (30)
    SYSCALL PRINT_INT
```

### Function with Stack Frame

```asm
; multiply_add(a, b, c) returns (a*b) + c
; Parameters: AX=a, BX=b, CX=c
; Uses one local variable
multiply_add:
    PUSH FP              ; Save caller's FP
    MOV FP, SP           ; Set up frame pointer
    SUB SP, 2            ; Allocate 1 local variable (word)

    ; Parameters already in registers!
    MUL BX               ; AX = a * b
    MOV [FP-2], AX       ; Store in local variable
    MOV AX, [FP-2]       ; Load it back
    ADD AX, CX           ; AX = (a*b) + c

    MOV SP, FP           ; Deallocate locals
    POP FP               ; Restore FP
    RET

; Caller
main:
    MOV SP, 0x0400       ; Initialize stack
    MOV AX, 5            ; a = 5
    MOV BX, 3            ; b = 3
    MOV CX, 2            ; c = 2
    CALL multiply_add    ; Returns 17 in AX
```

**Stack Frame Layout (when FP is used):**
```
[FP+2]   = return address (pushed by CALL)
[FP+0]   = saved FP (pushed by PUSH FP)
[FP-2]   = local variable 1
[FP-4]   = local variable 2
...
[SP]     = current stack top
```

### Caller-Saved Example

```asm
; If caller needs to preserve AX across a call
main:
    MOV AX, 100          ; Important value
    PUSH AX              ; Save it

    MOV AX, 1            ; Set up parameters
    MOV BX, 2
    CALL some_function   ; Modifies AX-DX

    POP AX               ; Restore saved value
    ; Continue with original AX
```

> **vs x86-32 cdecl:** Much simpler! No stack cleanup needed, parameters are already in registers, faster execution.

> **vs x86-64:** Similar approach, but different registers. X366 is limited to 4 parameters vs x86-64's 6.

## Complete Examples

### Hello World

```asm
.MEMORY 1K

msg: DB "Hello, World!", '\n', '\0'

MOV AX, msg          ; AX = address of message
SYSCALL PRINT_STRING ; Print the string
SYSCALL EXIT         ; Exit program
```

### Command Line Echo

```asm
; Echo command line input back to user
; Run with: x366 program.bin "Hello from command line!"
; AX already points to command line input
SYSCALL PRINT_STRING ; Print the input
SYSCALL EXIT
```

### Parse and Add Numbers

```asm
; Add two numbers from command line
; Run with: x366 program.bin "10 20"
MOV BX, AX           ; Save input pointer

; Parse first number
MOV AX, BX
SYSCALL ATOI         ; AX = 10, BX = updated pointer
PUSH AX              ; Save first number

; Parse second number
MOV AX, BX
SYSCALL ATOI         ; AX = 20, BX = updated pointer

; Add them
POP BX               ; BX = first number
ADD AX, BX           ; AX = 10 + 20 = 30

SYSCALL PRINT_INT
SYSCALL EXIT
```

### Factorial (Recursive)

```asm
; factorial(n) - compute n!
; Parameter: AX = n
; Returns: AX = n!
factorial:
    CMP AX, 1
    JG recursive
    MOV AX, 1            ; Base case: return 1
    RET

recursive:
    PUSH FP
    MOV FP, SP
    PUSH AX              ; Save n

    DEC AX               ; AX = n - 1
    CALL factorial       ; AX = factorial(n-1)

    POP BX               ; BX = n
    MUL BX               ; AX = n * factorial(n-1)

    POP FP
    RET

MOV AX, 5            ; Compute 5!
CALL factorial       ; Result: 120
SYSCALL PRINT_INT
SYSCALL EXIT
```

### Array Sum

```asm
; sum_array(base, length) returns sum
; Parameters: AX = base address, BX = length
sum_array:
    PUSH FP
    MOV FP, SP
    PUSH CX              ; Save CX (we'll use it)
    PUSH DX              ; Save DX

    MOV CX, 0            ; sum = 0
    MOV DX, 0            ; index = 0

loop:
    CMP DX, BX           ; Compare index with length
    JE done

    ; Load array[index] - need to use register-relative
    PUSH AX              ; Save base temporarily
    ADD AX, DX           ; AX = base + index*2
    ADD AX, DX           ; (words are 2 bytes)
    MOV AX, [AX]         ; Load value
    ADD CX, AX           ; sum += value
    POP AX               ; Restore base

    INC DX               ; index++
    JMP loop

done:
    MOV AX, CX           ; Return sum in AX
    POP DX
    POP CX
    POP FP
    RET

array: DW 10, 20, 30, 40, 50

MOV AX, array        ; Base address
MOV BX, 5            ; Length
CALL sum_array       ; Returns 150
SYSCALL PRINT_INT
SYSCALL EXIT
```

### Max of 4 Numbers

```asm
; max4(a, b, c, d) - returns maximum
; Parameters: AX=a, BX=b, CX=c, DX=d
max4:
    CMP AX, BX
    JG skip1
    MOV AX, BX           ; AX = max(AX, BX)
skip1:
    CMP AX, CX
    JG skip2
    MOV AX, CX           ; AX = max(AX, CX)
skip2:
    CMP AX, DX
    JG skip3
    MOV AX, DX           ; AX = max(AX, DX)
skip3:
    RET

MOV AX, 15
MOV BX, 42
MOV CX, 7
MOV DX, 23
CALL max4            ; Returns 42
SYSCALL PRINT_INT
SYSCALL EXIT
```

### String Length (Character Literals & Memory Operations)

```asm
.MEMORY 1K

; strlen(str) - returns length of null-terminated string
; Parameter: AX = string pointer
; Returns: AX = length
strlen:
    PUSH BX
    MOV BX, AX           ; BX = current position
    MOV AX, 0            ; AX = length counter

count_loop:
    MOV CL, [BX]
    CMP CL, '\0'         ; Check for null terminator (character literal)
    JE done
    INC AX               ; Increment length
    INC BX               ; Move to next character
    JMP count_loop

done:
    POP BX
    RET

test_str: DB "Hello, X366!", '\0'

MOV AX, test_str
CALL strlen          ; Returns 13
SYSCALL PRINT_INT
MOV AL, '\n'         ; Print newline (character literal)
SYSCALL PRINT_CHAR
SYSCALL EXIT
```

### Character Counter (Using DUP, Character Literals, and INC [addr])

```asm
.MEMORY 2K

message: DB "The quick brown fox jumps over the lazy dog!", '\n', '\0'
space_count: DW 0
letter_count: DW 0
buffer: DB 256 DUP(0)    ; Using DUP for buffer allocation

MOV BX, message

scan_loop:
    ; Load character
    MOV AL, [BX]

    ; Check for end of string
    CMP AL, '\0'
    JE print_results

    ; Check for space
    CMP AL, ' '
    JNE check_letter
    INC [space_count]    ; Memory operation - no register needed!
    JMP next_char

check_letter:
    ; Check if lowercase letter (a-z)
    CMP AL, 'a'
    JL check_upper
    CMP AL, 'z'
    JG check_upper
    INC [letter_count]   ; Memory operation
    JMP next_char

check_upper:
    ; Check if uppercase letter (A-Z)
    CMP AL, 'A'
    JL next_char
    CMP AL, 'Z'
    JG next_char
    INC [letter_count]   ; Memory operation

next_char:
    INC BX
    JMP scan_loop

print_results:
    ; Print letter count
    MOV AX, [letter_count]
    SYSCALL PRINT_INT
    MOV AL, ' '
    SYSCALL PRINT_CHAR
    MOV AX, letter_str
    SYSCALL PRINT_STRING

    ; Print space count
    MOV AX, [space_count]
    SYSCALL PRINT_INT
    MOV AL, ' '
    SYSCALL PRINT_CHAR
    MOV AX, space_str
    SYSCALL PRINT_STRING

    SYSCALL EXIT

letter_str: DB "letters", '\n', '\0'
space_str: DB "spaces", '\n', '\0'
```

## Comparison with x86

| Feature | X366 | x86 (16-bit) | x86 (32-bit) | x86-64 |
|---------|-----|--------------|--------------|--------|
| **Word Size** | 16-bit | 16-bit | 32-bit | 64-bit |
| **Memory** | 1KB | 1MB | 4GB | 16EB |
| **Instruction Length** | 2 or 4 bytes | 1-6 bytes | 1-15 bytes | 1-15 bytes |
| **Register Count** | 8 (6 GP + 2 special) | 14 | 8 general | 16 general |
| **Call Convention** | Register (6 params) | Stack | Stack | Register (6 params) |
| **Addressing** | 5 modes | 11 modes | 11+ modes | Many modes |
| **Syscalls** | SYSCALL instruction | INT 0x80 | INT 0x80 | SYSCALL |
| **Jumps** | Absolute | Relative | Relative | RIP-relative |

## Differences from x86

### Terminology
- **Frame Pointer (FP)** - x86 calls this "Base Pointer" (EBP/RBP)
- **Program Counter (PC)** - x86 calls this "Instruction Pointer" (IP/EIP/RIP)

### Architectural
- Fixed 2 or 4 byte instructions vs x86's variable length
- Absolute jumps/calls vs x86's relative addressing
- Register-based parameters vs x86-32's stack parameters
- Syscall code in instruction vs x86's register-based syscall number
- No segment registers (no CS, DS, ES, SS)
- No floating point (no x87 FPU, no SSE)
- Simpler flag handling (only 4 flags vs x86's many flags)

### Simplified Features
- 6 parameter registers (matching x86-64)
- No string instructions (MOVS, CMPS, SCAS, etc.)
- No I/O instructions (IN, OUT)
- No interrupts (no INT, IRET)
- No privilege levels (no protection rings)
- No paging or segmentation
- Logical shifts only (no arithmetic shifts or rotates)

## Pedagogical Benefits

X366 is designed to teach assembly language concepts without overwhelming complexity:

1. **Familiar Syntax** - Looks like x86, eases transition to real x86
2. **Simple Register Set** - 8 registers (6 general-purpose + 2 special), clearly defined purposes
3. **Modern Calling Convention** - Register-based like contemporary architectures
4. **Fixed Instruction Length** - Easier to understand encoding
5. **Complete Feature Set** - Can implement real algorithms
6. **Small Enough** - Implementable in a semester project
7. **Clean Design** - No historical cruft or backwards compatibility issues

## Implementation Notes

### Binary Format

All assembled X366 programs follow this format:

```
Offset     Size  Content
──────────────────────────────────────────────────────────────
0x0000     8     Signature: "Go Cats!" (ASCII)
0x0008     1     Padding: 0x00
0x0009     2     Memory size in bytes (big-endian, 16-bit)
0x000B     1     Padding: 0x00
0x000C     4     Sections offset (big-endian, 32-bit)
0x0010     2     Break pointer (BK) - end of data segment (big-endian, 16-bit)
0x0012     2     Code boundary (CB) - end of code segment (big-endian, 16-bit)
0x0014     12    Reserved/padding (zeros)
0x0020     ...   Code segment (executable instructions)
...        ...   Data segment (DB/DW declarations)
...        ...   Optional sections (debug info, etc.)
```

**Header Fields:**

- **Signature (0x0000-0x0007):** "Go Cats!" identifies X366 binaries
- **Memory Size (0x0009-0x000A):** Required memory in bytes (1024, 2048, 4096, 8192, or 16384)
- **Sections Offset (0x000C-0x000F):** Byte offset where optional sections begin (0 if no sections)
- **Break Pointer (0x0010-0x0011):** End of data segment, initial value for heap allocation
- **Code Boundary (0x0012-0x0013):** End of code segment, start of data segment
- **Code Segment (0x0020+):** Executable instructions starting at 0x0020
- **Data Segment:** DB/DW declarations placed after code
- **Sections:** Optional metadata (debug info, symbols, etc.)

### Debug Section Format

The debug section (Section Type 0x01) contains source-level debugging information:

```
Offset     Size  Content
──────────────────────────────────────────────────────────────
0          1     Section type: 0x01 (debug info)
1          4     Section size in bytes (big-endian, 32-bit, excludes type and size)
5          ...   Line number map
...        ...   Symbol table
```

**Line Number Map:**

Maps program counter (PC) addresses to source line numbers for debugging.

```
Format: [PC:2][LineNum:2]... [0xFFFF][0x0000]

- PC (2 bytes, big-endian): Program counter address
- LineNum (2 bytes, big-endian): Source line number (1-indexed)
- End marker: 0xFFFF 0x0000
```

**Symbol Table:**

Contains label names and their addresses.

```
Format: [Addr:2][Type:1][Name:null-terminated]... [0xFFFF][0x00][0x00]

- Addr (2 bytes, big-endian): Symbol address
- Type (1 byte): Symbol type (0x00 = label)
- Name (variable length, null-terminated ASCII): Symbol name
- End marker: 0xFFFF 0x00 0x00
```

**Example Debug Section:**

```
01                    Section type (debug)
00 00 00 1B           Section size (27 bytes)

Line Number Map:
00 20 00 01           PC=0x0020, Line=1
00 24 00 03           PC=0x0024, Line=3
00 28 00 04           PC=0x0028, Line=4
FF FF 00 00           End marker

Symbol Table:
00 20 00 6D 61 69 6E 00     Addr=0x0020, Type=0x00, Name="main"
00 30 00 6C 6F 6F 70 00     Addr=0x0030, Type=0x00, Name="loop"
FF FF 00 00                  End marker
```

**Notes:**
- The debug section is optional and may be omitted for release builds
- Both JavaScript and Java assemblers generate identical debug section formats
- The null-terminated string format allows for symbols of any length
- Line numbers are 1-indexed (first line of source = 1)

### Emulator Requirements

A X366 emulator must:
- Implement 1024 bytes of memory by default (configurable to 2K, 4K, 8K, or 16K)
- **Read memory size from binary header** (0x000A-0x000B) and automatically resize memory before program execution
- Initialize SP to end of memory (0x0400 for 1KB, 0x0800 for 2KB, 0x1000 for 4KB, 0x2000 for 8KB, 0x4000 for 16KB)
- Initialize PC to 0x0020
- Initialize BK to first address after loaded program
- Initialize AX to point to command line input string (or 0 if none provided)
- Initialize BX, CX, DX, EX, FX, FP to 0
- Support all instructions including:
  - Byte operations (AL, BL, CL, DL register access)
  - All addressing mode variants (register, immediate, direct, register-indirect, register-relative)
  - Memory operations (INC [addr], DEC [addr])
  - Immediate store operations (MOV [reg], imm and MOV [addr], byte_imm)
- Implement all 20 syscalls (EXIT through READ_FILE)
- Handle the flags register correctly (ZF, SF, CF, OF)
- Support big-endian byte ordering for multi-byte values
- Store command line input as null-terminated string in memory

### Assembler Requirements

A X366 assembler must:
- Parse assembly source code
- Support labels (forward and backward references)
- Generate the "Go Cats!" signature at 0x0001-0x0008
- **Support .MEMORY directive** and store memory size in binary header at 0x000A-0x000B (big-endian)
- Pad to 0x0020 before code
- Encode instructions with correct opcodes and operands
- Support DB and DW data directives with:
  - String literals in double quotes ("Hello")
  - **Character literals in single quotes** ('A', '\n', '\t', etc.)
  - **DUP syntax** for buffer allocation (DB 100 DUP(0))
  - Numeric values (decimal and hexadecimal)
- **Support character literals in immediate operands** (MOV AL, 'A', CMP AL, '\n', etc.)
- Support all escape sequences: '\n', '\t', '\r', '\0', '\\', '\''
- Generate debug information (optional, for source-level debugging)
- Output big-endian binary format for multi-byte values

## Complete Instruction Encoding Reference

This section provides detailed binary layouts for all X366 instructions.

### Data Movement Instructions

| Mnemonic | Opcode | Byte 0 | Byte 1 | Byte 2 | Byte 3 | Description |
|----------|--------|--------|--------|--------|--------|-------------|
| `MOV dst, src` | 0x10 | 0x10 | dst | src | 0x00 | Move register to register |
| `MOV dst, imm` | 0x11 | 0x11 | dst | imm_hi | imm_lo | Load immediate value |
| `MOV dst, [addr]` | 0x12 | 0x12 | dst | addr_hi | addr_lo | Load from absolute address |
| `MOV [addr], src` | 0x13 | 0x13 | src | addr_lo | addr_hi | Store to absolute address |
| `MOV dst, [base±off]` | 0x14 | 0x14 | dst | base | offset | Load register-relative |
| `MOV [base±off], src` | 0x15 | 0x15 | src | base | offset | Store register-relative |
| `MOV dst_byte, [addr]` | 0x16 | 0x16 | dst | addr_hi | addr_lo | Load byte (zero-extend) |
| `LEA dst, [base±off]` | 0x17 | 0x17 | dst | base | offset | Load effective address (register-rel) |
| `MOV [addr], src_byte` | 0x18 | 0x18 | src | addr_lo | addr_hi | Store byte (low byte of src) |
| `MOV dst_byte, [base±off]` | 0x19 | 0x19 | dst | base | offset | Load byte reg-rel (zero-extend) |
| `MOV [base±off], src_byte` | 0x1A | 0x1A | src | base | offset | Store byte reg-rel (low byte) |
| `MOV [base], imm` | 0x1B | 0x1B | base | imm_hi | imm_lo | Store immediate to [reg] |
| `MOV [addr], byte_imm` | 0x1C | 0x1C | addr_hi | addr_lo | byte_imm | Store byte immediate to address |
| `MOV dst, [base+index]` | 0x2D | 0x2D | dst | base | index | Load indexed (base+index) |
| `MOV [base+index], src` | 0x2E | 0x2E | src | base | index | Store indexed (base+index) |

### Arithmetic Instructions

| Mnemonic | Opcode | Byte 0 | Byte 1 | Byte 2 | Byte 3 | Description |
|----------|--------|--------|--------|--------|--------|-------------|
| `ADD dst, src` | 0x20 | 0x20 | dst | src | 0x00 | Add register to register |
| `ADD dst, imm` | 0x21 | 0x21 | dst | imm_hi | imm_lo | Add immediate value |
| `ADD dst, [addr]` | 0x28 | 0x28 | dst | addr_hi | addr_lo | Add from absolute address |
| `ADD dst, [base±off]` | 0x29 | 0x29 | dst | base | offset | Add register-relative |
| `SUB dst, src` | 0x22 | 0x22 | dst | src | 0x00 | Subtract register from register |
| `SUB dst, imm` | 0x23 | 0x23 | dst | imm_hi | imm_lo | Subtract immediate value |
| `SUB dst, [addr]` | 0x2A | 0x2A | dst | addr_hi | addr_lo | Subtract from absolute address |
| `SUB dst, [base±off]` | 0x2B | 0x2B | dst | base | offset | Subtract register-relative |
| `INC reg` | 0x24 | 0x24 | reg | - | - | Increment register (2 bytes) |
| `INC [addr]` | 0x1D | 0x1D | 0x00 | addr_hi | addr_lo | Increment word in memory (4 bytes) |
| `INC [base±off]` | 0x1F | 0x1F | 0x00 | base | offset | Increment word register-relative (4 bytes) |
| `DEC reg` | 0x25 | 0x25 | reg | - | - | Decrement register (2 bytes) |
| `DEC [addr]` | 0x1E | 0x1E | 0x00 | addr_hi | addr_lo | Decrement word in memory (4 bytes) |
| `DEC [base±off]` | 0x2C | 0x2C | 0x00 | base | offset | Decrement word register-relative (4 bytes) |
| `MUL src` | 0x26 | 0x26 | src | - | - | Multiply AX by src (2 bytes) |
| `DIV src` | 0x27 | 0x27 | src | - | - | Divide AX by src (2 bytes) |

### Logical & Bitwise Instructions

| Mnemonic | Opcode | Byte 0 | Byte 1 | Byte 2 | Byte 3 | Description |
|----------|--------|--------|--------|--------|--------|-------------|
| `AND dst, src` | 0x30 | 0x30 | dst | src | 0x00 | Bitwise AND |
| `AND dst, imm` | 0x31 | 0x31 | dst | imm_hi | imm_lo | Bitwise AND immediate |
| `OR dst, src` | 0x32 | 0x32 | dst | src | 0x00 | Bitwise OR |
| `OR dst, imm` | 0x33 | 0x33 | dst | imm_hi | imm_lo | Bitwise OR immediate |
| `XOR dst, src` | 0x34 | 0x34 | dst | src | 0x00 | Bitwise XOR |
| `XOR dst, imm` | 0x35 | 0x35 | dst | imm_hi | imm_lo | Bitwise XOR immediate |
| `NOT reg` | 0x36 | 0x36 | reg | - | - | Bitwise NOT (2 bytes) |
| `SHL dst, count` | 0x37 | 0x37 | dst | count | 0x00 | Shift left logical |
| `SHR dst, count` | 0x38 | 0x38 | dst | count | 0x00 | Shift right logical |

### Comparison & Control Flow Instructions

| Mnemonic | Opcode | Byte 0 | Byte 1 | Byte 2 | Byte 3 | Description |
|----------|--------|--------|--------|--------|--------|-------------|
| `CMP op1, op2` | 0x40 | 0x40 | op1 | op2 | 0x00 | Compare registers |
| `CMP op1, imm` | 0x41 | 0x41 | op1 | imm_hi | imm_lo | Compare with immediate |
| `CMP op1, [addr]` | 0x42 | 0x42 | op1 | addr_hi | addr_lo | Compare with absolute address |
| `CMP op1, [base±off]` | 0x43 | 0x43 | op1 | base | offset | Compare register-relative |
| `JMP addr` | 0x50 | 0x50 | 0x00 | addr_hi | addr_lo | Unconditional jump |
| `JE addr` | 0x51 | 0x51 | 0x00 | addr_hi | addr_lo | Jump if equal (ZF=1) |
| `JNE addr` | 0x52 | 0x52 | 0x00 | addr_hi | addr_lo | Jump if not equal (ZF=0) |
| `JL addr` | 0x53 | 0x53 | 0x00 | addr_hi | addr_lo | Jump if less (SF≠OF) |
| `JG addr` | 0x54 | 0x54 | 0x00 | addr_hi | addr_lo | Jump if greater (ZF=0, SF=OF) |
| `JLE addr` | 0x55 | 0x55 | 0x00 | addr_hi | addr_lo | Jump if less or equal (ZF=1 OR SF≠OF) |
| `JGE addr` | 0x56 | 0x56 | 0x00 | addr_hi | addr_lo | Jump if greater or equal (SF=OF) |
| `LOOP addr` | 0x57 | 0x57 | 0x00 | addr_hi | addr_lo | Decrement CX, jump if CX != 0 |

### Stack & Function Instructions

| Mnemonic | Opcode | Byte 0 | Byte 1 | Byte 2 | Byte 3 | Description |
|----------|--------|--------|--------|--------|--------|-------------|
| `PUSH src` | 0x60 | 0x60 | src | - | - | Push register onto stack (2 bytes) |
| `POP dst` | 0x61 | 0x61 | dst | - | - | Pop from stack to register (2 bytes) |
| `CALL addr` | 0x70 | 0x70 | 0x00 | addr_hi | addr_lo | Call function |
| `RET` | 0x71 | 0x71 | 0x00 | - | - | Return from function (2 bytes) |

### System Instructions

| Mnemonic | Opcode | Byte 0 | Byte 1 | Description |
|----------|--------|--------|--------|-------------|
| `NOP` | 0x00 | 0x00 | 0x00 | No operation (2 bytes) |
| `HLT` | 0x01 | 0x01 | 0x00 | Halt execution (2 bytes) |
| `SYSCALL code` | 0x90 | 0x90 | code | System call (2 bytes) |

### Register Encoding

All register operands use the following encoding:

| Code | Register | Purpose |
|------|----------|---------|
| 0x00 | AX | Accumulator |
| 0x01 | BX | Base |
| 0x02 | CX | Counter |
| 0x03 | DX | Data |
| 0x04 | EX | Extended |
| 0x05 | FX | Free |
| 0x06 | SP | Stack Pointer |
| 0x07 | FP | Frame Pointer |

### Endianness Notes

- **Register codes**: Single byte (no endianness)
- **Immediate values**: Big-endian (high byte first)
- **Memory addresses**: Big-endian (high byte first)
- **Offsets**: Signed byte (-128 to +127)

### Size Notes

- **2-byte instructions**: NOP, HLT, RET, SYSCALL, INC, DEC, MUL, DIV, NOT, PUSH, POP
- **4-byte instructions**: All MOV variants, LEA, arithmetic with memory, logical ops, CMP, jumps, CALL

## Summary

X366 provides a clean, modern assembly language that:
- Teaches real assembly concepts
- Uses contemporary calling conventions
- Maintains x86 familiarity
- Stays simple enough for education
- Includes enough features for real programs

For complete examples and a working implementation, see the `examples/` directory and the X366 emulator TUI.
