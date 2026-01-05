; x366 Assembly Example
; Echo - prints command line arguments
; AX contains pointer to command line argument string

; AX already points to command line input (set by loader)
SYSCALL PRINT_STRING
SYSCALL EXIT
