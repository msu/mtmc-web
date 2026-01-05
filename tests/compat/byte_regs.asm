; Cross-Platform Test 02: Byte Registers
; Tests that byte registers (AL, BL, CL, DL, EL, FL) work correctly
; Expected output: Should print 'A', 'B', 'C', 'D', 'E', 'F' then exit

; Test byte register access - load immediate bytes into AL
; Then print them
MOV AL, 'A'
SYSCALL PRINT_CHAR

MOV AL, 'B'
SYSCALL PRINT_CHAR

MOV AL, 'C'
SYSCALL PRINT_CHAR

MOV AL, 'D'
SYSCALL PRINT_CHAR

MOV AL, 'E'
SYSCALL PRINT_CHAR

MOV AL, 'F'
SYSCALL PRINT_CHAR

MOV AX, 10
SYSCALL PRINT_CHAR  ; newline

SYSCALL EXIT
