; Data Directives Example
; Demonstrates DB, DW, and DUP
; Data directives are automatically placed in data segment

; Data can be defined anywhere in source
message: DB "The quick brown fox jumps over the lazy dog!", '\n', '\0'
space_count: DW 0
letter_count: DW 0

; Code section
; Count spaces and letters in message
MOV BX, message          ; BX = string pointer
MOV CX, 0                ; CX = space count
MOV DX, 0                ; DX = letter count

count_loop:
MOV AX, [BX]             ; Load byte from string
CMP AX, 0                ; Check for null terminator
JE count_done

CMP AX, ' '              ; Check if space
JE is_space

; Check if letter (A-Z or a-z)
CMP AX, 'A'
JL not_letter
CMP AX, 'Z'
JLE is_letter
CMP AX, 'a'
JL not_letter
CMP AX, 'z'
JG not_letter

is_letter:
INC DX
JMP next_char

is_space:
INC CX

next_char:
not_letter:
INC BX
JMP count_loop

count_done:
; Store results
MOV [space_count], CX
MOV [letter_count], DX

; Print results
MOV AX, message
SYSCALL PRINT_STRING

; Print space count
MOV AX, 'S'
SYSCALL PRINT_CHAR
MOV AX, 'p'
SYSCALL PRINT_CHAR
MOV AX, 'a'
SYSCALL PRINT_CHAR
MOV AX, 'c'
SYSCALL PRINT_CHAR
MOV AX, 'e'
SYSCALL PRINT_CHAR
MOV AX, 's'
SYSCALL PRINT_CHAR
MOV AX, ':'
SYSCALL PRINT_CHAR
MOV AX, ' '
SYSCALL PRINT_CHAR
MOV AX, [space_count]
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

; Print letter count
MOV AX, 'L'
SYSCALL PRINT_CHAR
MOV AX, 'e'
SYSCALL PRINT_CHAR
MOV AX, 't'
SYSCALL PRINT_CHAR
MOV AX, 't'
SYSCALL PRINT_CHAR
MOV AX, 'e'
SYSCALL PRINT_CHAR
MOV AX, 'r'
SYSCALL PRINT_CHAR
MOV AX, 's'
SYSCALL PRINT_CHAR
MOV AX, ':'
SYSCALL PRINT_CHAR
MOV AX, ' '
SYSCALL PRINT_CHAR
MOV AX, [letter_count]
SYSCALL PRINT_INT
MOV AX, 10
SYSCALL PRINT_CHAR

HALT

; More data (can be anywhere - assembler handles placement)
buffer: DB 256 DUP(0)    ; 256-byte buffer initialized to zero