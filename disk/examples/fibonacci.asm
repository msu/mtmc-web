; Fibonacci Sequence
; Print first 10 fibonacci numbers
; Uses EX and FX to avoid push/pop

MOV EX, 0      ; fib(n-1)
MOV FX, 1      ; fib(n)
MOV CX, 0      ; counter

fib_loop:
; Print current fibonacci number
MOV AX, EX
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Calculate next: fib(n+1) = fib(n) + fib(n-1)
MOV AX, EX
ADD AX, FX     ; AX = fib(n-1) + fib(n)
MOV EX, FX     ; fib(n-1) = old fib(n)
MOV FX, AX     ; fib(n) = new value

; Increment counter
INC CX
CMP CX, 10
JL fib_loop

HALT