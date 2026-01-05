// MTOS - MonTana Operating System
// Handles syscalls and provides OS services to the emulator

import { Syscall } from './emulator.js'

export class OS {
  constructor(cpu, memory, display = null, filesystem = null) {
    this.cpu = cpu
    this.memory = memory
    this.display = display
    this.filesystem = filesystem
    this.outputCallback = null
    this.haltCallback = null
    this.inputCallback = null
  }

  // Set callback for console output
  setOutputCallback(callback) {
    this.outputCallback = callback
  }

  // Set callback for halt
  setHaltCallback(callback) {
    this.haltCallback = callback
  }

  // Set callback for input
  setInputCallback(callback) {
    this.inputCallback = callback
  }

  // Set display
  setDisplay(display) {
    this.display = display
  }

  // Output text to console
  print(text) {
    if (this.outputCallback) {
      this.outputCallback(text)
    }
  }

  // Handle a syscall
  syscall(num) {
    switch (num) {
      case Syscall.EXIT:
        this.sysExit()
        break

      case Syscall.PRINT_CHAR:
        this.sysPrintChar()
        break

      case Syscall.PRINT_STRING:
        this.sysPrintString()
        break

      case Syscall.PRINT_INT:
        this.sysPrintInt()
        break

      case Syscall.READ_CHAR:
        this.sysReadChar()
        break

      case Syscall.READ_INT:
        this.sysReadInt()
        break

      case Syscall.READ_STRING:
        this.sysReadString()
        break

      case Syscall.ATOI:
        this.sysAtoi()
        break

      case Syscall.SBRK:
        this.sysSbrk()
        break

      // Display syscalls
      case Syscall.SET_COLOR:
        this.sysSetColor()
        break

      case Syscall.DRAW_PIXEL:
        this.sysDrawPixel()
        break

      case Syscall.DRAW_LINE:
        this.sysDrawLine()
        break

      case Syscall.DRAW_RECT:
        this.sysDrawRect()
        break

      case Syscall.DRAW_CIRCLE:
        this.sysDrawCircle()
        break

      case Syscall.CLEAR_SCREEN:
        this.sysClearScreen()
        break

      case Syscall.PAINT_DISPLAY:
        this.sysRefresh()
        break

      case Syscall.SLEEP:
        this.sysSleep()
        break

      case Syscall.READ_FILE:
        this.sysReadFile()
        break

      case Syscall.MALLOC:
        this.sysMalloc()
        break

      case Syscall.FREE:
        this.sysFree()
        break

      default:
        this.print(`[Unknown syscall: ${num}]`)
    }
  }

  // ============================================================================
  // Syscall Implementations
  // ============================================================================

  // SYSCALL 0: EXIT
  sysExit() {
    // Halt the CPU
    if (this.cpu) {
      this.cpu.halted = true
    }

    if (this.haltCallback) {
      this.haltCallback()
    }
    // Debug message handled by UI layer
  }

  // SYSCALL 1: PRINT_CHAR
  // Input: AX = character code
  sysPrintChar() {
    const char = String.fromCharCode(this.cpu.registers.AX & 0xFF)
    this.print(char)
  }

  // SYSCALL 2: PRINT_STRING
  // Input: AX = address of null-terminated string
  sysPrintString() {
    const addr = this.cpu.registers.AX
    let str = ''
    let i = 0

    // Read until null terminator or safety limit
    while (i < 1000) {
      const byte = this.memory.readByte(addr + i)
      if (byte === 0) break
      str += String.fromCharCode(byte)
      i++
    }

    this.print(str)
  }

  // SYSCALL 3: PRINT_INT
  // Input: AX = integer to print (signed 16-bit)
  sysPrintInt() {
    const num = this.cpu.registers.AX
    // Handle as signed 16-bit integer
    const signed = num > 32767 ? num - 65536 : num
    this.print(signed.toString())
  }

  // SYSCALL 4: READ_CHAR
  // Output: AX = character code
  sysReadChar() {
    if (this.inputCallback) {
      const char = this.inputCallback()
      this.cpu.setRegByName('AX', char ? char.charCodeAt(0) : 0)
    } else {
      this.cpu.setRegByName('AX', 0)
    }
  }

