; Conway's Game of Life for x366 - Incremental Build
; Step 8: Test with hardcoded pattern evolution

.MEMORY 16K

; ========== Data Section ==========
; Data is automatically moved to data segment by assembler

; Game state
GRID_WIDTH: DW 40               ; 40 cells wide
GRID_HEIGHT: DW 36              ; 36 cells tall
PIXEL_SIZE: DW 4                ; Each cell is 4x4 pixels

; World arrays (40x36 = 1440 bytes each)
old_world: DB 1440 DUP(0)       ; Current generation
new_world: DB 1440 DUP(0)       ; Next generation
file_buffer: DB 2000 DUP(0)     ; CELLS file contents

; Messages
error_msg: DB "Error: Could not read file", '\n', '\0'
default_filename: DB "data/gun.cells", '\0'

; ========== Main Entry Point ==========
main:
    ; AX contains pointer to argument string, or 0 if no args
    ; Check if argument was provided
    CMP AX, 0
    JNE load_custom_file

    ; Use default filename
    MOV AX, default_filename

load_custom_file:
    ; AX now contains pointer to filename (either custom or default)
    CALL load_cells_file_with_name

    ; Initialize screen
    ; Clear screen to black first
    SYSCALL CLEAR_SCREEN

    ; Draw white background (2-bit color: 0=black, 1=dark, 2=light, 3=white)
    MOV AX, 3            ; White in 2-bit color
    SYSCALL SET_COLOR
    MOV AX, 0            ; x = 0
    MOV BX, 0            ; y = 0
    MOV CX, 160          ; width = full screen (160 pixels)
    MOV DX, 144          ; height = full screen (144 pixels)
    MOV EX, 1            ; filled = true
    SYSCALL DRAW_RECT

    ; Animation loop - run forever
animation_loop:
    ; Clear screen and redraw background
    MOV AX, 3                ; White color
    SYSCALL SET_COLOR
    MOV AX, 0
    MOV BX, 0
    MOV CX, 160
    MOV DX, 144
    MOV EX, 1
    SYSCALL DRAW_RECT

    ; Draw current generation
    CALL draw_world
    SYSCALL PAINT_DISPLAY

    ; Update to next generation
    CALL update_world
    CALL copy_world

    ; Continue forever
    JMP animation_loop

; ========== Load CELLS File ==========
; Reads CELLS file and populates old_world
; Parameter: AX = pointer to filename string
load_cells_file_with_name:
    PUSH FP
    MOV FP, SP

    ; Read file (AX already contains filename pointer)
    MOV BX, file_buffer
    MOV CX, 1999
    SYSCALL READ_FILE

    ; Check for error
    CMP AX, -1
    JE file_error

    ; Parse file buffer
    MOV EX, file_buffer         ; EX = current position in file
    MOV FX, 0                   ; FX = current y position

parse_line:
    ; Check if at end of file
    MOV AL, [EX]
    CMP AL, '\0'
    JE parse_done

    ; Check for newline
    CMP AL, '\n'
    JE next_line

    ; Check for comment line
    CMP AL, '!'
    JNE parse_row_start

    ; Skip comment line
skip_comment_loop:
    MOV AL, [EX]
    CMP AL, '\0'
    JE parse_done
    INC EX
    CMP AL, '\n'
    JNE skip_comment_loop
    INC FX
    JMP parse_line

parse_row_start:
    ; Parse row of cells
    MOV DX, 0               ; DX = x position

parse_row:
    MOV AL, [EX]
    CMP AL, '\0'
    JE parse_done
    CMP AL, '\n'
    JE next_line

    ; Check for live cell ('O')
    CMP AL, 'O'
    JNE check_dead

    ; Store live cell at offset = y * 40 + x
    PUSH EX
    PUSH DX
    MOV AX, FX
    MOV BX, 40
    MUL BX
    ADD AX, DX
    MOV BX, old_world
    ADD BX, AX
    MOV AL, 1
    MOV [BX], AL
    POP DX
    POP EX

