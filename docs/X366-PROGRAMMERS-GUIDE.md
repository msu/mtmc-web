# X366 Programmer's Guide

A practical guide to assembly programming for the MTMC-16 computer system.

## Introduction

This guide teaches x366 assembly through working examples that run in the MTMC-16 emulator. We'll build from simple programs to more complex ones, introducing concepts progressively.

For complete instruction reference, see [X366-ARCHITECTURE.md](X366-ARCHITECTURE.md).

## Your First Program

Let's start with the simplest possible program:

```asm
HALT
```

This single instruction stops the CPU. Not very useful, but it demonstrates that programs are just sequences of instructions.

## Printing Output

Programs need to communicate. The SYSCALL instruction invokes operating system functions:

```asm
MOV AX, 65
SYSCALL PRINT_CHAR
HALT
```

This prints the letter 'A' (ASCII code 65). The PRINT_CHAR syscall reads the character from register AX.

Better yet, use a character literal:

```asm
MOV AX, 'A'
SYSCALL PRINT_CHAR
HALT
```

### Hello World

Real programs use strings stored in memory:

```asm
message: DB "Hello, World!", '\n', '\0'

MOV AX, message
SYSCALL PRINT_STRING
HALT
```

Key points:
* `DB` defines bytes in memory (our text string)
* The assembler automatically moves data declarations to the end
* `'\n'` is a newline, `'\0'` terminates the string
* `MOV AX, message` loads the address of the message
* PRINT_STRING reads characters from memory until it hits `'\0'`

## Working with Numbers

### Printing Integers

```asm
MOV AX, 42
SYSCALL PRINT_INT
HALT
```

PRINT_INT converts the number in AX to decimal digits and prints them.

### Basic Arithmetic

```asm
MOV AX, 10
MOV BX, 32
ADD AX, BX
SYSCALL PRINT_INT
HALT
```

This adds 10 + 32 and prints 42. The result goes in the first operand (AX).

Other arithmetic operations:

```asm
SUB AX, BX     ; AX = AX - BX
MUL BX         ; AX = AX * BX
DIV BX         ; AX = AX / BX, DX = remainder
INC AX         ; AX = AX + 1
DEC CX         ; CX = CX - 1
```

### Example: Computing an Average

```asm
a: DW 15
b: DW 25

MOV AX, [a]
ADD AX, [b]
MOV BX, 2
DIV BX
SYSCALL PRINT_INT
HALT
```

This loads two numbers from memory, adds them, divides by 2, and prints the result (20).

## Loops

Loops let programs repeat operations.

### Counting Up

```asm
MOV CX, 0

loop_start:
    MOV AX, CX
    SYSCALL PRINT_INT
    MOV AX, '\n'
    SYSCALL PRINT_CHAR

    INC CX
    CMP CX, 10
    JL loop_start

HALT
```

This prints 0 through 9. The comparison `CMP CX, 10` sets flags, then `JL` (jump if less) loops back.

### Using LOOP Instruction

The LOOP instruction provides a cleaner pattern:

```asm
MOV CX, 10

print_loop:
    MOV AX, CX
    SYSCALL PRINT_INT
    MOV AX, '\n'
    SYSCALL PRINT_CHAR
    LOOP print_loop

HALT
```

LOOP automatically decrements CX and jumps if CX != 0. This prints 10 down to 1.

### Fibonacci Sequence

Generates the first 10 Fibonacci numbers:

```asm
MOV EX, 0      ; previous
MOV FX, 1      ; current
MOV CX, 0      ; counter

fib_loop:
    MOV AX, EX
    SYSCALL PRINT_INT
    MOV AX, '\n'
    SYSCALL PRINT_CHAR

    MOV AX, EX
    ADD AX, FX
    MOV EX, FX
    MOV FX, AX

    INC CX
    CMP CX, 10
    JL fib_loop

HALT
```

This demonstrates using multiple registers to maintain state across loop iterations.

## Functions

Functions encapsulate reusable code.

### Simple Function

```asm
add:
    ADD AX, BX
    RET

MOV AX, 10
MOV BX, 20
CALL add
SYSCALL PRINT_INT
HALT
```

The function:
* Receives parameters in registers (AX, BX)
* Performs the addition
* Returns result in AX
* RET returns to the caller

CALL pushes the return address on the stack and jumps to the function. RET pops the address and jumps back.

### Factorial

```asm
; factorial(n) in AX, returns n! in AX
factorial:
    MOV EX, AX
    MOV AX, 1

fact_loop:
    CMP EX, 1
    JLE fact_done
    MUL EX
    DEC EX
    JMP fact_loop

fact_done:
    RET

MOV AX, 5
CALL factorial
SYSCALL PRINT_INT
HALT
```

