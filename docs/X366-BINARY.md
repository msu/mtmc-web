# X366 Binary Format Specification

## Overview

X366 uses the ORC (Object Resource Container) binary format - a simple, structured binary format with a fixed header.

## Binary File Structure

| Offset            | Size     | Content                                      |
|-------------------|----------|----------------------------------------------|
| 0x0000            | 8        | Signature: "Go Cats!" (8 bytes ASCII)        |
| 0x0008            | 1        | Padding (0x00)                               |
| 0x0009            | 2        | Memory size (big-endian, 16-bit)             |
| 0x000B            | 1        | Padding (0x00)                               |
| 0x000C            | 4        | Sections offset (big-endian, 32-bit)         |
| 0x0010            | 16       | Reserved/padding (0x00)                      |
| 0x0020            | variable | Code and data                                |
| [Sections offset] | variable | Optional sections (debug info, images, etc.) |

### Header Details

#### Signature (0x0000-0x0007)
- **Content**: ASCII string "Go Cats!" (8 bytes)
- **Purpose**: Identifies valid X366 binaries
- **Bytes**: `0x47 0x6F 0x20 0x43 0x61 0x74 0x73 0x21`
- **Validation**: Loader must verify this signature

#### Memory Size (0x0009-0x000A)
- **Format**: 16-bit big-endian unsigned integer
- **Purpose**: Specifies runtime memory allocation
- **Valid values**:
  - `0x0400` (1024 bytes - 1KB)
  - `0x0800` (2048 bytes - 2KB)
  - `0x1000` (4096 bytes - 4KB)
  - `0x2000` (8192 bytes - 8KB)
  - `0x4000` (16384 bytes - 16KB)
- **Default**: `0x0400` (1KB)

#### Sections Offset (0x000C-0x000F)
- **Format**: 32-bit big-endian unsigned integer
- **Purpose**: File offset where optional sections begin
- **Values**:
  - `0x00000000` - No sections present
  - Otherwise: Absolute byte offset in binary file
- **Use**: Points to debug info, embedded images, source code, etc.

#### Reserved Area (0x0010-0x001F)
- **Size**: 16 bytes
- **Current use**: Padding (all zeros)
- **Future use**: Available for binary format extensions

### Code Section (0x0020+)

- **Start address**: Always 0x0020
- **Content**: Assembled instructions and data
- **Size**: Variable (up to `memory_size - 32` bytes)

## Runtime Memory Layout

**IMPORTANT**: The binary file header (0x0000-0x001F) is **NOT** loaded into runtime memory.

When loading a binary:
1. **Read header** from binary file (0x0000-0x001F)
2. **Allocate runtime memory** of size specified in header
3. **Zero out** runtime memory addresses 0x0000-0x001F (reserved area)
4. **Load code/data** from binary file offset 0x0020 into runtime memory at 0x0020

### Runtime Memory Structure

| Runtime Memory Address | Content                              |
|------------------------|--------------------------------------|
| 0x0000-0x001F          | Reserved (all zeros, not accessible) |
| 0x0020-[memory_size]   | Code and data from binary            |

**Why separate file format from runtime memory?**

- **File format**: Contains metadata (signature, memory size, sections offset)
- **Runtime memory**: Clean slate for program execution
- **Reserved area**: Available for future runtime features (stack canaries, memory tags, etc.)
- **Security**: Prevents programs from reading/modifying loader metadata

### Reserved Memory (0x0000-0x001F)

The first 32 bytes of runtime memory are **reserved** and **zeroed**:

- Programs **cannot** read or write to this area
- Attempts to access reserved memory should trap/fault
- Future use: Memory protection, stack guards, runtime metadata
- **Separation of concerns**: File metadata != Runtime data

## Endianness

X366 uses **big-endian** byte ordering:

- **Multi-byte values**: High byte first
- **Examples**:
  - Address 0x1234 -> bytes `0x12 0x34`
  - Immediate value 0xABCD -> bytes `0xAB 0xCD`

## Register Encoding

Instructions that reference registers use a 3-bit code (values 0-7):

| Code | Register | Type            |
|------|----------|-----------------|
| 0x00 | AX       | General purpose |
| 0x01 | BX       | General purpose |
| 0x02 | CX       | General purpose |
| 0x03 | DX       | General purpose |
| 0x04 | EX       | General purpose |
| 0x05 | FX       | General purpose |
| 0x06 | SP       | Stack pointer   |
| 0x07 | FP       | Frame pointer   |

**Internal-only registers (not encoded in instructions):**
- PC - Program Counter (modified by jumps, calls, returns)
- BK - Break Pointer (modified by SBRK syscall)
- CB - Code Base (for memory classification)
- IR - Instruction Register (CPU internal)
- DR - Data Register (CPU internal)