check_dead:
    INC EX
    INC DX

    ; Check if row is complete
    CMP DX, 40
    JL parse_row

next_line:
    INC EX
    INC FX
    JMP parse_line

parse_done:
    MOV SP, FP
    POP FP
    RET

file_error:
    MOV AX, error_msg
    SYSCALL PRINT_STRING
    SYSCALL EXIT

; ========== Draw World ==========
; Draws all live cells from old_world array
draw_world:
    PUSH FP
    MOV FP, SP
    SUB SP, 4                ; Local vars: y, x

    ; Set color for live cells (black)
    MOV AX, 0
    SYSCALL SET_COLOR

    ; Iterate through all cells
    MOV AX, 0
    MOV [FP-2], AX           ; y = 0

draw_y_loop:
    MOV AX, 0
    MOV [FP-4], AX           ; x = 0

draw_x_loop:
    ; Calculate cell offset
    MOV AX, [FP-2]          ; y
    MOV BX, 40
    MUL BX                   ; AX = y * 40
    ADD AX, [FP-4]          ; AX = y * 40 + x (byte offset)
    MOV BX, old_world
    ADD BX, AX

    ; Check if cell is alive
    MOV AL, [BX]
    CMP AL, 1
    JNE skip_draw

    ; Draw 4x4 rectangle at (x*4, y*4)
    MOV AX, [FP-4]          ; x
    MOV BX, 4
    MUL BX                   ; AX = x * 4
    PUSH AX                  ; Save screen x

    MOV AX, [FP-2]          ; y
    MOV BX, 4
    MUL BX                   ; AX = y * 4
    MOV BX, AX               ; BX = screen y

    POP AX                   ; AX = screen x
    MOV CX, 4                ; width = 4
    MOV DX, 4                ; height = 4
    MOV EX, 1                ; filled = true

    SYSCALL DRAW_RECT

skip_draw:
    ; Next x
    MOV AX, [FP-4]
    INC AX
    MOV [FP-4], AX
    CMP AX, 40
    JL draw_x_loop

    ; Next y
    MOV AX, [FP-2]
    INC AX
    MOV [FP-2], AX
    CMP AX, 36
    JL draw_y_loop

    MOV SP, FP
    POP FP
    RET

; ========== Count Neighbors ==========
; Parameters: CX = x, DX = y
; Returns: AX = neighbor count
count_neighbors:
    PUSH FP
    MOV FP, SP
    SUB SP, 6                ; Locals: count, dx, dy

    MOV AX, 0
    MOV [FP-2], AX           ; count = 0

    ; Check all 8 neighbors
    ; (-1,-1), (0,-1), (1,-1)
    ; (-1, 0),    X,   (1, 0)
    ; (-1, 1), (0, 1), (1, 1)

    ; Loop through dy = -1 to 1
    MOV AX, -1
    MOV [FP-4], AX           ; dy = -1

dy_loop:
    ; Loop through dx = -1 to 1
    MOV AX, -1
    MOV [FP-6], AX           ; dx = -1

dx_loop:
    ; Skip center cell (0, 0)
    MOV AX, [FP-4]          ; dy
    CMP AX, 0
    JNE check_neighbor
    MOV AX, [FP-6]          ; dx
    CMP AX, 0
    JE next_dx

check_neighbor:
    ; Calculate neighbor coordinates
    MOV AX, CX               ; x
    ADD AX, [FP-6]          ; x + dx

    ; Check x bounds (0-39)
    CMP AX, 0
    JL next_dx
    CMP AX, 40
    JGE next_dx

    PUSH AX                  ; Save neighbor x

    MOV AX, DX               ; y
    ADD AX, [FP-4]          ; y + dy

    ; Check y bounds (0-35)
    CMP AX, 0
    JL skip_neighbor
    CMP AX, 36
    JGE skip_neighbor

    ; Calculate offset: y * 40 + x (byte offset)
    MOV BX, 40
    MUL BX                   ; AX = neighbor_y * 40
    POP BX                   ; BX = neighbor_x
    PUSH BX                  ; Keep it on stack
    ADD AX, BX               ; AX = y * 40 + x (byte offset)

    ; Check if neighbor is alive
    MOV BX, old_world
    ADD BX, AX
    MOV AL, [BX]
    CMP AL, 1
    JNE skip_neighbor

    ; Increment count
    MOV AX, [FP-2]
    INC AX
    MOV [FP-2], AX

