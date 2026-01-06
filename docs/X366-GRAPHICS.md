# X366 Graphics Programming

X366 includes a simple graphics system for creating games and visual demonstrations.

## Display Specifications

- **Resolution**: 160x144 pixels
- **Color Depth**: 2-bit (4 colors)
- **Color Palette**: Green monochrome palette
- **Rendering**: Direct VRAM updates with manual refresh

## Color Palette

The display uses a 4-color green monochrome palette:

| Color | Value | Hex Color | Description |
|-------|-------|-----------|-------------|
| 0 | Darkest | #0f380f | Darkest green |
| 1 | Dark | #306230 | Dark green |
| 2 | Light | #8bac0f | Light green |
| 3 | Lightest | #9bbc0f | Lightest green (default) |

## Graphics Syscalls

X366 provides 7 graphics-related syscalls (codes 10-17):

### SYSCALL 10: SET_COLOR

Set the current drawing color (0-3).

```asm
MOV AX, color      ; Color 0-3
SYSCALL SET_COLOR
```

**Parameters:**
- **AX**: Color code (0-3)

**Behavior:**
- Sets the color for all subsequent drawing operations
- Values outside 0-3 are masked to 2 bits
- Default color is 3 (lightest)

**Example:**
```asm
MOV AX, 1          ; Dark green
SYSCALL SET_COLOR
```

### SYSCALL 11: DRAW_PIXEL

Draw a single pixel at coordinates (x, y).

```asm
MOV AX, x          ; X coordinate
MOV BX, y          ; Y coordinate
SYSCALL DRAW_PIXEL
```

**Parameters:**
- **AX**: X coordinate (0-159)
- **BX**: Y coordinate (0-143)

**Behavior:**
- Draws pixel in current color
- Coordinates outside bounds are clipped
- Does not automatically refresh display

**Example:**
```asm
MOV AX, 2          ; Light green
SYSCALL SET_COLOR
MOV AX, 80         ; Center X
MOV BX, 72         ; Center Y
SYSCALL DRAW_PIXEL
```

### SYSCALL 12: DRAW_LINE

Draw a line between two points.

```asm
MOV AX, x1         ; Start X
MOV BX, y1         ; Start Y
MOV CX, x2         ; End X
MOV DX, y2         ; End Y
SYSCALL DRAW_LINE
```

**Parameters:**
- **AX**: Starting X coordinate
- **BX**: Starting Y coordinate
- **CX**: Ending X coordinate
- **DX**: Ending Y coordinate

**Behavior:**
- Draws line in current color using Bresenham's algorithm
- Does not automatically refresh display

**Example:**
```asm
MOV AX, 3          ; Lightest color
SYSCALL SET_COLOR
MOV AX, 0          ; Top-left
MOV BX, 0
MOV CX, 159        ; Bottom-right
MOV DX, 143
SYSCALL DRAW_LINE
```

### SYSCALL 13: DRAW_RECT

Draw a filled rectangle.

```asm
MOV AX, x          ; Top-left X
MOV BX, y          ; Top-left Y
MOV CX, width      ; Width in pixels
MOV DX, height     ; Height in pixels
SYSCALL DRAW_RECT
```

**Parameters:**
- **AX**: Top-left X coordinate
- **BX**: Top-left Y coordinate
- **CX**: Width in pixels
- **DX**: Height in pixels

**Behavior:**
- Draws filled rectangle in current color
- Portions outside screen bounds are clipped
- Does not automatically refresh display

**Example:**
```asm
MOV AX, 2          ; Light green
SYSCALL SET_COLOR
MOV AX, 50         ; X position
MOV BX, 50         ; Y position
MOV CX, 30         ; Width
MOV DX, 20         ; Height
SYSCALL DRAW_RECT
```

### SYSCALL 14: DRAW_CIRCLE

Draw a filled circle.

```asm
MOV AX, cx         ; Center X
MOV BX, cy         ; Center Y
MOV CX, radius     ; Radius in pixels
SYSCALL DRAW_CIRCLE
```

**Parameters:**
- **AX**: Center X coordinate
- **BX**: Center Y coordinate
- **CX**: Radius in pixels

**Behavior:**
- Draws filled circle in current color
- Portions outside screen bounds are clipped
- Does not automatically refresh display

**Example:**
```asm
MOV AX, 1          ; Dark green
SYSCALL SET_COLOR
MOV AX, 80         ; Center X
MOV BX, 72         ; Center Y
MOV CX, 25         ; Radius
SYSCALL DRAW_CIRCLE
```

### SYSCALL 15: CLEAR_SCREEN

Clear the entire screen to the current color.

```asm
SYSCALL CLEAR_SCREEN
```

**Behavior:**
- Fills entire 160x144 screen with current color
- Does not automatically refresh display
- Useful for clearing before redrawing each frame

**Example:**
```asm
MOV AX, 0          ; Darkest green
SYSCALL SET_COLOR
SYSCALL CLEAR_SCREEN
```

### SYSCALL 16: DRAW_TEXT

Draw text string on screen.

```asm
MOV AX, x          ; X position
MOV BX, y          ; Y position
MOV CX, string     ; Address of null-terminated string
SYSCALL DRAW_TEXT
```

**Parameters:**
- **AX**: X coordinate for text start
- **BX**: Y coordinate for text top
- **CX**: Memory address of null-terminated string

**Behavior:**
- Draws text in current color
- Uses built-in monospace font
- Text outside screen bounds is clipped
- Does not automatically refresh display

