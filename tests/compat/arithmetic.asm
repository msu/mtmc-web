; Cross-Platform Test 04: Arithmetic Operations
; Tests basic arithmetic with all registers
; Expected output: 15, 3, 40, 2, 7 on separate lines

; Test 1: Addition (5 + 10 = 15)
MOV AX, 5
MOV BX, 10
ADD AX, BX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 2: Subtraction (10 - 7 = 3)
MOV CX, 10
MOV DX, 7
SUB CX, DX
MOV AX, CX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 3: Multiplication (8 * 5 = 40)
MOV AX, 8
MOV BX, 5
MUL BX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 4: Division (10 / 5 = 2)
MOV AX, 10
MOV BX, 5
DIV BX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 5: INC/DEC (5 + 1 + 1 = 7)
MOV EX, 5
INC EX
INC EX
MOV AX, EX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

SYSCALL EXIT