## Optional Sections

Sections are stored after the code/data and contain supplementary information not loaded into runtime memory.

### Section Format

Each section uses a Type-Length-Value (TLV) format:

| Offset | Size     | Content                                                     |
|--------|----------|-------------------------------------------------------------|
| +0x00  | 1        | Section Type (0x00 = end of sections)                       |
| +0x01  | 4        | Section Size (big-endian, 32-bit, excludes type/size bytes) |
| +0x05  | variable | Section Data (size bytes)                                   |

### Section Types

| Type  | Name             | Description                  |
|-------|------------------|------------------------------|
| 0x00  | End of sections  | Marks end of sections area   |
| 0x01  | Debug Info       | Line map + symbol table      |
| 0x02  | C Debug Info     | DWARF-like debug information |
| 0x03  | Source Code      | Original source file (text)  |
| 0x04  | Image Data       | Embedded images (PNG, etc.)  |
| 0x05  | Metadata         | Compiler version, build info |
| 0x06  | String Table     | Shared string pool           |
| 0x07  | Type Information | Type definitions for C       |
| 0x80+ | User-defined     | Custom application sections  |

### Section Characteristics

- **Binary-safe**: Sections can contain any binary data (including null bytes)
- **Skippable**: Unknown section types can be skipped using size field
- **Order-independent**: Sections can appear in any order
- **Multiple instances**: Same type can appear multiple times
- **32-bit size**: Supports sections up to 4GB (enables large images)

### Example: Binary with Sections

Binary File Layout:

| Offset | Bytes                      | Description                      |
|--------|----------------------------|----------------------------------|
| 0x0000 | 47 6F 20 43 61 74 73 21    | Signature: "Go Cats!"            |
| 0x0008 | 00                         | Padding                          |
| 0x0009 | 04 00                      | Memory size: 1KB (0x0400)        |
| 0x000B | 00                         | Padding                          |
| 0x000C | 00 00 00 50                | Sections offset: 0x0050          |
| 0x0010 | 00 00 00 00 00 00 00 00    | Reserved (16 bytes)              |
| 0x0018 | 00 00 00 00 00 00 00 00    | (continued)                      |
| 0x0020 | 11 00 00 48                | MOV AX, 'H' (0x48)               |
| 0x0024 | 90 01                      | SYSCALL PRINT_CHAR               |
| 0x0026 | 11 00 00 69                | MOV AX, 'i' (0x69)               |
| 0x002A | 90 01                      | SYSCALL PRINT_CHAR               |
| 0x002C | 01                         | HALT                             |
| ...    |                            |                                  |
| 0x0050 | 01                         | Section type: Debug Info (0x01)  |
| 0x0051 | 00 00 00 20                | Section size: 32 bytes           |
| 0x0055 | [32 bytes of debug data]   |                                  |
| 0x0075 | 03                         | Section type: Source Code (0x03) |
| 0x0076 | 00 00 00 64                | Section size: 100 bytes          |
| 0x007A | [100 bytes of source code] |                                  |
| 0x00DE | 00                         | Section type: End (0x00)         |
| 0x00DF | 00 00 00 00                | Size: 0                          |

## Emulator Requirements

When loading a binary, the emulator must:

1. **Read and verify header**:
   - Verify signature at 0x0000-0x0007 matches "Go Cats!"
   - Read memory size from 0x0009-0x000A (big-endian)
   - Read sections offset from 0x000C-0x000F (big-endian)

2. **Allocate runtime memory**:
   - Allocate array of size specified in header
   - **Zero out addresses 0x0000-0x001F** (reserved area)

3. **Load code/data**:
   - Copy bytes from binary offset 0x0020 to runtime memory address 0x0020
   - Stop at end of binary or when sections offset is reached

4. **Load sections** (optional):
   - If sections offset is non-zero, parse sections
   - Store sections separately (NOT in runtime memory)
   - Make sections available via emulator APIs

5. **Initialize registers**:
   - PC = 0x0020 (first instruction)
   - SP = memory_size (stack at end)
   - BK = 0x0020 (break pointer starts after reserved area)
   - All other registers = 0

**Critical**: The header (0x0000-0x001F in binary file) is **never** copied into runtime memory.

## Assembler Requirements

When generating a binary, the assembler must:

1. **Write header** (0x0000-0x001F):
   - Signature "Go Cats!" at 0x0000-0x0007
   - Padding byte (0x00) at 0x0008
   - Memory size (big-endian) at 0x0009-0x000A
   - Padding byte (0x00) at 0x000B
   - Sections offset (big-endian, 32-bit) at 0x000C-0x000F
   - Reserved area (zeros) at 0x0010-0x001F

