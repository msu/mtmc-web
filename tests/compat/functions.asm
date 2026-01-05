; Cross-Platform Test 06: Function Calls
; Tests that function calls and stack frames work
; Expected output: 15 (sum of 5+10)

JMP main

; Function: add_nums - adds two parameters
; Parameters: [FP+4]=p1, [FP+6]=p2
; Returns: AX = sum
add_nums:
    PUSH FP
    MOV FP, SP

    MOV AX, [FP+4]   ; p1 (return address is at FP+2, old FP at FP+0)
    ADD AX, [FP+6]   ; p2

    POP FP
    RET

main:
    ; Push 2 parameters (10, 5)
    MOV AX, 10
    PUSH AX
    MOV AX, 5
    PUSH AX

    CALL add_nums

    ; Clean up stack (2 params * 2 bytes = 4 bytes)
    ADD SP, 4

    ; Print result (should be 15)
    SYSCALL PRINT_INT
    MOV AX, 10
    SYSCALL PRINT_CHAR

    SYSCALL EXIT
