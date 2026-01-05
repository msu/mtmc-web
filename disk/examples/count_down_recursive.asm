; Count down from a number using recursion
; Takes command line argument or defaults to 5
; Example: x366 count_down_recursive.asm "10"

JMP main

; Recursive countdown function
; Parameter: AX = number to count down from
; Prints AX, then recursively calls with AX-1 until 0
count_down:
    PUSH FP
    MOV FP, SP

    ; Base case: if AX <= 0, return
    CMP AX, 0
    JLE done

    ; Print current number
    PUSH AX              ; Save AX before syscall
    SYSCALL PRINT_INT
    MOV AL, '\n'
    SYSCALL PRINT_CHAR
    POP AX               ; Restore AX

    ; Recursive call with AX - 1
    DEC AX
    CALL count_down

done:
    POP FP
    RET

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
    ; Call recursive countdown function
    CALL count_down

    SYSCALL EXIT