This computes 5! = 120 iteratively.

### Recursive Factorial

```asm
factorial:
    CMP AX, 1
    JG recursive
    MOV AX, 1
    RET

recursive:
    PUSH FP
    MOV FP, SP
    PUSH AX

    DEC AX
    CALL factorial

    POP BX
    MUL BX

    POP FP
    RET

MOV AX, 5
CALL factorial
SYSCALL PRINT_INT
HALT
```

Recursive version uses the stack to save state across calls.

## Arrays

Arrays store multiple values in contiguous memory.

### Defining Arrays

```asm
numbers: DW 10, 20, 30, 40, 50
buffer: DB 100 DUP(0)
```

`DW` defines 16-bit words, `DB` defines bytes. `DUP` creates repeated values.

### Accessing Array Elements

```asm
array: DW 10, 20, 30, 40, 50

MOV BX, array
MOV AX, [BX]        ; Load array[0] = 10
SYSCALL PRINT_INT
MOV AX, '\n'
SYSCALL PRINT_CHAR

ADD BX, 2           ; Move to next word (2 bytes)
MOV AX, [BX]        ; Load array[1] = 20
SYSCALL PRINT_INT

HALT
```

### Indexed Access

Using register+register addressing for runtime indices:

```asm
array: DW 10, 20, 30, 40, 50

MOV BX, array       ; Base address
MOV CX, 4           ; Index: element 2 * 2 bytes = 4
MOV AX, [BX+CX]     ; Load array[2] = 30
SYSCALL PRINT_INT
HALT
```

### Summing an Array

```asm
array: DW 10, 20, 30, 40, 50
length: DW 5

MOV BX, array
MOV CX, [length]
MOV DX, 0           ; sum

sum_loop:
    CMP CX, 0
    JE done

    MOV AX, [BX]
    ADD DX, AX
    ADD BX, 2
    DEC CX
    JMP sum_loop

done:
    MOV AX, DX
    SYSCALL PRINT_INT
    HALT
```

This sums all elements and prints 150.

## String Processing

Strings are byte arrays ending with `'\0'`.

### String Length

```asm
; strlen(str) - string pointer in AX, returns length in AX
strlen:
    PUSH BX
    MOV BX, AX
    MOV AX, 0

count_loop:
    MOV CL, [BX]
    CMP CL, '\0'
    JE done
    INC AX
    INC BX
    JMP count_loop

done:
    POP BX
    RET

test_str: DB "Hello!", '\0'

MOV AX, test_str
CALL strlen
SYSCALL PRINT_INT
HALT
```

Returns 6 (the length of "Hello!").

### Character Counting

```asm
message: DB "The quick brown fox", '\0'
space_count: DW 0

MOV BX, message

scan_loop:
    MOV AL, [BX]
    CMP AL, '\0'
    JE done

    CMP AL, ' '
    JNE next
    INC [space_count]

next:
    INC BX
    JMP scan_loop

done:
    MOV AX, [space_count]
    SYSCALL PRINT_INT
    HALT
```

Counts spaces in the string (prints 3).

## Stack Frames and Local Variables

Complex functions need local variables stored on the stack.

### Stack Frame Setup

```asm
my_function:
    PUSH FP             ; Save caller's frame pointer
    MOV FP, SP          ; Set up our frame pointer
    SUB SP, 4           ; Allocate 2 local variables (words)

    ; Use locals:
    ; [FP-2] is local variable 1
    ; [FP-4] is local variable 2

    MOV [FP-2], AX      ; Store in local
    MOV AX, [FP-2]      ; Load from local

    MOV SP, FP          ; Deallocate locals
    POP FP              ; Restore frame pointer
    RET
```

### Example: Computing with Locals

```asm
; compute(a, b) - returns (a*2 + b*3)
; Parameters: AX=a, BX=b
compute:
    PUSH FP
    MOV FP, SP
    SUB SP, 4           ; 2 locals

    ; temp1 = a * 2
    MOV CX, AX
    ADD CX, AX
    MOV [FP-2], CX

    ; temp2 = b * 3
    MOV CX, BX
    ADD CX, BX
    ADD CX, BX
    MOV [FP-4], CX

    ; result = temp1 + temp2
    MOV AX, [FP-2]
    ADD AX, [FP-4]

    MOV SP, FP
    POP FP
    RET

MOV AX, 5
MOV BX, 7
CALL compute
SYSCALL PRINT_INT
HALT
```

Returns 31 (5*2 + 7*3 = 10 + 21).

## Command Line Input

