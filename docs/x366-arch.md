# X366 Assembly Language Specification

X366 is a simplified 16-bit assembly language inspired by x86, designed for educational purposes.

## Architecture Overview

| Property           | Value                                                                                  |
|--------------------|----------------------------------------------------------------------------------------|
| Word Size          | 16-bit                                                                                 |
| Address Space      | 1KB default, configurable to 1K, 2K, 4K, 8K, or 16K                                    |
| Endianness         | Big-endian (x86 is [Little-endian](https://en.wikipedia.org/wiki/Endianness))          |
| Instruction Format | Fixed-size, 2 or 4 bytes (x86 is [variable length](https://en.wikipedia.org/wiki/X86)) |

## Register Set

### Core x366 Registers

x366 has 9 user-addressable registers and four system registers that cannot be set by the user

| Register | Name                 | Encoding | Purpose                                   |
|----------|----------------------|----------|-------------------------------------------|
| `AX`     | Accumulator          | `0x00`   | Arithmetic, first parameter, return value |
| `BX`     | Base register        | `0x01`   | Array indexing, second parameter          |
| `CX`     | Counter              | `0x02`   | Loop counter, third parameter             |
| `DX`     | Data register        | `0x03`   | General purpose, fourth parameter         |
| `SI`     | Source Index         | `0x04`   | General purpose, fifth parameter          |
| `DI`     | Destination Index    | `0x05`   | General purpose, sixth parameter          |
| `SP`     | Stack Pointer        | `0x06`   | Grows downward from end of memory         |
| `BP`     | Base Pointer         | `0x07`   | Base for stack frames                     |
| `HP`     | Heap Pointer         | `0x08`   | End of heap, start of free memory         |
| `IP`     | Instruction Pointer  | -        | Address of the current instruction        |
| `CB`     | Code Base            | -        | End of the code segment                   |
| `IR`     | Instruction Register | -        | First word of the current instruction     |
| `DR`     | Data Register        | -        | Second word of the current instruction    |

A register with no encoding is maintained internally and cannot be used as an operand. The rest are directly accessible in instructions (e.g., `MOV BX, HP`, `ADD HP, AX`).

### Byte Register Access

X366 supports accessing the low byte of general-purpose registers using byte register names:

| Byte register | Full register | Bits |
|---------------|---------------|------|
| `AL`          | `AX`          | 0-7  |
| `BL`          | `BX`          | 0-7  |
| `CL`          | `CX`          | 0-7  |
| `DL`          | `DX`          | 0-7  |
| `SIL`         | `SI`          | 0-7  |
| `DIL`         | `DI`          | 0-7  |

#### Notes
- Only the **low byte** can be accessed directly (AL, BL, CL, DL, SIL, DIL)
- Unlike x86, High byte registers (AH, BH, CH, DH, SIH, DIH) are **not supported** in X366
- Byte registers are primarily used with character or byte load/store instructions when working with individual characters

#### Examples

```asm
MOV AL, 65          ; Load byte value into AL (AX = 0x0041)
MOV [addr], BL      ; Store low byte of BX to memory
MOV CL, [addr]      ; Load byte from memory into CL (zero-extended)
```

### Flags Register

X366 supports an x86-like flags register that is set via the `CMP` (compare) instruction

| Flag | Name          | Set when                                                                                 |
|------|---------------|------------------------------------------------------------------------------------------|
| `ZF` | Zero Flag     | The result is exactly zero. Use it to test equality after `CMP`                          |
| `SF` | Sign Flag     | The result is negative, which means bit 15 is 1                                          |
| `CF` | Carry Flag    | The result does not fit in 16 bits: a carry out of an add, or a borrow out of a subtract |
| `OF` | Overflow Flag | Signed overflow: the true result is outside -32768 to 32767, so the sign is wrong        |

Arithmetic and logical instructions set the flags too. `CMP` is the common case
because it subtracts, sets the flags, and then throws the result away.

#### Examples

```asm
MOV AX, 7
CMP AX, 7            ; 7 - 7 = 0, so ZF = 1, SF = 0
JE  equal            ; taken, because ZF is set

CMP AX, 9            ; 7 - 9 = -2, so ZF = 0, SF = 1
JL  less             ; taken, because SF says the result is negative
```

## x366 Memory Layout

Programs in x366 are laid out in memory using the following locations, assuming 1KB of memory:

| Address Range     | Purpose                         |
|-------------------|---------------------------------|
| `0x0000 - 0x0000` | Null byte                       |
| `0x0001 - 0x0008` | Signature "Go Cats!" (8 bytes)  |
| `0x0008 - 0x001F` | Reserved/padding (24 bytes)     |
| `0x0020 - (HP-1)` | Code and data (grows upward)    |
| `HP - (SP-1)`     | Heap (dynamic allocation space) |
| `SP - 0x03FF`     | Stack (grows downward)          |
| `0x0400`          | Memory end (1KB)                |

Memory sizing can be configured to 2K, 4K, 8K, or 16K, in which case the stack moves to the end of memory, but everything
else remains the same.

## X366 Program Startup

When an X366 program begins execution, the emulator initializes the system to a known state:

### Initial Register State

| Register | Initial Value | Notes                                                                           |
|----------|---------------|---------------------------------------------------------------------------------|
| `AX`     | Input pointer | Points to a null-terminated command line input string                           |
| `BX`     | `0`           |                                                                                 |
| `CX`     | `0`           |                                                                                 |
| `DX`     | `0`           |                                                                                 |
| `SI`     | `0`           |                                                                                 |
| `DI`     | `0`           |                                                                                 |
| `SP`     | End of memory | `0x0400` (1KB), `0x0800` (2KB), `0x1000` (4KB), `0x2000` (8KB), `0x4000` (16KB) |
| `BP`     | `0`           |                                                                                 |
| `HP`     | End of code   | First byte after the program code and data segments                             |
| `IP`     | `0x0020`      | Start of the code segment: the first instruction                                |

### Command Line Input

The emulator automatically stores any command line argument to a program as a null-terminated string in memory and places a 
pointer to it in `AX`. 

You can think of the initial state of AX as being akin to argc in a C program.

```asm
main:
    ; if run with: x366 program.bin "30 10 20", AX points to "30 10 20\0" in memory
    MOV BX, AX          ; Save the string pointer
    SYSCALL ATOI        ; Parse first number
    ; ... process input
```

If no command line argument is provided, AX is set to `0`/null.

## Assembly Syntax

X366 assembly is designed to be beginner-friendly.

Commas are optional & operands can be separated by commas: `MOV AX, 10` or spaces: `MOV AX 10`.

It also supports many types of literals:

| Format           | Prefix        | Example          | Value                  |
|------------------|---------------|------------------|------------------------|
| Decimal          | none          | `MOV AX, 42`     | 42                     |
| Negative decimal | `-`           | `MOV AX, -1`     | -1, stored as `0xFFFF` |
| Hexadecimal      | `0x` or `0X`  | `MOV BX, 0xFF`   | 255                    |
| Binary           | `0b` or `0B`  | `MOV CX, 0b1010` | 10                     |
| Character        | single quotes | `MOV DL, 'A'`    | 65                     |
| Escape sequence  | single quotes | `MOV DL, '\n'`   | 10                     |

A character literal holds one character, or one escape sequence:

| Escape | Value | Meaning         |
|--------|-------|-----------------|
| `'\n'` | 10    | Newline         |
| `'\t'` | 9     | Tab             |
| `'\r'` | 13    | Carriage return |
| `'\0'` | 0     | Null            |
| `'\\'` | 92    | Backslash       |
| `'\''` | 39    | Single quote    |

Any other escape is an assembly error.

All numeric formats can be used in any context that accepts immediate values.

## Instruction Encoding

In contrast with x86, X366 uses fixed-length instructions: all instructions are either 2 bytes or 4 bytes.

### 2-Byte Instructions

| Byte | Content                    |
|------|----------------------------|
| 0    | Opcode                     |
| 1    | Register code or parameter |

Used for: `NOP`, `HLT`, `RET`, `SYSCALL`, single-register operations (`INC`, `DEC`, `PUSH`, `POP`, `MUL`, `DIV`, `NOT`, `NEG`)

### 4-Byte Instructions

| Byte | Content                                         |
|------|-------------------------------------------------|
| 0    | Opcode                                          |
| 1    | Destination register or mode                    |
| 2-3  | Immediate value, address, or offset, big-endian |

Not every 4-byte instruction spends bytes 2-3 on one 16-bit value. A register to
register form puts the source register in byte 2 and pads byte 3 with zero, and
a base plus offset form puts the base register in byte 2 and a signed byte
offset in byte 3.

Used for: `MOV`, arithmetic, logical, comparisons, jumps, calls, memory operations

### Register Encoding

| Code   | Register |
|--------|----------|
| `0x00` | `AX`     |
| `0x01` | `BX`     |
| `0x02` | `CX`     |
| `0x03` | `DX`     |
| `0x04` | `SI`     |
| `0x05` | `DI`     |
| `0x06` | `SP`     |
| `0x07` | `BP`     |
| `0x08` | `HP`     |

A byte register shares the code of the register that holds it, so `AL` is also
`0x00`.

## X366 Instruction Set

### Data Movement Instructions

| Instruction                   | Opcode | Encoding                        | Description                                 | Example           |
|-------------------------------|--------|---------------------------------|---------------------------------------------|-------------------|
| `MOV dst, src`                | 0x10   | `[0x10][dst][src][0x00]`        | Move data between registers                 | `MOV AX, BX`      |
| `MOV dst, imm`                | 0x11   | `[0x11][dst][imm_hi][imm_lo]`   | Load immediate value                        | `MOV AX, 42`      |
| `MOV dst, [addr]`             | 0x12   | `[0x12][dst][addr_hi][addr_lo]` | Load from memory (absolute)                 | `MOV AX, [0x100]` |
| `MOV [addr], src`             | 0x13   | `[0x13][src][addr_hi][addr_lo]` | Store to memory (absolute)                  | `MOV [0x100], AX` |
| `MOV dst, [base+offset]`      | 0x14   | `[0x14][dst][base][offset]`     | Load register-relative                      | `MOV AX, [BP+4]`  |
| `MOV [base+offset], src`      | 0x15   | `[0x15][src][base][offset]`     | Store register-relative                     | `MOV [BP-2], AX`  |
| `MOV dst_byte, [addr]`        | 0x16   | `[0x16][dst][addr_hi][addr_lo]` | Load byte from memory (zero-extend)         | `MOV AL, [0x100]` |
| `LEA dst, [base+offset]`      | 0x17   | `[0x17][dst][base][offset]`     | Load effective address (register-rel)       | `LEA AX, [BP-4]`  |
| `MOV [addr], src_byte`        | 0x18   | `[0x18][src][addr_hi][addr_lo]` | Store low byte to memory                    | `MOV [0x100], BL` |
| `MOV dst_byte, [base+offset]` | 0x19   | `[0x19][dst][base][offset]`     | Load byte register-relative (zero-extend)   | `MOV CL, [BP+4]`  |
| `MOV [base+offset], src_byte` | 0x1A   | `[0x1A][src][base][offset]`     | Store low byte register-relative            | `MOV [BP-2], DL`  |
| `MOV [base], imm`             | 0x1B   | `[0x1B][base][imm_hi][imm_lo]`  | Store 16-bit immediate to register-indirect | `MOV [CX], 1000`  |
| `MOV [addr], imm`             | 0x1C   | `[0x1C][addr_hi][addr_lo][imm]` | Store 8-bit immediate to memory (0-255)     | `MOV [count], 42` |
| `MOV dst, [base+index]`       | 0x2D   | `[0x2D][dst][base][index]`      | Load indexed (base + index register)        | `MOV AX, [BX+CX]` |
| `MOV [base+index], src`       | 0x2E   | `[0x2E][src][base][index]`      | Store indexed (base + index register)       | `MOV [BX+CX], AX` |
| `MOV [base+offset], imm`      | 0x2F   | `[0x2F][base][offset][imm]`     | Store 8-bit immediate register-relative     | `MOV [BP-2], 42`  |

### Arithmetic Instructions

| Instruction              | Opcode | Encoding                         | Description                                       | Example           |
|--------------------------|--------|----------------------------------|---------------------------------------------------|-------------------|
| `ADD dst, src`           | 0x20   | `[0x20][dst][src][0x00]`         | Add register to register                          | `ADD AX, BX`      |
| `ADD dst, imm`           | 0x21   | `[0x21][dst][imm_hi][imm_lo]`    | Add immediate value                               | `ADD AX, 10`      |
| `ADD dst, [addr]`        | 0x28   | `[0x28][dst][addr_hi][addr_lo]`  | Add from memory (absolute)                        | `ADD AX, [0x100]` |
| `ADD dst, [base+offset]` | 0x29   | `[0x29][dst][base][offset]`      | Add from memory (register-relative)               | `ADD AX, [BP+4]`  |
| `SUB dst, src`           | 0x22   | `[0x22][dst][src][0x00]`         | Subtract register from register                   | `SUB AX, BX`      |
| `SUB dst, imm`           | 0x23   | `[0x23][dst][imm_hi][imm_lo]`    | Subtract immediate value                          | `SUB AX, 10`      |
| `SUB dst, [addr]`        | 0x2A   | `[0x2A][dst][addr_hi][addr_lo]`  | Subtract from memory (absolute)                   | `SUB AX, [0x100]` |
| `SUB dst, [base+offset]` | 0x2B   | `[0x2B][dst][base][offset]`      | Subtract from memory (register-relative)          | `SUB AX, [BP-2]`  |
| `INC reg`                | 0x24   | `[0x24][reg]`                    | Increment register                                | `INC CX`          |
| `INC [addr]`             | 0x1D   | `[0x1D][0x00][addr_hi][addr_lo]` | Increment word in memory (x86-compatible)         | `INC [counter]`   |
| `INC [base+offset]`      | 0x1F   | `[0x1F][0x00][base][offset]`     | Increment word register-relative (x86-compatible) | `INC [BP-2]`      |
| `DEC reg`                | 0x25   | `[0x25][reg]`                    | Decrement register                                | `DEC DX`          |
| `DEC [addr]`             | 0x1E   | `[0x1E][0x00][addr_hi][addr_lo]` | Decrement word in memory (x86-compatible)         | `DEC [count]`     |
| `DEC [base+offset]`      | 0x2C   | `[0x2C][0x00][base][offset]`     | Decrement word register-relative (x86-compatible) | `DEC [SP+4]`      |
| `MUL src`                | 0x26   | `[0x26][src]`                    | Multiply (AX = AX * src)                          | `MUL BX`          |
| `DIV src`                | 0x27   | `[0x27][src]`                    | Divide (AX = AX / src, DX = remainder)            | `DIV CX`          |
| `NEG reg`                | 0x3B   | `[0x3B][reg]`                    | Two's complement negation (0 - reg)               | `NEG AX`          |

Note that `MUL` and `DIV` _always_ use `AX` as destination, in keeping with how x86 works. `DIV` places remainder in DX.

`NEG` computes the two's complement negation of a register, so it is
equivalent to `0 - reg`. It sets ZF, SF, CF and OF the same way `SUB` does.

### Logical & Bitwise Instructions

| Instruction        | Opcode | Encoding                      | Description                                | Example        |
|--------------------|--------|-------------------------------|--------------------------------------------|----------------|
| `AND dst, src`     | 0x30   | `[0x30][dst][src][0x00]`      | Bitwise AND                                | `AND AX, BX`   |
| `AND dst, imm`     | 0x31   | `[0x31][dst][imm_hi][imm_lo]` | Bitwise AND immediate                      | `AND AX, 0xFF` |
| `OR dst, src`      | 0x32   | `[0x32][dst][src][0x00]`      | Bitwise OR                                 | `OR BX, CX`    |
| `OR dst, imm`      | 0x33   | `[0x33][dst][imm_hi][imm_lo]` | Bitwise OR immediate                       | `OR AX, 0xFF`  |
| `XOR dst, src`     | 0x34   | `[0x34][dst][src][0x00]`      | Bitwise XOR                                | `XOR AX, AX`   |
| `XOR dst, imm`     | 0x35   | `[0x35][dst][imm_hi][imm_lo]` | Bitwise XOR immediate                      | `XOR AX, 0xFF` |
| `NOT reg`          | 0x36   | `[0x36][reg]`                 | Bitwise NOT                                | `NOT DX`       |
| `SHL dst[, count]` | 0x37   | `[0x37][dst][count][0x00]`    | Shift left (logical), count defaults to 1  | `SHL AX, 2`    |
| `SHR dst[, count]` | 0x38   | `[0x38][dst][count][0x00]`    | Shift right (logical), count defaults to 1 | `SHR BX, 4`    |

`NOT` is 2 bytes. Every other logical instruction is 4 bytes.

### Comparison, Jumps & Conditional Instructions

| Instruction               | Opcode | Encoding                         | Description                             | Example           |
|---------------------------|--------|----------------------------------|-----------------------------------------|-------------------|
| `CMP dst, src`            | 0x40   | `[0x40][op1][op2][0x00]`         | Compare registers, sets flags           | `CMP AX, BX`      |
| `CMP dst, imm`            | 0x41   | `[0x41][op1][imm_hi][imm_lo]`    | Compare with immediate                  | `CMP AX, 42`      |
| `CMP dst, [addr]`         | 0x42   | `[0x42][op1][addr_hi][addr_lo]`  | Compare with memory (absolute)          | `CMP AX, [0x100]` |
| `CMP dst, [base+offset]`  | 0x43   | `[0x43][op1][base][offset]`      | Compare with memory (register-relative) | `CMP AX, [BP+4]`  |
| `JMP addr`                | 0x50   | `[0x50][0x00][addr_hi][addr_lo]` | Unconditional jump                      | `JMP loop`        |
| `JE addr` / `JZ addr`     | 0x51   | `[0x51][0x00][addr_hi][addr_lo]` | Jump if equal or zero (ZF=1)            | `JE done`         |
| `JNE addr` / `JNZ addr`   | 0x52   | `[0x52][0x00][addr_hi][addr_lo]` | Jump if not equal or not zero (ZF=0)    | `JNE loop`        |
| `JL addr`                 | 0x53   | `[0x53][0x00][addr_hi][addr_lo]` | Jump if less (signed, SF!=OF)           | `JL negative`     |
| `JG addr`                 | 0x54   | `[0x54][0x00][addr_hi][addr_lo]` | Jump if greater (signed)                | `JG positive`     |
| `JLE addr`                | 0x55   | `[0x55][0x00][addr_hi][addr_lo]` | Jump if less or equal (signed)          | `JLE done`        |
| `JGE addr`                | 0x56   | `[0x56][0x00][addr_hi][addr_lo]` | Jump if greater or equal (signed)       | `JGE start`       |
| `LOOP addr`               | 0x57   | `[0x57][0x00][addr_hi][addr_lo]` | Decrement CX and jump if CX != 0        | `LOOP again`      |
| `SETE reg` / `SETZ reg`   | 0x44   | `[0x44][reg]`                    | Set to 1 if ZF=1, else 0                | `SETE AX`         |
| `SETNE reg` / `SETNZ reg` | 0x45   | `[0x45][reg]`                    | Set to 1 if ZF=0, else 0                | `SETNE AX`        |
| `SETL reg`                | 0x46   | `[0x46][reg]`                    | Set to 1 if SF!=OF, else 0              | `SETL AX`         |
| `SETG reg`                | 0x47   | `[0x47][reg]`                    | Set to 1 if ZF=0 and SF=OF, else 0      | `SETG AX`         |
| `SETLE reg`               | 0x48   | `[0x48][reg]`                    | Set to 1 if ZF=1 or SF!=OF, else 0      | `SETLE AX`        |
| `SETGE reg`               | 0x49   | `[0x49][reg]`                    | Set to 1 if SF=OF, else 0               | `SETGE AX`        |

Note that X366 uses absolute addresses for jumps and calls, where x86 primarily uses relative offsets

### Stack & Functions Instructions

| Instruction | Opcode | Encoding                         | Description                                         | Example     |
|-------------|--------|----------------------------------|-----------------------------------------------------|-------------|
| `PUSH src`  | 0x60   | `[0x60][src]`                    | Push a register onto the stack                      | `PUSH AX`   |
| `POP dst`   | 0x61   | `[0x61][dst]`                    | Pop from the stack into a register                  | `POP BP`    |
| `CALL addr` | 0x70   | `[0x70][0x00][addr_hi][addr_lo]` | Push the address of the next instruction, then jump | `CALL func` |
| `RET`       | 0x71   | `[0x71][0x00]`                   | Pop the return address into IP                      | `RET`       |

`SP` decrements by 2 before each `PUSH` and increments by 2 after each `POP`.

### System Instructions

| Instruction    | Opcode | Encoding       | Description    | Example        |
|----------------|--------|----------------|----------------|----------------|
| `NOP`          | 0x00   | `[0x00][0x00]` | No operation   | `NOP`          |
| `HLT` / `HALT` | 0x01   | `[0x01][0x00]` | Halt execution | `HLT`          |
| `SYSCALL name` | 0x90   | `[0x90][code]` | System call    | `SYSCALL EXIT` |

Note that unlike x86, the syscall code is part of the instruction, not a register, which makes it easier to call them.

### Syscalls

| Code | Name          | Arguments                         | Returns        | Description                                             |
|------|---------------|-----------------------------------|----------------|---------------------------------------------------------|
| 0    | EXIT          | -                                 | -              | Terminate program                                       |
| 1    | PRINT_CHAR    | AX=char                           | -              | Print character                                         |
| 2    | PRINT_STRING  | AX=addr                           | -              | Print null-terminated string                            |
| 3    | PRINT_INT     | AX=int                            | -              | Print signed integer                                    |
| 4    | READ_CHAR     | -                                 | AX=char        | Read character                                          |
| 5    | READ_INT      | -                                 | AX=int         | Read integer                                            |
| 6    | READ_STRING   | AX=buf, BX=max                    | AX=len         | Read string                                             |
| 7    | ATOI          | AX=str                            | AX=int, BX=ptr | Parse integer, skipping leading whitespace              |
| 8    | SBRK          | AX=increment                      | AX=old_HP      | Add AX to HP, which may be negative                     |
| 9    | SCREEN        | -                                 | -              | Show/initialize screen window                           |
| 10   | SET_COLOR     | AX=color                          | -              | Set draw color (0-15)                                   |
| 11   | DRAW_PIXEL    | AX=x, BX=y                        | -              | Draw pixel at coordinates                               |
| 12   | DRAW_LINE     | AX=x1, BX=y1, CX=x2, DX=y2        | -              | Draw line between points                                |
| 13   | DRAW_RECT     | AX=x, BX=y, CX=width, DX=height   | -              | Draw filled rectangle                                   |
| 14   | DRAW_CIRCLE   | AX=x, BX=y, CX=radius             | -              | Draw filled circle                                      |
| 15   | CLEAR_SCREEN  | -                                 | -              | Clear screen to current color                           |
| 16   | DRAW_TEXT     | AX=x, BX=y, CX=addr               | -              | Draw text at coordinates                                |
| 17   | PAINT_DISPLAY | -                                 | -              | Update screen display                                   |
| 18   | SLEEP         | AX=milliseconds                   | -              | Sleep for specified time                                |
| 19   | READ_FILE     | AX=filename, BX=buffer, CX=maxlen | AX=bytes_read  | Read file contents, AX = -1 on error                    |
| 20   | MALLOC        | AX=size                           | AX=ptr         | Allocate memory block, no-op in the JavaScript emulator |
| 21   | FREE          | AX=ptr                            | -              | Free memory block, no-op in the JavaScript emulator     |

## Data Directives

| Directive       | Description                                                                 | Example         |
|-----------------|-----------------------------------------------------------------------------|-----------------|
| `.MEMORY size`  | Declare the memory size. One of `1K`, `2K`, `4K`, `8K`, `16K`. Default `1K` | `.MEMORY 4K`    |
| `DB value, ...` | Define bytes. Takes numbers, strings and character literals                 | `DB "Hi\n", 0`  |
| `DW value, ...` | Define 16-bit words, high byte first                                        | `DW 0x1234`     |
| `n DUP(value)`  | Repeat a value n times. `?` writes zero                                     | `DB 100 DUP(0)` |

The assembler writes the memory size to bytes `0x0009-0x000A` of the binary
header, and the emulator allocates that much memory at load time.

A data directive emits at the current address, so place data where execution
does not reach it.

A string literal accepts the same escape sequences as a character literal,
and also `\"` for a quote.

## X366 Calling Conventions

X366 passes parameters in registers, like x86-64, ARM and RISC-V.

| Register | Role                                  |
|----------|---------------------------------------|
| `AX`     | First parameter, and the return value |
| `BX`     | Second parameter                      |
| `CX`     | Third parameter                       |
| `DX`     | Fourth parameter                      |
| `SI`     | Fifth parameter                       |
| `DI`     | Sixth parameter                       |

A function takes at most 6 parameters and returns its result in `AX`.

### Register Preservation

| Registers                          | Rule                                                |
|------------------------------------|-----------------------------------------------------|
| `AX`, `BX`, `CX`, `DX`, `SI`, `DI` | Caller-saved. A call can change them                |
| `SP`, `BP`                         | Callee-saved. The callee restores them before `RET` |

A caller that saves more than one register must `POP` them in the reverse order
of the `PUSH`.

### Stack Frame

A callee that uses `BP` pushes it and then sets `BP` to `SP`, which gives:

| Address  | Holds                            |
|----------|----------------------------------|
| `[BP+2]` | Return address, pushed by `CALL` |
| `[BP+0]` | Saved `BP`                       |
| `[BP-2]` | First local variable             |
| `[BP-4]` | Second local variable            |

Locals are allocated with `SUB SP, size` and released with `MOV SP, BP`.

## X366 Binary Format

| Offset          | Size | Content                                                      |
|-----------------|------|--------------------------------------------------------------|
| `0x0000-0x0007` | 8    | Signature, the ASCII text `Go Cats!`                         |
| `0x0008`        | 1    | Padding                                                      |
| `0x0009-0x000A` | 2    | Memory size in bytes                                         |
| `0x000B`        | 1    | Padding                                                      |
| `0x000C-0x000F` | 4    | Offset of the optional sections, 0 if there are none         |
| `0x0010-0x0011` | 2    | `HP`, end of the data segment, rounded up to an even address |
| `0x0012-0x0013` | 2    | `CB`, end of the code segment                                |
| `0x0014-0x0015` | 2    | `RO`, end of the read-only data, 0 if there is none          |
| `0x0016-0x001F` | 10   | Reserved                                                     |
| `0x0020`        | ...  | Code segment, then the data segment                          |

Every multi-byte field is big-endian. A loader must reject a file whose
signature does not match. A boundary field of 0 means the loader picks a
default: `CB` becomes 0, `RO` becomes `CB`, and `HP` becomes the end of the
loaded image.

## Debug Section

The debug section follows the code and data. It is optional. A loader does not
copy it into memory.

| Offset  | Size     | Content                                          |
|---------|----------|--------------------------------------------------|
| `+0x00` | 1        | Section type, `0x01`                             |
| `+0x01` | 4        | Section size, excluding the type and size fields |
| `+0x05` | variable | Source filename, null-terminated                 |
| ...     | variable | Line number map, then the symbol table           |

The type and size fields are a generic container. A reader skips a type it does
not know using the size field. Type `0x01` is the only type in use. Type `0x00`
marks the end of the sections.

The line number map is a run of 4-byte entries that ends with `FFFF 0000`:

| Field | Size | Content                           |
|-------|------|-----------------------------------|
| IP    | 2    | Instruction address               |
| Line  | 2    | Source line number, starting at 1 |

The symbol table is a run of variable-length entries that ends with
`FFFF 00 00`:

| Field | Size     | Content                    |
|-------|----------|----------------------------|
| Addr  | 2        | Symbol address             |
| Type  | 1        | `0x00` for a label         |
| Name  | variable | Null-terminated ASCII name |

## Comparison with x86

| Feature                                                                       | X366                                             | [x86-16](https://en.wikipedia.org/wiki/Intel_8086)   | [IA-32](https://en.wikipedia.org/wiki/IA-32)   | [x86-64](https://en.wikipedia.org/wiki/X86-64)   |
|-------------------------------------------------------------------------------|--------------------------------------------------|------------------------------------------------------|------------------------------------------------|--------------------------------------------------|
| [Word size](https://en.wikipedia.org/wiki/Word_(computer_architecture))       | 16-bit                                           | 16-bit                                               | 32-bit                                         | 64-bit                                           |
| Address space                                                                 | 1KB to 16KB                                      | 1MB                                                  | 4GB                                            | 256TB (48-bit addresses)                         |
| Instruction length                                                            | 2 or 4 bytes                                     | 1 to 6 bytes                                         | 1 to 15 bytes                                  | 1 to 15 bytes                                    |
| Registers                                                                     | 9 addressable, 4 internal                        | 8 general, 4 segment                                 | 8 general                                      | 16 general                                       |
| [Calling convention](https://en.wikipedia.org/wiki/X86_calling_conventions)   | Registers, 6 parameters                          | Stack                                                | Stack                                          | Registers, 6 in System V, 4 in Microsoft x64     |
| [Addressing modes](https://en.wikipedia.org/wiki/Addressing_mode)             | Absolute, register-relative, indexed, indirect   | Segment plus offset                                  | Base, index, scale, displacement               | Adds RIP-relative                                |
| [Syscalls](https://en.wikipedia.org/wiki/System_call)                         | `SYSCALL` with a code operand                    | `INT`                                                | `INT` or `SYSENTER`                            | `SYSCALL`                                        |
| Jumps                                                                         | Absolute                                         | Relative or absolute                                 | Relative or absolute                           | Relative or absolute                             |
| [Segmentation](https://en.wikipedia.org/wiki/X86_memory_segmentation)         | None                                             | Required                                             | Present, flat model normal                     | Mostly removed                                   |
| [Floating point](https://en.wikipedia.org/wiki/X87)                           | None                                             | Optional 8087                                        | x87 and SSE                                    | x87 and SSE                                      |
| [Flags](https://en.wikipedia.org/wiki/FLAGS_register)                         | 4: `ZF`, `SF`, `CF`, `OF`                        | FLAGS                                                | EFLAGS                                         | RFLAGS                                           |
| [Privilege levels](https://en.wikipedia.org/wiki/Protection_ring)             | None                                             | None                                                 | 4 rings                                        | 4 rings                                          |
| Shifts                                                                        | Logical only                                     | Logical, arithmetic, rotate                          | Logical, arithmetic, rotate                    | Logical, arithmetic, rotate                      |

X366 also has no string instructions, no I/O instructions, no interrupts, and
no paging.
