; Cross-Platform Test 05: Memory Operations
; Tests direct, indirect, and relative addressing
; Expected output: 42, 99, 77 on separate lines

; Test data
data1: DW 42
data2: DW 99
buffer: DW 10 DUP(0)

; Test 1: Direct memory access
MOV AX, [data1]
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 2: Register-indirect access
MOV BX, data2
MOV AX, [BX+0]
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 3: Write and read with FP-relative using STORER/LOADR
MOV FP, buffer
MOV AX, 77
MOV [FP+4], AX
MOV AX, [FP+4]
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

SYSCALL EXIT
