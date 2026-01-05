; Count down from a number using LOOP instruction
; Takes command line argument or defaults to 5
; Example: x366 count_down.asm "10"

main:
    ; Check if command line input was provided (AX points to input or is 0)
    CMP AX, 0
    JE use_default

    ; Parse command line argument
    SYSCALL ATOI         ; Convert string to integer in AX
    JMP start_count

use_default:
    MOV AX, 5            ; Default value

start_count:
    ; AX now contains the starting number
    MOV CX, AX           ; CX = counter for LOOP
    CMP CX, 0            ; Check if already 0 or negative
    JLE done             ; Nothing to print if <= 0

count_loop:
    ; Print current number (CX)
    MOV AX, CX
    SYSCALL PRINT_INT
    MOV AL, '\n'
    SYSCALL PRINT_CHAR

    ; LOOP automatically decrements CX and jumps if CX != 0
    LOOP count_loop

done:
    SYSCALL EXIT
