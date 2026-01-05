; Graphics Demo
; Draw some shapes on the display
; Demonstrates using all 6 general-purpose registers

; Clear screen
SYSCALL CLEAR_SCREEN

; Set color to 3 (lightest)
MOV AX, 3
SYSCALL SET_COLOR

; Draw a filled rectangle
MOV AX, 10    ; x
MOV BX, 10    ; y
MOV CX, 50    ; width
MOV DX, 30    ; height
SYSCALL DRAW_RECT

; Set color to 1
MOV AX, 1
SYSCALL SET_COLOR

; Draw a circle
MOV AX, 80    ; cx
MOV BX, 72    ; cy
MOV CX, 20    ; radius
SYSCALL DRAW_CIRCLE

; Set color to 2
MOV AX, 2
SYSCALL SET_COLOR

; Draw a line
MOV AX, 0     ; x1
MOV BX, 0     ; y1
MOV CX, 159   ; x2
MOV DX, 143   ; y2
SYSCALL DRAW_LINE

; Draw diagonal lines using EX and FX for loop counters
MOV EX, 0     ; x counter
MOV FX, 3     ; color
line_loop:
MOV AX, FX
SYSCALL SET_COLOR
MOV AX, EX
MOV BX, 0
MOV CX, EX
MOV DX, 143
SYSCALL DRAW_LINE
ADD EX, 20
CMP EX, 160
JL line_loop

; Refresh display
SYSCALL PAINT_DISPLAY

HALT