Programs can receive input via the AX register at startup.

### Echo Program

```asm
; AX points to command line string on startup
SYSCALL PRINT_STRING
HALT
```

Run with: `x366 echo.bin "Hello from command line!"`

### Parsing Numbers

```asm
; AX points to input string
SYSCALL ATOI        ; Convert to integer
SYSCALL PRINT_INT
HALT
```

Run with: `x366 parse.bin "42"`

### Multiple Numbers

```asm
MOV BX, AX          ; Save input pointer

; Parse first number
MOV AX, BX
SYSCALL ATOI
PUSH AX

; Parse second number (BX updated by ATOI)
MOV AX, BX
SYSCALL ATOI

; Add them
POP BX
ADD AX, BX

SYSCALL PRINT_INT
HALT
```

Run with: `x366 add.bin "10 20"` - prints 30.

## Recursive Fibonacci

A more complex recursive example:

```asm
; fib(n) - compute nth Fibonacci number
; Parameter: AX = n
; Returns: AX = fib(n)
fibonacci:
    CMP AX, 2
    JG recursive
    MOV AX, 1           ; Base case: fib(1) = fib(2) = 1
    RET

recursive:
    PUSH FP
    MOV FP, SP
    PUSH AX             ; Save n

    DEC AX
    CALL fibonacci      ; fib(n-1)
    MOV [FP-2], AX      ; Save result

    MOV AX, [FP+0]      ; Load n
    SUB AX, 2
    CALL fibonacci      ; fib(n-2)

    ADD AX, [FP-2]      ; fib(n-1) + fib(n-2)

    POP FP
    RET

MOV AX, 10
CALL fibonacci
SYSCALL PRINT_INT
HALT
```

Computes the 10th Fibonacci number (55) recursively.

Note: This is inefficient for large n due to repeated computation, but demonstrates recursion clearly.

## Memory Allocation

Programs can allocate memory dynamically.

### Using SBRK

```asm
; Allocate 100 bytes
MOV AX, 100
SYSCALL SBRK        ; AX now points to allocated memory
MOV BX, AX

; Use the memory
MOV [BX+0], 1000
MOV [BX+2], 2000

; Print values
MOV AX, [BX+0]
SYSCALL PRINT_INT
MOV AX, '\n'
SYSCALL PRINT_CHAR

MOV AX, [BX+2]
SYSCALL PRINT_INT

HALT
```

**Note:** MALLOC/FREE syscalls are not implemented in the emulator. They are reserved for optional student exercises in implementing dynamic memory allocation with free lists.

## Graphics Programming

The MTMC-16 supports simple graphics via syscalls. While this guide focuses on core programming concepts, graphics capabilities are documented in [X366-GRAPHICS.md](X366-GRAPHICS.md).

Basic example:

```asm
SYSCALL SCREEN          ; Show graphics window
MOV AX, 15              ; White color
SYSCALL SET_COLOR
MOV AX, 50              ; x = 50
MOV BX, 50              ; y = 50
SYSCALL DRAW_PIXEL
SYSCALL PAINT_DISPLAY
HALT
```

## Best Practices

### Register Usage

* Use AX-FX for parameters and temporaries
* Use CX for loop counters
* Save registers you need across function calls

### Memory Layout

* Place data at the start or end (use JMP to skip data at start)
* Initialize variables with DB/DW
* Use meaningful label names

### Functions

* Document parameters and return values in comments
* Use FP for functions with locals
* Keep functions focused on one task

### Debugging

* Use the emulator's step feature to watch execution
* Add temporary PRINT_INT calls to see variable values
* Check register values in the emulator panel

## Common Patterns

### Initialization Pattern

```asm
MOV CX, 10              ; count
MOV BX, buffer          ; pointer
MOV AX, 0               ; value

fill_loop:
    MOV [BX], AX
    ADD BX, 2
    LOOP fill_loop
```

### Parameter Passing

```asm
; Pass up to 6 parameters in AX, BX, CX, DX, EX, FX
MOV AX, param1
MOV BX, param2
MOV CX, param3
CALL function
; Result in AX
```

### Error Checking

```asm
SYSCALL MALLOC
CMP AX, -1
JE allocation_failed
; Continue with valid pointer
```

## Next Steps

You now have the foundation for x366 assembly programming. To deepen your knowledge:

* Study the example programs in `disk/examples/`
* Read [X366-ARCHITECTURE.md](X366-ARCHITECTURE.md) for complete instruction reference
* Experiment with modifying programs in the emulator
* Try implementing your own algorithms

The MTMC-16 emulator provides an excellent environment for learning low-level programming concepts that apply to real-world systems.
