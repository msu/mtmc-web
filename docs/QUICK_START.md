# MTMC-16 Quick Start Guide

Welcome to the MTMC-16 (MonTana Mini-Computer), a 16-bit educational computer system that lets you learn how computers work at the lowest level.

## What is a Computer?

At its core, a computer has three fundamental components:

* **Registers** - Ultra-fast storage locations inside the CPU that hold data currently being worked on
* **Memory** - Larger storage where programs and data live
* **Instructions** - Simple commands that tell the CPU what to do (move data, add numbers, jump to different code)

The MTMC-16 has 8 registers (AX, BX, CX, DX, EX, FX, SP, FP) and 1KB of memory (expandable to 16KB). Each register holds a 16-bit number (0-65535).

## How Programs Run

Programs are sequences of instructions stored in memory. The CPU:

1. **Fetches** an instruction from memory at the Program Counter (PC) address
2. **Decodes** what the instruction means
3. **Executes** the operation (add numbers, move data, etc.)
4. **Repeats** with the next instruction

The PC register automatically advances to point at the next instruction, unless a jump or call changes it.

## Getting Started with the Emulator

The emulator provides a complete visual environment for running x366 assembly programs.

### Opening a Program

1. Look at the **File System** panel on the right
2. Navigate to `disk/examples/`
3. Click on `hello.asm` to open it

You'll see the assembly code in the editor:

```asm
message: DB "Hello, World!", '\n', '\0'

MOV AX, message
SYSCALL PRINT_STRING
HALT
```

This program:
* Defines a text message in memory
* Loads the message address into register AX
* Calls the PRINT_STRING system call to display it
* Halts execution

### Loading and Running

1. Click the **load** button (or press Ctrl+Enter) to assemble and load the program
   * The binary code is loaded into memory starting at address 0x0020
   * Registers are initialized (PC points to first instruction)
   * The memory panel shows the loaded program

2. Click **step** to execute one instruction at a time
   * Watch the PC register advance
   * See registers change as instructions execute
   * Observe output appear in the terminal

3. Or click **run** to execute at full speed
   * The program runs until it hits HALT or you click **quit**

### Understanding the Display

* **Left Panel**:
  * Controls for run/step/reset
  * Registers showing current values in binary, hex, and decimal
  * Memory view showing program code and data

* **Center Panel**:
  * Graphics display (for programs using drawing syscalls)
  * Terminal showing program output

* **Right Panel**:
  * File system browser
  * Code editor for assembly programs

### Stepping Through hello.asm

Load `hello.asm` and step through it:

1. **First step**: `MOV AX, message`
   * AX register changes to show the memory address of the message
   * PC advances to next instruction

2. **Second step**: `SYSCALL PRINT_STRING`
   * System call reads the string from memory at address in AX
   * Text appears in the terminal
   * PC advances

3. **Third step**: `HALT`
   * Program execution stops

### Exploring fibonacci.asm

Now try `fibonacci.asm` which prints the first 10 Fibonacci numbers:

```asm
MOV EX, 0      ; fib(n-1)
MOV FX, 1      ; fib(n)
MOV CX, 0      ; counter

fib_loop:
MOV AX, EX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

MOV AX, EX
ADD AX, FX     ; AX = fib(n-1) + fib(n)
MOV EX, FX     ; fib(n-1) = old fib(n)
MOV FX, AX     ; fib(n) = new value

INC CX
CMP CX, 10
JL fib_loop

HALT
```

This demonstrates:
* **Loops** - `fib_loop` label and `JL fib_loop` (jump if less than)
* **Arithmetic** - `ADD` instruction to sum numbers
* **Comparison** - `CMP` sets flags, `JL` checks them
* **Multiple registers** - EX, FX for Fibonacci state, CX for counting

Step through and watch:
* EX and FX values change as Fibonacci numbers are calculated
* CX counter increment each iteration
* Loop jumps back to `fib_loop` until CX reaches 10

## Key Controls

* **load** (Ctrl+Enter) - Assemble and load current file
* **run** (Ctrl+R) - Execute at selected speed
* **step** - Execute one instruction
* **back** - Step backward (undo last instruction)
* **quit** - Stop running program
* **reset** - Clear memory and registers

## What's Next?

Try these programs to learn more:

* `loop.asm` - Simple counting loop
* `factorial.asm` - Calls a function to compute 5!
* `echo.asm` - Reads command line input
* `count_down_recursive.asm` - Recursive function calls

For comprehensive programming information, see the **X366 Programmer's Guide**.

For complete instruction reference, see **X366-ARCHITECTURE.md**.
