; Simple Loop Example
; Counts from 0 to 9

MOV CX, 0      ; Counter

loop_start:
MOV AX, CX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

INC CX
CMP CX, 10
JL loop_start

HALT