  // SYSCALL 5: READ_INT
  // Output: AX = integer read from input
  sysReadInt() {
    if (this.inputCallback) {
      const input = this.inputCallback()
      const num = parseInt(input, 10)
      if (!isNaN(num)) {
        // Handle as signed 16-bit
        this.cpu.setRegByName('AX', num & 0xFFFF)
      } else {
        this.cpu.setRegByName('AX', 0)
      }
    } else {
      this.cpu.setRegByName('AX', 0)
    }
  }

  // SYSCALL 6: READ_STRING
  // Input: AX = buffer address, BX = max length
  // Output: AX = number of characters read
  sysReadString() {
    const bufAddr = this.cpu.registers.AX
    const maxLen = this.cpu.registers.BX

    if (this.inputCallback) {
      let input = this.inputCallback()

      // Limit to maxLen if specified
      if (maxLen > 0 && input.length > maxLen) {
        input = input.substring(0, maxLen)
      }

      // Write string to memory
      for (let i = 0; i < input.length; i++) {
        this.memory.writeByte(bufAddr + i, input.charCodeAt(i))
      }
      // Null terminator
      this.memory.writeByte(bufAddr + input.length, 0)

      this.cpu.setRegByName('AX', input.length)
    } else {
      this.cpu.setRegByName('AX', 0)
    }
  }

  // SYSCALL 7: ATOI - parse integer from string
  // Input: AX = address of null-terminated string
  // Output: AX = parsed integer, BX = pointer to character after parsed number
  sysAtoi() {
    let strAddr = this.cpu.registers.AX
    let result = 0
    let negative = false

    // Skip leading whitespace
    while (true) {
      const ch = this.memory.readByte(strAddr)
      if (ch === 0) break // null terminator
      if (ch !== 32 && ch !== 9 && ch !== 10 && ch !== 13) break // not space, tab, newline, CR
      strAddr++
    }

    // Check for optional sign
    const signChar = this.memory.readByte(strAddr)
    if (signChar === 45) { // '-'
      negative = true
      strAddr++
    } else if (signChar === 43) { // '+'
      strAddr++
    }

    // Parse consecutive digits
    while (true) {
      const ch = this.memory.readByte(strAddr)
      if (ch >= 48 && ch <= 57) { // '0' to '9'
        result = result * 10 + (ch - 48)
        strAddr++
      } else {
        break
      }
    }

    // Apply sign
    if (negative) {
      result = -result
    }

    // Return result in AX and pointer in BX
    this.cpu.setRegByName('AX', result & 0xFFFF)
    this.cpu.setRegByName('BX', strAddr & 0xFFFF)
  }

  // SYSCALL 8: SBRK (memory allocation)
  // Input: AX = number of bytes to allocate
  // Output: AX = address of allocated memory (old BK value)
  sysSbrk() {
    const size = this.cpu.registers.AX
    const oldBK = this.cpu.registers.BK

    // Move break pointer forward
    this.cpu.setRegByName('BK', (oldBK + size) & 0xFFFF)

    // Return old break (start of allocated region)
    this.cpu.setRegByName('AX', oldBK)
  }

  // ============================================================================
  // Display Syscalls
  // ============================================================================

  // SYSCALL 10: SET_COLOR
  // Input: AX = color (0-3)
  sysSetColor() {
    if (!this.display) {
      this.print('[Display not available]')
      return
    }
    const color = this.cpu.registers.AX & 0x03
    this.display.setColor(color)
  }

  // SYSCALL 11: DRAW_PIXEL
  // Input: AX = x, BX = y
  sysDrawPixel() {
    if (!this.display) return
    const x = this.cpu.registers.AX & 0xFFFF
    const y = this.cpu.registers.BX & 0xFFFF
    this.display.drawPixel(x, y)
  }

  // SYSCALL 12: DRAW_LINE
  // Input: AX = x1, BX = y1, CX = x2, DX = y2
  sysDrawLine() {
    if (!this.display) return
    const x1 = this.cpu.registers.AX & 0xFFFF
    const y1 = this.cpu.registers.BX & 0xFFFF
    const x2 = this.cpu.registers.CX & 0xFFFF
    const y2 = this.cpu.registers.DX & 0xFFFF
    this.display.drawLine(x1, y1, x2, y2)
  }