**Example:**
```asm
message: DB "Hello!", '\0'

MOV AX, 3          ; Lightest color
SYSCALL SET_COLOR
MOV AX, 20         ; X position
MOV BX, 60         ; Y position
MOV CX, message    ; String address
SYSCALL DRAW_TEXT
```

### SYSCALL 17: PAINT_DISPLAY

Refresh the display to show all drawn graphics.

```asm
SYSCALL PAINT_DISPLAY
```

**Behavior:**
- Updates the screen to show all drawing operations
- Must be called after drawing to make changes visible
- This is the key difference from the old graphics system

**Example:**
```asm
; Draw multiple shapes
SYSCALL CLEAR_SCREEN
; ... draw shapes ...
SYSCALL PAINT_DISPLAY    ; Now make them visible
```

## Important: Manual Display Refresh

Unlike older graphics systems, the MTMC-16 graphics require **manual refresh**:

1. Drawing operations (DRAW_PIXEL, DRAW_LINE, etc.) modify VRAM only
2. Changes are **not visible** until you call **SYSCALL PAINT_DISPLAY**
3. This allows you to draw multiple shapes efficiently before refreshing

**Typical Pattern:**
```asm
frame_loop:
    ; Clear screen
    MOV AX, 0
    SYSCALL SET_COLOR
    SYSCALL CLEAR_SCREEN

    ; Draw all graphics
    CALL draw_background
    CALL draw_sprites
    CALL draw_ui

    ; Make everything visible
    SYSCALL PAINT_DISPLAY

    ; Frame delay
    MOV AX, 16
    SYSCALL SLEEP

    JMP frame_loop
```

## Complete Graphics Example

```asm
; Graphics Demo - Draw shapes
SYSCALL CLEAR_SCREEN

; Draw a filled rectangle
MOV AX, 3              ; Lightest color
SYSCALL SET_COLOR
MOV AX, 10             ; x
MOV BX, 10             ; y
MOV CX, 50             ; width
MOV DX, 30             ; height
SYSCALL DRAW_RECT

; Draw a circle
MOV AX, 1              ; Dark color
SYSCALL SET_COLOR
MOV AX, 80             ; cx
MOV BX, 72             ; cy
MOV CX, 20             ; radius
SYSCALL DRAW_CIRCLE

; Draw a diagonal line
MOV AX, 2              ; Light color
SYSCALL SET_COLOR
MOV AX, 0              ; x1
MOV BX, 0              ; y1
MOV CX, 159            ; x2
MOV DX, 143            ; y2
SYSCALL DRAW_LINE

; Refresh to show everything
SYSCALL PAINT_DISPLAY

HALT
```

## Animation Example

```asm
; Bouncing ball animation
ball_x: DW 80
ball_y: DW 72
ball_dx: DW 2
ball_dy: DW 1

game_loop:
    ; Clear screen
    MOV AX, 0
    SYSCALL SET_COLOR
    SYSCALL CLEAR_SCREEN

    ; Draw ball
    MOV AX, 3          ; Lightest color
    SYSCALL SET_COLOR
    MOV AX, [ball_x]
    MOV BX, [ball_y]
    MOV CX, 5          ; Radius
    SYSCALL DRAW_CIRCLE

    ; Refresh display
    SYSCALL PAINT_DISPLAY

    ; Update position
    MOV AX, [ball_x]
    ADD AX, [ball_dx]
    MOV [ball_x], AX

    MOV AX, [ball_y]
    ADD AX, [ball_dy]
    MOV [ball_y], AX

    ; Bounce off walls
    MOV AX, [ball_x]
    CMP AX, 155
    JL no_bounce_right
    MOV AX, [ball_dx]
    NOT AX
    INC AX             ; Negate
    MOV [ball_dx], AX
no_bounce_right:

    ; Frame delay (60 FPS)
    MOV AX, 16
    SYSCALL SLEEP

    JMP game_loop
```

## Using All Six Registers

The graphics system is designed to work well with x366's six general-purpose registers:

```asm
; Draw multiple diagonal lines using EX and FX
MOV EX, 0              ; x counter
MOV FX, 3              ; color

line_loop:
    MOV AX, FX
    SYSCALL SET_COLOR

    MOV AX, EX         ; x1
    MOV BX, 0          ; y1
    MOV CX, EX         ; x2
    MOV DX, 143        ; y2
    SYSCALL DRAW_LINE

    ADD EX, 20         ; Next x position
    CMP EX, 160
    JL line_loop

SYSCALL PAINT_DISPLAY
```

## Performance Considerations

### Frame Rate Control

Use SYSCALL SLEEP to control animation speed:

```asm
; 60 FPS (16.67ms per frame)
MOV AX, 16
SYSCALL SLEEP

; 30 FPS (33.33ms per frame)
MOV AX, 33
SYSCALL SLEEP
```

### Drawing Efficiency

For best performance:
1. Clear screen once at the start of each frame
2. Draw all shapes for the frame
3. Call PAINT_DISPLAY once at the end
4. Add frame delay if needed

## Coordinate System

```
(0,0)                   (159,0)
  +--------------------+
  |                    |
  |                    |
  |      Screen        |
  |                    |
  |                    |
  +--------------------+
(0,143)                (159,143)
```

- Origin (0,0) is **top-left**
- X increases to the **right** (0-159)
- Y increases **downward** (0-143)
- Bottom-right is (159,143)

## Example Programs

See these example programs in `disk/examples/`:
- `graphics.asm` - Graphics primitives demo
- `gol.asm` - Conway's Game of Life implementation