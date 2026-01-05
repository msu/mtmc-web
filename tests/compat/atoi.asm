; Cross-Platform Test 03: ATOI Syscall
; Tests that ATOI works identically in both platforms
; Expected output: -42, 100, 999 on separate lines

; Test 1: Negative number with leading whitespace
str1: DB "  -42xyz", 0

MOV AX, str1
SYSCALL ATOI
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 2: Positive number with + sign
str2: DB "+100abc", 0

MOV AX, str2
SYSCALL ATOI
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Test 3: Number with leading spaces
str3: DB "   999", 0

MOV AX, str3
SYSCALL ATOI
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

SYSCALL EXIT
