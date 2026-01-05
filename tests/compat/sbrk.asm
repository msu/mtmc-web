; Cross-Platform Test 08: SBRK Memory Allocation
; Tests SBRK syscall behavior
; Expected output: Two addresses (second > first)

; Allocate 100 bytes
MOV AX, 100
SYSCALL SBRK
MOV BX, AX      ; Save first allocation address

; Print first allocation
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Allocate another 50 bytes
MOV AX, 50
SYSCALL SBRK
MOV CX, AX      ; Save second allocation address

; Print second allocation (should be first + 100)
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Verify second > first (second - first should be 100)
MOV AX, CX
SUB AX, BX
CMP AX, 100
JE success

; Error case
MOV AX, err_msg
SYSCALL PRINT_STRING
SYSCALL EXIT

success:
MOV AX, ok_msg
SYSCALL PRINT_STRING
SYSCALL EXIT

ok_msg: DB "OK", 10, 0
err_msg: DB "ERROR", 10, 0