2. **Encode instructions**: Starting at 0x0020

3. **Write sections** (optional):
   - If generating debug info, source code, etc.
   - Write sections after code/data
   - Update sections offset in header

4. **Use big-endian**: For all multi-byte values in header and sections

## Section 0x01: Debug Information

Debug information is stored as **Section Type 0x01** and contains line number mappings and symbol tables for source-level debugging.

### Debug Section Structure

The debug section contains three subsections in order:

1. **Source Filename**: Null-terminated filename of the source .asm file
2. **Line Number Map**: PC address -> source line number
3. **Symbol Table**: Label names -> addresses

### 0. Source Filename

The first part of the debug section is the source filename:

```
Format: Null-terminated ASCII string
```

**Properties:**
- Contains only the filename (not full path), e.g., "hello.asm"
- Maximum length: 255 characters
- Used to verify the correct source file is open in the editor

**Example:**
```
'h' 'e' 'l' 'l' 'o' '.' 'a' 's' 'm' 0x00
```

### 1. Line Number Map

Maps program counter addresses to source line numbers. Uses a compact format:

```
Entry format (4 bytes each):
  Bytes 0-1: PC address (big-endian)
  Bytes 2-3: Line number (big-endian)
```

**Properties:**
- Entries are sorted by PC address
- Only includes PC addresses that start instructions
- Line numbers start from 1
- Terminated by entry with PC = 0xFFFF

**Example:**
```
0x00 0x20 0x00 0x05    ; PC 0x0020 -> line 5
0x00 0x24 0x00 0x06    ; PC 0x0024 -> line 6
0x00 0x28 0x00 0x0A    ; PC 0x0028 -> line 10
0xFF 0xFF 0x00 0x00    ; End marker
```

### 3. Symbol Table

Maps label names to addresses. Uses null-terminated strings:

```
Entry format (variable length):
  Bytes 0-1: Address (big-endian)
  Byte  2:   Symbol type (0x00 = label, 0x01 = data)
  Bytes 3+:  Null-terminated symbol name (ASCII)
```

**Properties:**
- Entries are not necessarily sorted
- Symbol names are case-sensitive
- Maximum symbol name length: 255 characters
- Terminated by entry with address = 0xFFFF

**Example:**
```
0x00 0x20 0x00 'm' 'a' 'i' 'n' 0x00           ; main at 0x0020
0x00 0x30 0x00 'l' 'o' 'o' 'p' 0x00           ; loop at 0x0030
0x00 0x50 0x01 'm' 's' 'g' 0x00               ; msg (data) at 0x0050
0xFF 0xFF 0x00 0x00                           ; End marker
```

### Debug Section Example

Complete example for a small program with debug info:

```
Source code (example.asm):
  Line 5:  MOV AX, 10
  Line 6:  CALL loop
  Line 10: HALT

Binary file:
------------------------------------------------------------
Header (0x0000-0x001F):
  0x0000  47 6F 20 43 61 74 73 21             "Go Cats!"
  0x0008  00                                  Padding
  0x0009  04 00                               Memory: 1KB
  0x000B  00                                  Padding
  0x000C  00 00 00 30                         Sections at 0x0030
  0x0010  [16 bytes of zeros]                 Reserved

Code (0x0020-0x002F):
  0x0020  11 00 00 0A                         MOV AX, 10
  0x0024  70 00 00 30                         CALL 0x0030
  0x0028  01 00                               HALT
  0x002A  [padding to 0x0030]

Sections (0x0030+):
  0x0030  01                                  Section type: Debug Info
  0x0031  00 00 00 38                         Section size: 56 bytes

  ; Source filename (12 bytes)
  0x0035  65 78 61 6D 70 6C 65 2E             "example."
  0x003D  61 73 6D 00                         "asm\0"

  ; Line map (12 bytes)
  0x0041  00 20 00 05                         PC 0x0020 -> line 5
  0x0045  00 24 00 06                         PC 0x0024 -> line 6
  0x0049  00 28 00 0A                         PC 0x0028 -> line 10
  0x004D  FF FF 00 00                         End marker

  ; Symbol table (28 bytes)
  0x0051  00 20 00 6D 61 69 6E 00             main @ 0x0020
  0x0059  00 30 00 6C 6F 6F 70 00             loop @ 0x0030
  0x0061  FF FF 00 00                         End marker

  0x0065  00                                  Section type: End
  0x0066  00 00 00 00                         Size: 0
```