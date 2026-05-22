# X366 Calling Convention

## Overview

X366 uses a register-based calling convention similar to modern architectures (x86-64, ARM, RISC-V). Parameters are passed in registers for efficiency, with a limit of 6 parameters per function.

## Register Usage

### Parameter Registers
- **AX** - First parameter / Return value
- **BX** - Second parameter
- **CX** - Third parameter
- **DX** - Fourth parameter
- **SI** - Fifth parameter
- **DI** - Sixth parameter

### Preserved Registers (Callee-saved)
- **BP** - base pointer (must be preserved if used)
- **SP** - Stack pointer (must be preserved)

### Scratch Registers (Caller-saved)
- **AX, BX, CX, DX, SI, DI** - Not preserved across calls, caller *must* push & pop them if they wish values to be preserved

## Function Call Protocol

### How CALL and RET Work

The **CALL** instruction performs two operations:
1. Pushes the return address (current IP + 4) onto the top of the stack
2. Jumps to the target function address

The **RET** instruction performs the reverse:
1. Pops the return address from the top of the stack
2. Jumps to that address (returning to caller)

```asm
; Before CALL:
; SP = 0x0400
; IP = 0x0050

CALL function    ; Pushes 0x0054 onto stack, jumps to function
                 ; SP now = 0x03FE
                 ; [0x03FE] = 0x0054 (return address)

function:
    ; Do work...
    RET          ; Pops 0x0054 from stack, jumps there
                 ; SP restored to 0x0400
                 ; IP = 0x0054 (instruction after CALL)
```

### Caller Responsibilities
1. Place up to 6 parameters in AX, BX, CX, DX, SI, DI (in order)
2. Save any needed values in AX-DI before calling
3. Execute CALL instruction (which pushes return address and jumps)
4. Result is returned in AX

### Callee Responsibilities
1. Parameters are already in AX, BX, CX, DX, SI, DI
2. Preserve BP if used (PUSH BP at entry, POP BP before RET)
3. Preserve SP (return with same stack pointer value)
4. Place return value in AX
5. Execute RET instruction (which pops return address and jumps back)

## Function Prologue and Epilogue

Functions that need local variables use a standard prologue/epilogue pattern.

### Prologue (Function Entry)

The function prologue sets up the stack "frame", a section of stack memory that is used to hold local variables for the function:

```asm
function:
    PUSH BP              ; Save caller's base pointer
    MOV BP, SP           ; BP now points to saved BP location
    SUB SP, 4            ; Allocate 4 bytes (2 local variables)
```

After prologue, the stack looks like:
```
[BP+2]  = return address (pushed by CALL)
[BP+0]  = saved BP (pushed by PUSH BP)
[BP-2]  = local variable 1 (allocated by SUB SP)
[BP-4]  = local variable 2 (allocated by SUB SP)
[SP]    = current stack top
```

### Epilogue (Function Exit)

The function epilogue "tears down" the stack frame by restoring SP & BP, then returning:

```asm
    MOV SP, BP           ; Deallocate locals (SP = BP)
    POP BP               ; Restore caller's BP
    RET                  ; Pop return address and jump back
```

The epilogue must:
1. Deallocate local variables (restore SP to point at saved BP)
2. Restore the caller's BP
3. Return (RET pops return address and jumps)

### Complete Example with Prologue/Epilogue

```asm
function:
    ; === PROLOGUE ===
    PUSH BP              ; Save caller's BP
    MOV BP, SP           ; Set up our BP
    SUB SP, 4            ; Allocate 2 locals

    ; === FUNCTION BODY ===
    ; Parameters in AX, BX, CX, DX, SI, DI
    ; Local variables at [BP-2], [BP-4]
    MOV [BP-2], AX       ; Store param in local
    ; ... do work ...
    MOV AX, [BP-2]       ; Load result

    ; === EPILOGUE ===
    MOV SP, BP           ; Deallocate locals
    POP BP               ; Restore caller's BP
    RET                  ; Return to caller
```

## Examples

### Simple Function (No Stack Frame)
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
    SYSCALL EXIT
```

### Function with Local Variables
```asm
; multiply_and_add(a, b, c) returns (a * b) + c
; Uses local variable to store intermediate result
multiply_and_add:
    PUSH BP              ; Save BP
    MOV BP, SP           ; Set up frame
    SUB SP, 2            ; Allocate 1 local variable

    ; AX = a, BX = b, CX = c
    MUL BX               ; AX = a * b
    MOV [BP-2], AX       ; Store intermediate result
    MOV AX, [BP-2]       ; Load it back
    ADD AX, CX           ; AX = (a*b) + c

    MOV SP, BP           ; Deallocate locals
    POP BP               ; Restore BP
    RET

; Caller
main:
    MOV AX, 5            ; a = 5
    MOV BX, 3            ; b = 3
    MOV CX, 2            ; c = 2
    CALL multiply_and_add ; Result: (5*3)+2 = 17
    SYSCALL PRINT_INT
    SYSCALL EXIT
```

### Preserving Caller Registers

When calling a function a caller must preserve all registers that they want to use after the function call.  This is done
by pushing them onto the stack before the function call and then restoring them after the function call.  Note that if
you store multiple registers you should push them in one order then pop them in reverse order.

```asm
; If caller needs to preserve AX-DI across a call:
main:
    MOV AX, 100          ; Important value in AX
    PUSH AX              ; Save it

    MOV AX, 1            ; Set up parameters
    MOV BX, 2
    CALL some_function   ; May modify AX, BX, CX, DX, SI, DI

    POP AX               ; Restore saved value
    ; Continue using original AX value
```