skip_neighbor:
    POP AX                   ; Clean up stack

next_dx:
    ; Next dx
    MOV AX, [FP-6]
    INC AX
    MOV [FP-6], AX
    CMP AX, 2
    JL dx_loop

    ; Next dy
    MOV AX, [FP-4]
    INC AX
    MOV [FP-4], AX
    CMP AX, 2
    JL dy_loop

    ; Return count in AX
    MOV AX, [FP-2]
    MOV SP, FP
    POP FP
    RET

; ========== Update World ==========
; Applies Game of Life rules to compute new_world from old_world
update_world:
    PUSH FP
    MOV FP, SP
    SUB SP, 4                ; Locals: y, x

    ; Iterate through all cells
    MOV AX, 0
    MOV [FP-2], AX           ; y = 0

update_y_loop:
    MOV AX, 0
    MOV [FP-4], AX           ; x = 0

update_x_loop:
    ; Count neighbors for current cell
    MOV CX, [FP-4]           ; x
    MOV DX, [FP-2]           ; y
    CALL count_neighbors     ; AX = neighbor count

    ; Save neighbor count
    PUSH AX

    ; Get current cell state
    ; Calculate offset: y * 40 + x (byte offset)
    MOV AX, [FP-2]           ; y
    MOV BX, 40
    MUL BX                   ; AX = y * 40
    ADD AX, [FP-4]           ; AX = y * 40 + x (byte offset)
    MOV BX, old_world
    ADD BX, AX
    MOV CL, [BX]             ; CL = current cell state (0 or 1)

    ; Apply Game of Life rules
    POP AX                   ; AX = neighbor count

    ; Default: cell dies (or stays dead)
    MOV DX, 0

    ; Check if cell is alive
    CMP CL, 1
    JE cell_alive

    ; Dead cell: becomes alive with exactly 3 neighbors
    CMP AX, 3
    JNE write_cell
    MOV DL, 1
    JMP write_cell

cell_alive:
    ; Live cell: survives with 2 or 3 neighbors
    CMP AX, 2
    JE cell_survives
    CMP AX, 3
    JNE write_cell

cell_survives:
    MOV DL, 1

write_cell:
    ; Write new cell state to new_world
    ; Calculate offset: y * 40 + x (byte offset)
    MOV AX, [FP-2]           ; y
    MOV BX, 40
    MUL BX                   ; AX = y * 40
    ADD AX, [FP-4]           ; AX = y * 40 + x (byte offset)
    MOV BX, new_world
    ADD BX, AX
    MOV [BX], DL             ; Write new state

    ; Next x
    MOV AX, [FP-4]
    INC AX
    MOV [FP-4], AX
    CMP AX, 40
    JL update_x_loop

    ; Next y
    MOV AX, [FP-2]
    INC AX
    MOV [FP-2], AX
    CMP AX, 36
    JL update_y_loop

    MOV SP, FP
    POP FP
    RET

; ========== Copy World ==========
; Copies new_world to old_world
copy_world:
    PUSH FP
    MOV FP, SP

    ; Copy 1440 bytes (using byte operations)
    MOV CX, 0                ; offset = 0

copy_loop:
    MOV BX, new_world
    ADD BX, CX
    MOV AL, [BX]             ; Read from new_world

    MOV BX, old_world
    ADD BX, CX
    MOV [BX], AL             ; Write to old_world

    INC CX                   ; Next byte
    CMP CX, 1440             ; 1440 bytes (40 * 36)
    JL copy_loop

    MOV SP, FP
    POP FP
    RET
