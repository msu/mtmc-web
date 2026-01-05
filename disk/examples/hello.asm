; x366 Assembly Example
; Hello World using PRINT_STRING and data directives
; Note: Data can be placed anywhere - assembler moves it to data segment

; Data can go at the beginning
message: DB "Hello, World!", '\n', '\0'

; Code section
MOV AX, message
SYSCALL PRINT_STRING
HALT