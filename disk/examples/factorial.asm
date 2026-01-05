; Factorial Example
; Calculate 5!
; Uses EX to avoid push/pop

MOV AX, 5      ; n = 5
CALL factorial
; Result in AX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR
HALT

factorial:
; Calculate factorial of AX
; Result in AX
; Uses EX for counter (no push/pop needed)

MOV EX, AX     ; EX = n (counter)
MOV AX, 1      ; result = 1

fact_loop:
CMP EX, 1
JLE fact_done
MUL EX         ; result *= n
DEC EX
JMP fact_loop

fact_done:
RET