  // SYSCALL 13: DRAW_RECT
  // Input: AX = x, BX = y, CX = width, DX = height, EX = filled (0 = outline, non-zero = filled)
  sysDrawRect() {
    if (!this.display) return
    const x = this.cpu.registers.AX & 0xFFFF
    const y = this.cpu.registers.BX & 0xFFFF
    const width = this.cpu.registers.CX & 0xFFFF
    const height = this.cpu.registers.DX & 0xFFFF
    // If EX is 0, draw outline. If non-zero (including uninitialized), draw filled
    // Since most code won't set EX, we interpret 0 as "outline" and anything else as "filled"
    const filled = this.cpu.registers.EX === 0 ? false : true

    this.display.drawRect(x, y, width, height, filled)
  }

  // SYSCALL 14: DRAW_CIRCLE
  // Input: AX = cx, BX = cy, CX = radius
  // DX = filled (0 or 1)
  sysDrawCircle() {
    if (!this.display) return
    const cx = this.cpu.registers.AX & 0xFFFF
    const cy = this.cpu.registers.BX & 0xFFFF
    const radius = this.cpu.registers.CX & 0xFFFF
    const filled = (this.cpu.registers.DX & 0xFFFF) !== 0
    this.display.drawCircle(cx, cy, radius, filled)
  }

  // SYSCALL 15: CLEAR_SCREEN
  // No input
  sysClearScreen() {
    if (!this.display) return
    this.display.clear()
  }

  // SYSCALL 17: PAINT_DISPLAY
  // No input - paint/refresh display from VRAM
  sysRefresh() {
    if (!this.display) return
    this.display.refresh()
  }

  // SYSCALL 18: SLEEP
  // Input: AX = milliseconds to sleep
  sysSleep() {
    const ms = this.cpu.registers.AX & 0xFFFF
    // JavaScript sleep using setTimeout (async, but we'll simulate synchronously for simplicity)
    // Note: In browser/Node.js, this is tricky without async/await
    // For now, we'll just add a busy wait for compatibility
    const start = Date.now()
    while (Date.now() - start < ms) {
      // Busy wait
    }
  }

  // SYSCALL 19: READ_FILE
  // Input: AX = pointer to filename string, BX = pointer to buffer, CX = max characters
  // Output: AX = bytes read, or -1 on error
  sysReadFile() {
    try {
      // Read filename from memory
      let filenameAddr = this.cpu.registers.AX
      let filename = ''
      while (true) {
        const ch = this.memory.readByte(filenameAddr)
        if (ch === 0) break
        filename += String.fromCharCode(ch)
        filenameAddr++
      }

      // Use the filesystem synchronously
      let fileContent = ''

      if (this.filesystem) {
        // Use the virtual filesystem (synchronous from cache)
        fileContent = this.filesystem.readFileSync('/' + filename)
      } else {
        // No filesystem available
        this.cpu.setRegByName('AX', 0xFFFF) // -1
        return
      }

      // Limit to max characters
      const maxChars = this.cpu.registers.CX & 0xFFFF
      if (maxChars > 0 && fileContent.length > maxChars) {
        fileContent = fileContent.substring(0, maxChars)
      }

      // Write to buffer
      const bufferAddr = this.cpu.registers.BX
      for (let i = 0; i < fileContent.length; i++) {
        this.memory.writeByte((bufferAddr + i) & 0xFFFF, fileContent.charCodeAt(i))
      }
      // Null terminator
      this.memory.writeByte((bufferAddr + fileContent.length) & 0xFFFF, 0)

      // Return bytes read
      this.cpu.setRegByName('AX', fileContent.length & 0xFFFF)

    } catch (e) {
      // On error, return -1
      this.cpu.setRegByName('AX', 0xFFFF)
    }
  }

  // SYSCALL 20: MALLOC (optional - not implemented)
  // Input: AX = size in bytes
  // Output: AX = -1 (not supported)
  sysMalloc() {
    this.cpu.setRegByName('AX', 0xFFFF) // -1
  }

  // SYSCALL 21: FREE (optional - not implemented)
  // Input: AX = pointer to free
  // Output: None
  sysFree() {
    // No-op - MALLOC not supported, so FREE is also not supported
  }
}
