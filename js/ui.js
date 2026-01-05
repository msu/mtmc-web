// MTMC-16 UI Manager
// Handles all UI updates, blinkenlights, and user interaction

import { CPU, Memory, decodeFromBytes, Opcode } from './emulator.js'
import { assemble } from './assembler.js'
import { FileSystem } from './filesystem.js'
import { OS } from './os.js'
import { Display } from './display.js'
import { initializeMonaco, getEditor, setExecutionLine, clearExecutionLine, getBreakpoints, setBreakpointChangeCallback } from './monaco-setup.js'

// ============================================================================
// State
// ============================================================================

let cpu = null
let memory = null
let os = null
let fs = null
let display = null
let running = false
let speed = 1000 // Hz
let debugInfo = null  // Debug information from binary (lineMap, symbols)
let debugMode = false  // Debug mode toggle

// Backward stepping support
let undoHistory = []
const MAX_HISTORY = 100
let breakpointPCMap = null  // Runtime PC-to-breakpoint map (lazily initialized)

// Terminal state
let commandHistory = []
let commandHistoryIndex = -1
let currentCommand = ''

// ============================================================================
// Blinkenlights LED Generation
// ============================================================================

function createLEDs(value) {
  let html = ''
  for (let i = 15; i >= 0; i--) {
    const bit = (value >> i) & 1
    const className = bit ? 'blinken on' : 'blinken off'
    const space = (i === 12 || i === 8 || i === 4) ? ' space' : ''
    html += `<span class="${className}${space}"></span>`
  }
  return html
}

function updateRegisterLEDs(regName, value) {
  const ledsEl = document.getElementById(`${regName.toLowerCase()}-leds`)
  const valueEl = document.getElementById(`${regName.toLowerCase()}-value`)
  const decEl = document.getElementById(`${regName.toLowerCase()}-dec`)
  const strEl = document.getElementById(`${regName.toLowerCase()}-str`)

  if (ledsEl) {
    ledsEl.innerHTML = createLEDs(value)
  }
  if (valueEl) {
    // Special handling for IR - show full disassembled instruction
    if (regName.toLowerCase() === 'ir') {
      try {
        // IR contains first word (opcode + param)
        const byte0 = (value >> 8) & 0xFF
        const byte1 = value & 0xFF
        const byte2 = (cpu.registers.DR >> 8) & 0xFF
        const byte3 = cpu.registers.DR & 0xFF
        const bytes = [byte0, byte1, byte2, byte3]
        const instr = decodeFromBytes(bytes)

        // Use the full disassembler from memory display
        const fullInstruction = disassembleInstruction(cpu.registers.PC)
        valueEl.textContent = fullInstruction
        valueEl.title = 'Next instruction to execute'
      } catch (e) {
        valueEl.textContent = '0x' + value.toString(16).padStart(4, '0').toUpperCase()
      }
    } else if (regName.toLowerCase() === 'dr') {
      // Special handling for DR - show what data it contains
      try {
        const byte0 = (cpu.registers.IR >> 8) & 0xFF
        const byte1 = cpu.registers.IR & 0xFF
        const byte2 = (value >> 8) & 0xFF
        const byte3 = value & 0xFF
        const bytes = [byte0, byte1, byte2, byte3]
        const instr = decodeFromBytes(bytes)

        if (instr.size === 2) {
          valueEl.textContent = '(unused)'
          valueEl.title = 'Not used by 2-byte instruction'
        } else {
          // Show what the DR contains based on instruction type
          let description = '0x' + value.toString(16).padStart(4, '0').toUpperCase()
          if (instr.imm !== undefined) {
            description = '0x' + instr.imm.toString(16).toUpperCase() + ' (' + instr.imm + ')'
            valueEl.title = 'Immediate value'
          } else if (instr.addr !== undefined) {
            description = '0x' + instr.addr.toString(16).padStart(4, '0').toUpperCase()
            valueEl.title = 'Memory address'
          } else if (instr.offset !== undefined) {
            description = (instr.offset >= 0 ? '+' : '') + instr.offset
            valueEl.title = 'Register offset'
          } else {
            valueEl.title = 'Operand data'
          }
          valueEl.textContent = description
        }
      } catch (e) {
        valueEl.textContent = '0x' + value.toString(16).padStart(4, '0').toUpperCase()
      }
    } else {
      valueEl.textContent = '0x' + value.toString(16).padStart(4, '0').toUpperCase()
    }
  }

  // Update DEC and STR columns (only for registers AX-CB, not IR/DR)
  if (decEl) {
    decEl.textContent = value.toString(10)
  }
  if (strEl) {
    // Display as two characters (high byte, low byte) using Windows-1252 encoding
    const highByte = (value >> 8) & 0xFF
    const lowByte = value & 0xFF

    // Helper to convert byte to displayable character (Windows-1252)
    const byteToChar = (byte) => {
      // Standard ASCII printable characters (32-126)
      if (byte >= 32 && byte <= 126) {
        return String.fromCharCode(byte)
      }
      // Extended ASCII / Windows-1252 (128-255)
      // Skip undefined/control characters in the 128-159 range
      else if (byte >= 160 && byte <= 255) {
        return String.fromCharCode(byte)
      }
      // Some Windows-1252 printable characters in 128-159 range
      else if (byte >= 128 && byte <= 159) {
        // Windows-1252 specific mappings for this range
        const win1252 = {
          128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡',
          136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž',
          145: "'", 146: "'", 147: '"', 148: '"', 149: '•', 150: '–', 151: '—',
          152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ'
        }
        return win1252[byte] || '·'
      }
      // Non-printable control characters
      else {
        return '·'
      }
    }

    const highChar = byteToChar(highByte)
    const lowChar = byteToChar(lowByte)
    strEl.textContent = highChar + lowChar
  }
}

function updateFlags() {
  const flags = cpu.registers.getFlags()

  document.getElementById('flag-zf').className = flags.ZF ? 'blinken on' : 'blinken off'
  document.getElementById('flag-sf').className = flags.SF ? 'blinken on' : 'blinken off'
  document.getElementById('flag-cf').className = flags.CF ? 'blinken on' : 'blinken off'
  document.getElementById('flag-of').className = flags.OF ? 'blinken on' : 'blinken off'
}

// ============================================================================
// Register Display
// ============================================================================

function updateRegisters() {
  updateRegisterLEDs('ax', cpu.registers.AX)
  updateRegisterLEDs('bx', cpu.registers.BX)
  updateRegisterLEDs('cx', cpu.registers.CX)
  updateRegisterLEDs('dx', cpu.registers.DX)
  updateRegisterLEDs('ex', cpu.registers.EX)
  updateRegisterLEDs('fx', cpu.registers.FX)
  updateRegisterLEDs('sp', cpu.registers.SP)
  updateRegisterLEDs('fp', cpu.registers.FP)
  updateRegisterLEDs('bk', cpu.registers.BK)
  updateRegisterLEDs('pc', cpu.registers.PC)
  updateRegisterLEDs('cb', cpu.registers.CB)
  updateRegisterLEDs('ir', cpu.registers.IR)
  updateRegisterLEDs('dr', cpu.registers.DR)
  updateFlags()
  setupRegisterHoverHighlight()
}

// Setup hover highlighting for register values
function setupRegisterHoverHighlight() {
  const registerNames = ['ax', 'bx', 'cx', 'dx', 'ex', 'fx', 'sp', 'fp', 'bk', 'pc', 'cb', 'ir', 'dr']

  registerNames.forEach(regName => {
    const valueEl = document.getElementById(`${regName}-value`)
    if (!valueEl) return

    // Remove old listeners by cloning
    const newValueEl = valueEl.cloneNode(true)
    valueEl.parentNode.replaceChild(newValueEl, valueEl)

    newValueEl.addEventListener('mouseenter', () => {
      let address = null

      if (regName === 'ir') {
        // IR shows instruction at PC
        address = cpu.registers.PC
      } else if (regName === 'dr') {
        // DR might contain an address - decode to check
        try {
          const byte0 = (cpu.registers.IR >> 8) & 0xFF
          const byte1 = cpu.registers.IR & 0xFF
          const byte2 = (cpu.registers.DR >> 8) & 0xFF
          const byte3 = cpu.registers.DR & 0xFF
          const bytes = [byte0, byte1, byte2, byte3]
          const instr = decodeFromBytes(bytes)

          // Only highlight if DR contains a direct memory address
          if (instr.addr !== undefined) {
            address = instr.addr
          }
        } catch (e) {
          // Ignore errors
        }
      } else {
        address = cpu.registers[regName.toUpperCase()]
      }

      if (address !== null) {
        highlightMemoryCell(address)
      }
    })

    newValueEl.addEventListener('mouseleave', () => {
      clearMemoryCellHighlight()
    })

    // Add click handler to scroll to memory address
    newValueEl.addEventListener('click', (e) => {
      e.preventDefault()
      let address = null

      if (regName === 'ir') {
        address = cpu.registers.PC
      } else if (regName === 'dr') {
        // Get address from DR if it contains one
        try {
          const byte0 = (cpu.registers.IR >> 8) & 0xFF
          const byte1 = cpu.registers.IR & 0xFF
          const byte2 = (cpu.registers.DR >> 8) & 0xFF
          const byte3 = cpu.registers.DR & 0xFF
          const bytes = [byte0, byte1, byte2, byte3]
          const instr = decodeFromBytes(bytes)
          if (instr.addr !== undefined) {
            address = instr.addr
          }
        } catch (e) {
          // Ignore errors
        }
      } else {
        address = cpu.registers[regName.toUpperCase()]
      }

      if (address !== null) {
        console.log(`Clicked register ${regName.toUpperCase()}, value: 0x${address.toString(16)}, scrolling to address ${address}`)
        updateUI(address)
      }
    })

    // Make it look hoverable and clickable
    newValueEl.style.cursor = 'pointer'
  })
}

function highlightMemoryCell(address) {
  // Clear any existing highlights first
  clearMemoryCellHighlight()

  // Find and highlight the cell at this address
  const cells = document.querySelectorAll('.mem-cell')
  cells.forEach(cell => {
    const cellAddr = parseInt(cell.getAttribute('data-addr'))
    if (cellAddr === address) {
      cell.classList.add('mem-hover-highlight')
    }
  })
}

function clearMemoryCellHighlight() {
  const highlighted = document.querySelectorAll('.mem-hover-highlight')
  highlighted.forEach(cell => {
    cell.classList.remove('mem-hover-highlight')
  })
}

// ============================================================================
// Memory Viewer
// ============================================================================

let memoryDisplayMode = 'dyn'  // dyn, hex, dec, ins, str

// Classify memory address
function classifyMemoryAddress(addr) {
  // Reserved area (0x00-0x1F) - not accessible
  if (addr < 0x20) {
    return ''
  }

  if (addr >= cpu.registers.SP) {
    return 'sta'  // Stack
  } else if (addr === cpu.registers.PC) {
    return 'curr'  // Current instruction
  } else if (addr >= 0x20 && addr < cpu.registers.CB) {
    return 'code'  // Code segment (0x20 to CB)
  } else if (addr < cpu.registers.BK) {
    return 'data'  // Data segment (CB to BK)
  } else {
    return 'heap'  // Heap segment (BK+)
  }
}

// Get display format for an address
function getDisplayFormat(memClass) {
  if (memoryDisplayMode === 'dyn') {
    switch (memClass) {
      case 'sta': return 'dec'
      case 'code':
      case 'curr': return 'ins'
      case 'data':
      case 'heap': return 'str'
      default: return 'hex'
    }
  } else {
    return memoryDisplayMode
  }
}

// Disassemble instruction at address
function disassembleInstruction(addr) {
  try {
    const bytes = []
    for (let i = 0; i < 4; i++) {
      if (addr + i < memory.size) {
        bytes.push(memory.readByte(addr + i))
      } else {
        bytes.push(0)
      }
    }

    const instr = decodeFromBytes(bytes)
    const opcode = instr.opcode

    // Helper to format register
    const reg = (code) => getRegisterName(code)

    // Helper to format immediate as hex (compact - no 0x prefix)
    const hex = (value) => value.toString(16).toUpperCase()

    // Helper to format address (compact - no 0x prefix)
    const addr16 = (value) => value.toString(16).padStart(4, '0').toUpperCase()

    // Helper to format offset (signed)
    const off = (value) => value >= 0 ? '+' + value : value.toString()

    // 2-byte instructions
    if (opcode === Opcode.NOP) return 'NOP'
    if (opcode === Opcode.HLT) return 'HALT'
    if (opcode === Opcode.RET) return 'RET'

    if (opcode === Opcode.PUSH) return `PUSH ${reg(instr.reg)}`
    if (opcode === Opcode.POP) return `POP ${reg(instr.reg)}`
    if (opcode === Opcode.INC_REG) return `INC ${reg(instr.reg)}`
    if (opcode === Opcode.DEC_REG) return `DEC ${reg(instr.reg)}`
    if (opcode === Opcode.MUL) return `MUL ${reg(instr.reg)}`
    if (opcode === Opcode.DIV) return `DIV ${reg(instr.reg)}`
    if (opcode === Opcode.NOT) return `NOT ${reg(instr.reg)}`
    if (opcode === Opcode.SYSCALL) return `SYSCALL ${instr.syscall}`

    // 4-byte register-register (compact format - no space after comma)
    if (opcode === Opcode.MOV_REG_REG) return `MOV ${reg(instr.dst)},${reg(instr.src)}`
    if (opcode === Opcode.ADD_REG_REG) return `ADD ${reg(instr.dst)},${reg(instr.src)}`
    if (opcode === Opcode.SUB_REG_REG) return `SUB ${reg(instr.dst)},${reg(instr.src)}`
    if (opcode === Opcode.AND_REG_REG) return `AND ${reg(instr.dst)},${reg(instr.src)}`
    if (opcode === Opcode.OR_REG_REG) return `OR ${reg(instr.dst)},${reg(instr.src)}`
    if (opcode === Opcode.XOR_REG_REG) return `XOR ${reg(instr.dst)},${reg(instr.src)}`
    if (opcode === Opcode.CMP_REG_REG) return `CMP ${reg(instr.dst)},${reg(instr.src)}`

    // 4-byte register-immediate (compact format)
    if (opcode === Opcode.MOV_REG_IMM) return `MOV ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.ADD_REG_IMM) return `ADD ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.SUB_REG_IMM) return `SUB ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.AND_REG_IMM) return `AND ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.OR_REG_IMM) return `OR ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.XOR_REG_IMM) return `XOR ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.CMP_REG_IMM) return `CMP ${reg(instr.dst)},${hex(instr.imm)}`
    if (opcode === Opcode.SHL) return `SHL ${reg(instr.dst)},${instr.imm}`
    if (opcode === Opcode.SHR) return `SHR ${reg(instr.dst)},${instr.imm}`

    // 4-byte memory operations (direct addressing) - compact
    if (opcode === Opcode.LOAD) return `MOV ${reg(instr.reg)},[${addr16(instr.addr)}]`
    if (opcode === Opcode.STORE) return `MOV [${addr16(instr.addr)}],${reg(instr.src)}`
    if (opcode === Opcode.LOADB) return `MOV ${reg(instr.reg)}L,[${addr16(instr.addr)}]`
    if (opcode === Opcode.STOREB) return `MOV [${addr16(instr.addr)}],${reg(instr.src)}L`
    if (opcode === Opcode.ADD_MEM) return `ADD ${reg(instr.reg)},[${addr16(instr.addr)}]`
    if (opcode === Opcode.SUB_MEM) return `SUB ${reg(instr.reg)},[${addr16(instr.addr)}]`
    if (opcode === Opcode.CMP_MEM) return `CMP ${reg(instr.reg)},[${addr16(instr.addr)}]`
    if (opcode === Opcode.INC_MEM) return `INC [${addr16(instr.addr)}]`
    if (opcode === Opcode.DEC_MEM) return `DEC [${addr16(instr.addr)}]`

    // 4-byte register-relative operations - compact
    if (opcode === Opcode.LOADR) return `MOV ${reg(instr.reg)},[${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.STORER) return `MOV [${reg(instr.base)}${off(instr.offset)}],${reg(instr.src)}`
    if (opcode === Opcode.LOADBR) return `MOV ${reg(instr.reg)}L,[${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.STOREBR) return `MOV [${reg(instr.base)}${off(instr.offset)}],${reg(instr.src)}L`
    if (opcode === Opcode.LEA) return `LEA ${reg(instr.reg)},[${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.ADD_MEMR) return `ADD ${reg(instr.reg)},[${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.SUB_MEMR) return `SUB ${reg(instr.reg)},[${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.CMP_MEMR) return `CMP ${reg(instr.reg)},[${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.INC_MEMR) return `INC [${reg(instr.base)}${off(instr.offset)}]`
    if (opcode === Opcode.DEC_MEMR) return `DEC [${reg(instr.base)}${off(instr.offset)}]`

    // Special store operations - compact
    if (opcode === Opcode.STOREI) return `MOV [${reg(instr.base)}],${hex(instr.imm)}`
    if (opcode === Opcode.STOREI_DIRECT) return `MOV [${addr16(instr.addr)}],${hex(instr.imm)}`

    // Jump/Call instructions
    if (opcode === Opcode.JMP) return `JMP ${addr16(instr.addr)}`
    if (opcode === Opcode.JE) return `JE ${addr16(instr.addr)}`
    if (opcode === Opcode.JNE) return `JNE ${addr16(instr.addr)}`
    if (opcode === Opcode.JL) return `JL ${addr16(instr.addr)}`
    if (opcode === Opcode.JG) return `JG ${addr16(instr.addr)}`
    if (opcode === Opcode.JLE) return `JLE ${addr16(instr.addr)}`
    if (opcode === Opcode.JGE) return `JGE ${addr16(instr.addr)}`
    if (opcode === Opcode.CALL) return `CALL ${addr16(instr.addr)}`

    // Unknown instruction - show as hex bytes
    return bytes.slice(0, instr.size).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  } catch (e) {
    return '????'
  }
}

// Get opcode name
function getOpcodeName(opcode) {
  const names = {
    0x00: 'NOP', 0x01: 'HLT',
    0x10: 'MOV', 0x11: 'MOV', 0x12: 'LOAD', 0x13: 'STORE',
    0x20: 'ADD', 0x21: 'ADD', 0x22: 'SUB', 0x23: 'SUB',
    0x24: 'INC', 0x25: 'DEC', 0x26: 'MUL', 0x27: 'DIV',
    0x30: 'AND', 0x31: 'AND', 0x32: 'OR', 0x33: 'OR',
    0x34: 'XOR', 0x35: 'XOR', 0x36: 'NOT', 0x37: 'SHL',
    0x38: 'SHR',
    0x40: 'CMP', 0x41: 'CMP',
    0x50: 'JMP', 0x51: 'JE', 0x52: 'JNE', 0x53: 'JL',
    0x54: 'JG', 0x55: 'JLE', 0x56: 'JGE',
    0x60: 'PUSH', 0x61: 'POP',
    0x70: 'CALL', 0x71: 'RET',
    0x90: 'SYSCALL'
  }
  return names[opcode]
}

// Get register name
function getRegisterName(regCode) {
  const names = ['AX', 'BX', 'CX', 'DX', 'EX', 'FX', 'SP', 'FP']
  return names[regCode] || '??'
}

// Format value for display
function formatValue(format, byte, prevByte, addr, isDynIns = false) {
  switch (format) {
    case 'hex':
      return byte.toString(16).padStart(2, '0').toUpperCase()
    case 'dec':
      return byte.toString(10)
    case 'str':
      // Special control characters
      if (byte === 0) {
        return 'NUL'
      } else if (byte === 9) {
        return '\\t'
      } else if (byte === 10) {
        return '\\n'
      } else if (byte === 13) {
        return '\\r'
      }
      // Standard ASCII printable characters (32-126)
      else if (byte >= 32 && byte <= 126) {
        return String.fromCharCode(byte)
      }
      // Extended ASCII / Windows-1252 (160-255)
      else if (byte >= 160 && byte <= 255) {
        return String.fromCharCode(byte)
      }
      // Windows-1252 printable characters in 128-159 range
      else if (byte >= 128 && byte <= 159) {
        const win1252 = {
          128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡',
          136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž',
          145: "'", 146: "'", 147: '"', 148: '"', 149: '•', 150: '–', 151: '—',
          152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ'
        }
        return win1252[byte] || '·'
      }
      // Non-printable control characters
      else {
        return '·'
      }
    case 'ins': {
      // Always show disassembled instruction in ins mode
      return disassembleInstruction(addr)
    }
    default:
      return byte.toString(16).padStart(2, '0')
  }
}

// Get CSS class for memory classification
function getMemoryClass(memClass) {
  switch (memClass) {
    case 'sta': return 'mem-stack'
    case 'curr': return 'mem-current'
    case 'code': return 'mem-code'
    case 'data': return 'mem-data'
    case 'heap': return 'mem-heap'
    default: return ''
  }
}

function updateMemoryView(scrollToAddr = null) {
  const memView = document.getElementById('memory-view')
  let html = '<table style="width: 100%; font-size: 11px; border-collapse: collapse; font-family: monospace; table-layout: fixed;">'

  let i = 0
  let consumedUntil = 0  // Track bytes consumed by previous instructions crossing boundaries

  while (i < memory.size) {
    const rowStart = Math.floor(i / 16) * 16
    const rowEnd = rowStart + 16

    // Start new row at 16-byte boundaries
    if (i % 16 === 0) {
      if (i > 0) html += '</tr>'
      html += '<tr>'
    }

    // If this byte was already consumed by a previous instruction that crossed row boundary
    if (i < consumedUntil && i % 16 !== 0) {
      // Show "cont." marker
      const cellStyle = 'padding: 1px; text-align: center; white-space: nowrap; font-style: italic; color: #888;'
      html += `<td class="mem-cell" style="${cellStyle}" title="Continuation from previous row">cont.</td>`
      i++
      continue
    }

    const memClass = classifyMemoryAddress(i)
    const format = getDisplayFormat(memClass)
    const cssClass = getMemoryClass(memClass)
    const byte = memory.readByte(i)
    const prevByte = i > 0 ? memory.readByte(i - 1) : 0

    // Base cell style
    let cellStyle = 'padding: 1px; text-align: center; white-space: nowrap;'

    // Bold cells at PC, BK, or SP
    if (i === cpu.registers.PC || i === cpu.registers.BK || i === cpu.registers.SP) {
      cellStyle += ' font-weight: bold; border: 2px solid black;'
    }

    let displayValue = ''
    let colspan = 1
    let isInstruction = false
    let actualBytesConsumed = 1
    const isDynIns = memoryDisplayMode === 'dyn' && format === 'ins'

    // For 'ins' format in dyn mode, show full instruction (may span 2 or 4 bytes)
    if (isDynIns && i % 2 === 0) {
      displayValue = disassembleInstruction(i)
      // Replace spaces with non-breaking spaces to prevent wrapping
      displayValue = displayValue.replace(/ /g, '&nbsp;')
      // Instructions are at least 2 bytes, check if it's a 4-byte instruction
      const bytes = []
      for (let j = 0; j < 4; j++) {
        bytes.push(memory.readByte(i + j))
      }
      const instr = decodeFromBytes(bytes)
      actualBytesConsumed = instr.size

      // Limit colspan to not exceed current row boundary
      const bytesRemainingInRow = rowEnd - i
      colspan = Math.min(actualBytesConsumed, bytesRemainingInRow)
      if (colspan < 1) colspan = 1

      isInstruction = true
    }
    // For 'ins' and 'dec' modes (not dyn), show words (2 bytes)
    else if ((format === 'ins' || format === 'dec') && i % 2 === 0 && i + 1 < memory.size) {
      colspan = 2
      const nextByte = memory.readByte(i + 1)
      const word = (byte << 8) | nextByte
      if (format === 'dec') {
        displayValue = word.toString(10)
      } else {
        displayValue = formatValue(format, byte, prevByte, i, false)
      }
    } else if (!isDynIns || i % 2 !== 0) {
      displayValue = formatValue(format, byte, prevByte, i, isDynIns)
    }

    // Skip rendering if this is an odd byte in a word-based format
    if ((format === 'ins' || format === 'dec') && i % 2 === 1 && !isDynIns) {
      i++
      continue
    }

    const rowId = scrollToAddr !== null && i === scrollToAddr ? ` id="mem-addr-${i}"` : ''

    // Create tooltip - show address and full instruction if it's an instruction
    let tooltip = `Address: 0x${i.toString(16).padStart(4, '0').toUpperCase()} (${i})`
    if (isInstruction) {
      tooltip += `\nInstruction: ${displayValue.replace(/&nbsp;/g, ' ')}`
    }

    // Add overflow handling
    if (isInstruction) {
      // Instructions: allow them to take space needed, with reasonable limit
      cellStyle += ' min-width: 70px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
    } else if (colspan === 1) {
      // Single byte cells
      cellStyle += ' overflow: hidden; text-overflow: ellipsis;'
    } else {
      // Multi-byte non-instruction cells
      cellStyle += ' overflow: hidden; text-overflow: ellipsis;'
    }

    html += `<td${rowId} class="${cssClass} mem-cell" style="${cellStyle}"` +
            ` data-addr="${i}"` +
            (colspan > 1 ? ` colspan="${colspan}"` : '') +
            ` title="${tooltip}">${displayValue}</td>`

    // Increment by the number of bytes consumed
    const bytesToConsume = colspan
    const nextAddr = i + bytesToConsume

    // Check if this instruction crosses a row boundary
    if (Math.floor(i / 16) !== Math.floor((nextAddr - 1) / 16)) {
      // Instruction crosses boundary - remember where it ends
      consumedUntil = nextAddr
    }

    i += bytesToConsume
  }

  // Close final row
  html += '</tr></table>'
  memView.innerHTML = html

  // Scroll to the specified address if provided
  if (scrollToAddr !== null) {
    console.log(`Scrolling to address: ${scrollToAddr} (0x${scrollToAddr.toString(16)})`)
    const element = document.getElementById(`mem-addr-${scrollToAddr}`)
    console.log(`Element with id 'mem-addr-${scrollToAddr}':`, element)
    if (element) {
      console.log('Found element, scrolling...')
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      // If exact address not found, scroll to nearest even address (for word-aligned views)
      const nearestEven = scrollToAddr & ~1
      console.log(`Exact address not found, trying nearest even: ${nearestEven} (0x${nearestEven.toString(16)})`)
      const fallbackElement = document.getElementById(`mem-addr-${nearestEven}`)
      console.log(`Fallback element:`, fallbackElement)
      if (fallbackElement) {
        console.log('Found fallback element, scrolling...')
        fallbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        console.log('No element found to scroll to!')
      }
    }
  }
}

function toggleMemoryDisplayMode() {
  const modes = ['dyn', 'hex', 'dec', 'ins', 'str']
  const currentIndex = modes.indexOf(memoryDisplayMode)
  const nextIndex = (currentIndex + 1) % modes.length
  memoryDisplayMode = modes[nextIndex]

  // Update button text
  document.getElementById('memory-mode-btn').textContent = memoryDisplayMode.toUpperCase()

  updateMemoryView()
}

function toggleConsoleFullscreen() {
  const main = document.querySelector('main')
  const btn = document.getElementById('btn-expand-console')

  if (main.classList.contains('console-fullscreen')) {
    main.classList.remove('console-fullscreen')
    btn.innerHTML = '&#x2921;'
    btn.title = 'Expand'
  } else {
    main.classList.remove('fs-fullscreen')
    main.classList.add('console-fullscreen')
    btn.innerHTML = '&#x2922;'
    btn.title = 'Collapse'

    // Update fs expand button
    const fsBtn = document.getElementById('btn-expand-fs')
    if (fsBtn) {
      fsBtn.innerHTML = '&#x2921;'
      fsBtn.title = 'Expand'
    }
  }
}

function toggleFsFullscreen() {
  const main = document.querySelector('main')
  const btn = document.getElementById('btn-expand-fs')

  if (main.classList.contains('fs-fullscreen')) {
    main.classList.remove('fs-fullscreen')
    btn.innerHTML = '&#x2921;'
    btn.title = 'Expand'
  } else {
    main.classList.remove('console-fullscreen')
    main.classList.add('fs-fullscreen')
    btn.innerHTML = '&#x2922;'
    btn.title = 'Collapse'

    // Update console expand button
    const consoleBtn = document.getElementById('btn-expand-console')
    if (consoleBtn) {
      consoleBtn.innerHTML = '&#x2921;'
      consoleBtn.title = 'Expand'
    }
  }
}

// ============================================================================
// Console
// ============================================================================

const consoleHistory = []

function consolePrint(text) {
  const historyEl = document.getElementById('console-history')
  const div = document.createElement('div')
  div.textContent = text
  historyEl.appendChild(div)

  // Auto-scroll to bottom
  const consoleEl = document.getElementById('console')
  consoleEl.scrollTop = consoleEl.scrollHeight
}

function consoleClear() {
  document.getElementById('console-history').innerHTML = ''
}

async function handleConsoleInput(inputText) {
  if (!inputText.trim()) return

  // Save to history (only if different from last command)
  if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== inputText) {
    commandHistory.push(inputText)
  }
  commandHistoryIndex = commandHistory.length
  currentCommand = ''

  // Echo the input
  consolePrint(`> ${inputText}`)

  // Parse command
  const parts = inputText.trim().split(/\s+/)
  const cmd = parts[0].toLowerCase()

  // Check if this is a shell command
  const commands = {
    'pwd': cmdPwd,
    'cd': cmdCd,
    'ls': cmdLs,
    'mkdir': cmdMkdir,
    'rm': cmdRm,
    'cat': cmdCat,
    'open': cmdOpen,
    'compile': cmdCompile,
    'asm': cmdAsm,
    'load': cmdLoad,
    'set': cmdSet,
    'help': cmdHelp,
    'clear': cmdClear,
    'reset': cmdReset,
    'debug': cmdDebug,
  }

  if (commands[cmd]) {
    try {
      await commands[cmd](parts.slice(1))
    } catch (err) {
      consolePrint(`[Error: ${err.message}]`)
    }
    return
  }

  // Check if this is an executable path (contains / or starts with ./ or ../)
  if (cmd.includes('/') || cmd.startsWith('./') || cmd.startsWith('../')) {
    try {
      let executablePath = cmd

      // Try with .exe extension if not already present
      if (!executablePath.endsWith('.exe')) {
        const withExe = executablePath + '.exe'
        const exists = await fs.exists(withExe)
        if (exists) {
          executablePath = withExe
        }
      }

      // Check if file exists
      const exists = await fs.exists(executablePath)
      if (exists) {
        const programArgs = parts.slice(1)
        try {
          await cmdLoad([executablePath, ...programArgs])

          // Start execution automatically
          if (!running) {
            handleRun()
          }
          return
        } catch (loadErr) {
          consolePrint(`[Error running ${executablePath}: ${loadErr.message}]`)
          return
        }
      } else {
        consolePrint(`[Error: File not found: ${executablePath}]`)
        return
      }
    } catch (err) {
      consolePrint(`[Error: ${err.message}]`)
      return
    }
  }

  // Check if this is an executable in /bin
  // Try with .exe extension first
  let executablePath = `/bin/${cmd}.exe`
  try {
    let exists = await fs.exists(executablePath)
    if (!exists) {
      // Try without .exe extension
      executablePath = `/bin/${cmd}`
      exists = await fs.exists(executablePath)
    }
    if (exists) {
      // Load and run the program with arguments
      const programArgs = parts.slice(1)
      try {
        await cmdLoad([executablePath, ...programArgs])

        // Start execution automatically
        if (!running) {
          handleRun()
        }
        return
      } catch (loadErr) {
        consolePrint(`[Error running ${cmd}: ${loadErr.message}]`)
        return
      }
    }
  } catch (err) {
    // File doesn't exist or error checking - continue to check for assembly
  }

  // Check if this is an assembly instruction
  const asmInstructions = [
    'MOV', 'MOVB', 'ADD', 'SUB', 'MUL', 'DIV', 'INC', 'DEC',
    'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR',
    'CMP', 'TEST',
    'JMP', 'JE', 'JNE', 'JZ', 'JNZ', 'JG', 'JGE', 'JL', 'JLE', 'JA', 'JAE', 'JB', 'JBE',
    'PUSH', 'POP', 'CALL', 'RET',
    'SYSCALL', 'NOP', 'HLT'
  ]

  if (!asmInstructions.includes(cmd.toUpperCase())) {
    consolePrint(`[Error: Unknown command: ${cmd}]`)
    return
  }

  // Treat as assembly instruction
  try {
    // Assemble the instruction - this creates a full program with headers
    const bytecode = assemble(inputText)

    // Instructions start at offset 0x20 (after signature and header)
    const instructionStart = 0x20
    const instructionBytes = Array.from(bytecode.slice(instructionStart, instructionStart + 4))

    // Decode the instruction
    const instr = decodeFromBytes(instructionBytes)

    // Save state before execution
    const savedPC = cpu.registers.PC
    const savedSP = cpu.registers.SP

    // Execute instruction (this will modify PC)
    cpu.executeInstruction(instr)

    // Restore PC
    cpu.registers.PC = savedPC

    // Prefetch next instruction for display
    cpu.prefetchInstruction()

    // Determine where to scroll based on what changed
    let scrollToAddr = null
    if (cpu.registers.SP !== savedSP) {
      // SP changed (PUSH/POP) - scroll to new SP location
      scrollToAddr = cpu.registers.SP
    }

    // Update UI to show register changes and scroll to changed memory
    updateUI(scrollToAddr)

    consolePrint('[OK]')
  } catch (err) {
    consolePrint(`[Error: ${err.message}]`)
  }
}

// ============================================================================
// Shell Commands
// ============================================================================

// Print working directory
function cmdPwd(args) {
  consolePrint(fs.pwd())
}

// Change directory
async function cmdCd(args) {
  if (args.length === 0) {
    // Go to root
    try {
      await fs.cd('/')
      consolePrint('/')
    } catch (err) {
      consolePrint(`cd: ${err.message}`)
    }
    return
  }

  const path = args.join(' ')

  try {
    await fs.cd(path)
    consolePrint(fs.pwd())
  } catch (err) {
    consolePrint(`cd: ${err.message}`)
  }
}

// List directory contents
async function cmdLs(args) {
  const path = args.length > 0 ? args.join(' ') : fs.pwd()

  try {
    const entries = await fs.readdir(path)

    if (entries.length === 0) {
      consolePrint('(empty directory)')
      return
    }

    for (const entry of entries) {
      const icon = entry.type === 'directory' ? '📁' : '📄'
      consolePrint(`${icon} ${entry.name}`)
    }
  } catch (err) {
    consolePrint(`ls: ${err.message}`)
  }
}

// Make directory
async function cmdMkdir(args) {
  if (args.length === 0) {
    consolePrint('Usage: mkdir <directory>')
    return
  }

  const path = args.join(' ')

  try {
    await fs.mkdir(path)
    consolePrint(`Created directory: ${path}`)
    await renderFileList()
  } catch (err) {
    consolePrint(`mkdir: ${err.message}`)
  }
}

// Remove file or directory
async function cmdRm(args) {
  if (args.length === 0) {
    consolePrint('Usage: rm <file|directory>')
    return
  }

  const path = args.join(' ')

  try {
    const stat = await fs.stat(path)

    if (!confirm(`Delete ${path}?`)) {
      consolePrint('Cancelled.')
      return
    }

    if (stat.type === 'directory') {
      await fs.rmdir(path)
    } else {
      await fs.deleteFile(path)
    }

    consolePrint(`Removed: ${path}`)
    await renderFileList()
  } catch (err) {
    consolePrint(`rm: ${err.message}`)
  }
}

// Display file contents
async function cmdCat(args) {
  if (args.length === 0) {
    consolePrint('Usage: cat <filename>')
    return
  }

  const filename = args.join(' ')

  try {
    const content = await fs.readFile(filename)
    consolePrint(content)
  } catch (err) {
    consolePrint(`cat: ${err.message}`)
  }
}

// Open file in editor
async function cmdOpen(args) {
  if (args.length === 0) {
    consolePrint('Usage: open <filename>')
    return
  }

  const filename = args.join(' ')

  try {
    await openFileInEditor(filename)
    consolePrint(`Opened ${filename}`)
  } catch (err) {
    consolePrint(`open: ${err.message}`)
  }
}

// Compile assembly file to binary
async function cmdCompile(args) {
  if (args.length === 0) {
    consolePrint('Usage: compile <source.asm> [output.x366]')
    consolePrint('Examples:')
    consolePrint('  compile /examples/hello.asm')
    consolePrint('  compile /examples/hello.asm /bin/hello.x366')
    return
  }

  const sourceFile = args[0]
  let outputFile = args[1]

  // If no output specified, generate one in /bin
  if (!outputFile) {
    const baseName = fs.basename(sourceFile).replace(/\.asm$/, '')
    outputFile = `/bin/${baseName}.x366`
  }

  try {
    // Read source
    const source = await fs.readFile(sourceFile)

    // Assemble to bytecode
    const bytecode = assemble(source)

    // Ensure /bin directory exists
    const binExists = await fs.exists('/bin')
    if (!binExists) {
      await fs.mkdir('/bin')
      expandedFolders.add('/bin')
    }

    // Save bytecode as binary file
    await fs.writeFile(outputFile, bytecode)

    consolePrint(`[Compiled ${sourceFile} -> ${outputFile}]`)
    consolePrint(`[Binary size: ${bytecode.length} bytes]`)

    await renderFileList()
  } catch (err) {
    consolePrint(`compile: ${err.message}`)
  }
}

// Assemble a file to binary
async function cmdAsm(args) {
  let sourceFile
  let outputFile = 'a.exe'

  if (args.length === 0) {
    // If we're in editor mode, assemble current file
    if (isInEditorMode && selectedFile) {
      sourceFile = selectedFile
    } else {
      consolePrint('Usage: asm <source.asm> [output]')
      consolePrint('  or open a file in editor and type "asm"')
      consolePrint('  Default output: a.exe')
      return
    }
  } else {
    sourceFile = args[0]
    if (args.length > 1) {
      outputFile = args[1]
      // Add .exe extension if no extension provided
      if (!outputFile.includes('.')) {
        outputFile += '.exe'
      }
    }
  }

  try {
    // Read source
    const source = await fs.readFile(sourceFile)

    // Assemble to bytecode
    const bytecode = assemble(source)

    // Write binary file
    await fs.writeFile(outputFile, bytecode)

    consolePrint(`[Assembled ${sourceFile} -> ${outputFile}]`)
    consolePrint(`[Binary size: ${bytecode.length} bytes]`)

    // Refresh file list if we're in the file system view
    await renderFileList()
  } catch (err) {
    consolePrint(`asm: ${err.message}`)
  }
}

// Load file into memory
async function cmdLoad(args) {
  if (args.length === 0) {
    consolePrint('Usage: load <filename> [arguments...]')
    consolePrint('Examples:')
    consolePrint('  load hello')
    consolePrint('  load /bin/hello')
    consolePrint('  load /examples/hello.asm')
    consolePrint('  load echo "arg1 arg2 arg3"')
    return
  }

  let filename = args[0]
  const programArgs = args.slice(1).join(' ')

  // Resolve executable name like the shell does
  // If filename doesn't contain a path separator, look in /bin
  if (!filename.includes('/')) {
    // Try /bin/<name>.exe first
    let testPath = `/bin/${filename}.exe`
    let exists = await fs.exists(testPath)

    if (!exists) {
      // Try /bin/<name> without .exe
      testPath = `/bin/${filename}`
      exists = await fs.exists(testPath)
    }

    if (exists) {
      filename = testPath
    }
    // If not found in /bin, try as-is (might be in current directory or fail later)
  } else {
    // Path contains /, try adding .exe if not already present
    if (!filename.endsWith('.exe') && !filename.endsWith('.asm')) {
      const withExe = filename + '.exe'
      const exists = await fs.exists(withExe)
      if (exists) {
        filename = withExe
      }
    }
  }

  try {
    const content = await fs.readFile(filename)
    let bytecode

    // Check if this is a binary file (.exe, .x366, or .bin)
    const isBinary = filename.match(/\.(exe|x366|bin)$/i)

    if (isBinary) {
      // Load binary directly
      bytecode = content instanceof ArrayBuffer ? new Uint8Array(content) : content
      if (debugMode) consolePrint(`[Loading binary ${filename}]`)
    } else {
      // Assemble source file
      bytecode = assemble(content)
      if (debugMode) consolePrint(`[Assembling and loading ${filename}]`)
    }

    const result = memory.loadBinary(bytecode)
    cpu.reset()

    // Set BK and CB from binary header
    cpu.registers.BK = result.breakPointer
    cpu.registers.CB = result.codeBase
    debugInfo = result.debugInfo

    // Update memory size dropdown if memory was resized
    const memorySelect = document.getElementById('memory-size-select')
    if (memorySelect && memorySelect.value != memory.size) {
      memorySelect.value = memory.size
    }

    // Update breakpoint PC map after loading program
    updateBreakpointPCMap()

    // If command line arguments provided, append them to memory
    if (programArgs) {
      const argBytes = new TextEncoder().encode(programArgs + '\0')
      const argStart = cpu.registers.BK

      // Write argument string to memory at BK
      for (let i = 0; i < argBytes.length; i++) {
        memory.writeByte(argStart + i, argBytes[i])
      }

      // Update BK to point past the argument string
      cpu.registers.BK = argStart + argBytes.length

      // Set AX to point to the argument string
      cpu.registers.AX = argStart

      if (debugMode) consolePrint(`[Args at 0x${argStart.toString(16).toUpperCase()}: "${programArgs}"]`)
    } else {
      // No arguments - set AX to 0 (null pointer)
      cpu.registers.AX = 0
    }

    if (debugMode) {
      consolePrint(`[Code: 0x0020-0x${result.codeEnd.toString(16).toUpperCase()}, Data: 0x${result.codeEnd.toString(16).toUpperCase()}-0x${result.dataEnd.toString(16).toUpperCase()}]`)
      if (debugInfo) {
        consolePrint(`[Debug info: ${debugInfo.lineMap.length} lines, ${Object.keys(debugInfo.symbols).length} symbols]`)
      }
    }
    updateUI()
  } catch (err) {
    consolePrint(`load: ${err.message}`)
  }
}

// Set register or memory value
function cmdSet(args) {
  if (args.length < 2) {
    consolePrint('Usage: set <register|address|screen> <value>')
    consolePrint('Examples:')
    consolePrint('  set AX 10        - Set register AX to 10')
    consolePrint('  set 0x20 65      - Set memory address 0x20 to 65')
    consolePrint("  set 35 'A'       - Set memory address 35 to ASCII 'A'")
    consolePrint("  set 40 'hello'   - Write string to memory at address 40")
    consolePrint('  set screen <url> - Load image from URL to display')
    return
  }

  const target = args[0].toLowerCase()
  const valueStr = args.slice(1).join(' ')

  // Check if setting screen (image loading)
  if (target === 'screen') {
    const imagePath = valueStr.trim()
    if (!imagePath) {
      consolePrint('Usage: set screen <url|filepath>')
      consolePrint('Examples:')
      consolePrint('  set screen https://example.com/image.png')
      consolePrint('  set screen /img/msu.jpg')
      return
    }

    consolePrint(`Loading image from ${imagePath}...`)

    // If it's a URL, load it directly
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
      display.loadImage(imagePath)
        .then(() => {
          consolePrint('[Image loaded successfully]')
        })
        .catch(err => {
          consolePrint(`[Error loading image: ${err.message}]`)
          consolePrint('[Note: External images may be blocked by CORS]')
        })
    } else {
      // Try to load from file system
      fs.readFile(imagePath)
        .then(content => {
          if (content instanceof ArrayBuffer) {
            // Convert ArrayBuffer to Blob URL
            const mimeType = imagePath.endsWith('.png') ? 'image/png' :
                           imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg') ? 'image/jpeg' :
                           imagePath.endsWith('.gif') ? 'image/gif' : 'image/png'
            const blob = new Blob([content], { type: mimeType })
            const blobUrl = URL.createObjectURL(blob)
            return display.loadImage(blobUrl)
          } else {
            throw new Error('File is not a binary image')
          }
        })
        .then(() => {
          consolePrint('[Image loaded successfully]')
        })
        .catch(err => {
          consolePrint(`[Error loading image: ${err.message}]`)
        })
    }
    return
  }

  const targetUpper = target.toUpperCase()

  // Check if target is a register
  const registers = ['AX', 'BX', 'CX', 'DX', 'EX', 'FX', 'SP', 'FP', 'BK', 'PC']
  if (registers.includes(targetUpper)) {
    // Set register value
    try {
      const value = parseValue(valueStr)
      cpu.registers[targetUpper] = value & 0xFFFF  // Clamp to 16 bits
      consolePrint(`[Set ${targetUpper} = 0x${cpu.registers[targetUpper].toString(16).padStart(4, '0').toUpperCase()}]`)
      updateUI()
    } catch (err) {
      consolePrint(`set: ${err.message}`)
    }
    return
  }

  // Otherwise, treat as memory address
  try {
    const address = parseAddress(args[0])

    // Check if value is a quoted string (single or double quotes)
    if ((valueStr.startsWith("'") && valueStr.endsWith("'")) ||
        (valueStr.startsWith('"') && valueStr.endsWith('"'))) {
      // Write string to memory
      const str = valueStr.slice(1, -1)  // Remove quotes
      for (let i = 0; i < str.length; i++) {
        memory.writeByte(address + i, str.charCodeAt(i))
      }
      consolePrint(`[Wrote "${str}" to address 0x${address.toString(16).padStart(4, '0').toUpperCase()}]`)
      updateUI(address)
    } else {
      // Write single byte to memory
      const value = parseValue(valueStr)
      memory.writeByte(address, value & 0xFF)  // Clamp to 8 bits
      consolePrint(`[Set memory[0x${address.toString(16).padStart(4, '0').toUpperCase()}] = 0x${(value & 0xFF).toString(16).padStart(2, '0').toUpperCase()}]`)
      updateUI(address)
    }
  } catch (err) {
    consolePrint(`set: ${err.message}`)
  }
}

// Parse address (hex or decimal)
function parseAddress(addr) {
  if (addr.startsWith('0x') || addr.startsWith('0X')) {
    return parseInt(addr, 16)
  }
  return parseInt(addr, 10)
}

// Parse value (hex, binary, decimal, or character literal)
function parseValue(valueStr) {
  // Character literal: 'A'
  if (valueStr.startsWith("'") && valueStr.endsWith("'") && valueStr.length === 3) {
    return valueStr.charCodeAt(1)
  }

  // Hex
  if (valueStr.startsWith('0x') || valueStr.startsWith('0X')) {
    return parseInt(valueStr, 16)
  }

  // Binary
  if (valueStr.startsWith('0b') || valueStr.startsWith('0B')) {
    return parseInt(valueStr.substring(2), 2)
  }

  // Decimal
  return parseInt(valueStr, 10)
}

// Tab completion handler
async function handleTabCompletion() {
  const consoleInput = document.getElementById('console-input')
  const input = consoleInput.value
  const cursorPos = consoleInput.selectionStart

  // Get the part before cursor
  const beforeCursor = input.substring(0, cursorPos)
  const afterCursor = input.substring(cursorPos)

  // Parse what we're trying to complete
  const parts = beforeCursor.split(/\s+/)

  if (parts.length === 1) {
    // Complete command or assembly instruction
    const partial = parts[0].toLowerCase()

    // List of available commands
    const commands = [
      'pwd', 'cd', 'ls', 'mkdir', 'rm', 'cat', 'open',
      'compile', 'asm', 'load', 'set', 'help', 'clear', 'reset', 'debug'
    ]

    // Get executables from /bin
    let binExecutables = []
    try {
      const binEntries = await fs.listDirectory('/bin')
      binExecutables = binEntries
        .filter(entry => entry.type === 'file')
        .map(entry => entry.name.replace(/\.exe$/i, ''))  // Remove .exe extension
    } catch (err) {
      // /bin doesn't exist or other error - ignore
    }

    // List of common assembly instructions
    const asmInstructions = [
      'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'INC', 'DEC',
      'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR',
      'CMP', 'JMP', 'JE', 'JNE', 'JL', 'JG', 'JLE', 'JGE',
      'PUSH', 'POP', 'CALL', 'RET', 'NOP', 'HLT',
      'SYSCALL', 'LEA'
    ]

    // Find matches from commands first
    let matches = commands.filter(cmd => cmd.startsWith(partial))

    // Then add matching executables from /bin
    const execMatches = binExecutables.filter(cmd => cmd.toLowerCase().startsWith(partial))
    matches = matches.concat(execMatches)

    if (matches.length === 0) {
      // Try assembly instructions (case insensitive)
      matches = asmInstructions.filter(inst =>
        inst.toLowerCase().startsWith(partial)
      ).map(inst => inst.toUpperCase())
    }

    if (matches.length === 1) {
      // Single match - complete it
      consoleInput.value = matches[0] + ' ' + afterCursor
      consoleInput.selectionStart = consoleInput.selectionEnd = matches[0].length + 1
    } else if (matches.length > 1) {
      // Multiple matches - show them
      consolePrint(`> ${input}`)
      consolePrint(matches.join('  '))

      // Find common prefix
      let commonPrefix = matches[0]
      for (let i = 1; i < matches.length; i++) {
        let j = 0
        while (j < commonPrefix.length && j < matches[i].length &&
               commonPrefix[j].toLowerCase() === matches[i][j].toLowerCase()) {
          j++
        }
        commonPrefix = commonPrefix.substring(0, j)
      }

      if (commonPrefix.length > partial.length) {
        // Complete to common prefix
        consoleInput.value = commonPrefix + afterCursor
        consoleInput.selectionStart = consoleInput.selectionEnd = commonPrefix.length
      }
    }
  } else {
    // Complete file path
    const cmd = parts[0].toLowerCase()
    const lastPart = parts[parts.length - 1]

    // Commands that take file arguments
    const fileCommands = ['cd', 'ls', 'cat', 'open', 'compile', 'asm', 'load', 'rm']

    if (fileCommands.includes(cmd)) {
      // Get directory and partial filename
      let dir = fs.pwd()  // Start with current directory
      let partial = lastPart

      if (lastPart.startsWith('/')) {
        // Absolute path
        if (lastPart.includes('/') && lastPart !== '/') {
          const lastSlash = lastPart.lastIndexOf('/')
          dir = lastPart.substring(0, lastSlash) || '/'
          partial = lastPart.substring(lastSlash + 1)
        } else {
          dir = '/'
          partial = lastPart.substring(1)
        }
      } else if (lastPart.includes('/')) {
        // Relative path with directory
        const lastSlash = lastPart.lastIndexOf('/')
        const relDir = lastPart.substring(0, lastSlash)
        partial = lastPart.substring(lastSlash + 1)
        dir = fs.resolvePath(relDir)
      }
      // else: no slash, use current directory with lastPart as partial

      try {
        // List files in directory
        const entries = await fs.listDirectory(dir)

        // Find matches
        const matches = entries
          .filter(entry => entry.name.toLowerCase().startsWith(partial.toLowerCase()))
          .map(entry => {
            // Build the completion based on what the user typed
            if (lastPart.startsWith('/')) {
              // Absolute path - return absolute
              const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`
              return entry.type === 'directory' ? fullPath + '/' : fullPath
            } else {
              // Relative path or no path - return relative
              const prefix = lastPart.substring(0, lastPart.lastIndexOf('/') + 1)
              const completion = prefix + entry.name
              return entry.type === 'directory' ? completion + '/' : completion
            }
          })

        if (matches.length === 1) {
          // Single match - complete it
          const beforeLastPart = beforeCursor.substring(0, beforeCursor.length - lastPart.length)
          consoleInput.value = beforeLastPart + matches[0] + afterCursor
          consoleInput.selectionStart = consoleInput.selectionEnd =
            beforeLastPart.length + matches[0].length
        } else if (matches.length > 1) {
          // Multiple matches - show them
          consolePrint(`> ${input}`)
          consolePrint(matches.map(m => {
            const parts = m.split('/')
            return parts[parts.length - 1] || parts[parts.length - 2] + '/'
          }).join('  '))

          // Find common prefix
          let commonPrefix = matches[0]
          for (let i = 1; i < matches.length; i++) {
            let j = 0
            while (j < commonPrefix.length && j < matches[i].length &&
                   commonPrefix[j] === matches[i][j]) {
              j++
            }
            commonPrefix = commonPrefix.substring(0, j)
          }

          if (commonPrefix.length > lastPart.length) {
            // Complete to common prefix
            const beforeLastPart = beforeCursor.substring(0, beforeCursor.length - lastPart.length)
            consoleInput.value = beforeLastPart + commonPrefix + afterCursor
            consoleInput.selectionStart = consoleInput.selectionEnd =
              beforeLastPart.length + commonPrefix.length
          }
        }
      } catch (err) {
        // Directory doesn't exist or other error - ignore
      }
    }
  }
}

// Show help
function cmdHelp(args) {
  consolePrint('File System Commands:')
  consolePrint('  pwd              - Print working directory')
  consolePrint('  cd [dir]         - Change directory (root if omitted)')
  consolePrint('  ls [dir]         - List directory contents')
  consolePrint('  mkdir <dir>      - Create directory')
  consolePrint('  rm <file|dir>    - Remove file or directory')
  consolePrint('  cat <file>       - Display file contents')
  consolePrint('  open <file>      - Open file in editor')
  consolePrint('')
  consolePrint('Program Commands:')
  consolePrint('  compile <src> [out]  - Compile .asm to .x366 binary')
  consolePrint('  asm <file> [out]     - Assemble .asm to .exe (default: a.exe)')
  consolePrint('  load <file> [args]   - Load and run (.asm/.exe) with optional args')
  consolePrint('  <name> [args]        - Run executable from /bin (e.g., hello, echo)')
  consolePrint('  set <reg|addr> <val> - Set register or memory value')
  consolePrint('  set screen <url>     - Load image from URL to display')
  consolePrint('')
  consolePrint('System Commands:')
  consolePrint('  clear            - Clear console')
  consolePrint('  reset            - Reset emulator (clear memory)')
  consolePrint('  debug            - Toggle debug mode on/off')
  consolePrint('  help             - Show this help')
  consolePrint('')
  consolePrint('Syscalls (use name or number):')
  consolePrint('  SYSCALL EXIT / SYSCALL 0')
  consolePrint('  SYSCALL PRINT_CHAR / SYSCALL 1  (AX=char)')
  consolePrint('  SYSCALL PRINT_STRING / SYSCALL 2  (AX=addr)')
  consolePrint('  SYSCALL PRINT_INT / SYSCALL 3  (AX=int)')
  consolePrint('  SYSCALL SET_COLOR / SYSCALL 10  (AX=0-3)')
  consolePrint('  SYSCALL DRAW_PIXEL / SYSCALL 11  (AX=x, BX=y)')
  consolePrint('  SYSCALL DRAW_LINE / SYSCALL 12  (AX=x1, BX=y1, CX=x2, DX=y2)')
  consolePrint('  SYSCALL DRAW_RECT / SYSCALL 13  (AX=x, BX=y, CX=w, DX=h)')
  consolePrint('  SYSCALL DRAW_CIRCLE / SYSCALL 14  (AX=cx, BX=cy, CX=r)')
  consolePrint('  SYSCALL CLEAR_SCREEN / SYSCALL 15')
  consolePrint('  SYSCALL REFRESH / SYSCALL 17')
  consolePrint('')
  consolePrint('You can also type assembly instructions directly.')
}

// Clear console
function cmdClear(args) {
  consoleClear()
}

// Reset emulator (CPU and memory)
function cmdReset(args) {
  cpu.reset()
  memory = new Memory(memory.size)
  cpu.memory = memory
  display.clear()
  updateUI()
  consolePrint('[Emulator reset - memory cleared]')
}

// Toggle debug mode
function cmdDebug(args) {
  debugMode = !debugMode
  consolePrint(`[Debug mode: ${debugMode ? 'ON' : 'OFF'}]`)
}

// ============================================================================
// UI Update
// ============================================================================
// Backward Stepping Support
// ============================================================================

function beginDelta() {
  if (!trackingEnabled) return
  currentDelta = {
    registers: new Map(),
    flags: new Map(),
    memory: new Map(),
    pc: cpu.registers.PC
  }
}

function trackRegisterChange(regName, oldValue) {
  if (!trackingEnabled || !currentDelta) return
  if (!currentDelta.registers.has(regName)) {
    currentDelta.registers.set(regName, oldValue)
  }
}

function trackMemoryChange(addr, oldValue) {
  if (!trackingEnabled || !currentDelta) return
  if (!currentDelta.memory.has(addr)) {
    currentDelta.memory.set(addr, oldValue)
  }
}

function trackFlagChange(flagName, oldValue) {
  if (!trackingEnabled || !currentDelta) return
  if (!currentDelta.flags.has(flagName)) {
    currentDelta.flags.set(flagName, oldValue)
  }
}

function commitDelta() {
  if (!trackingEnabled || !currentDelta) return

  // Limit history size
  if (stateHistory.length >= MAX_HISTORY) {
    stateHistory.shift()  // Remove oldest
  }

  stateHistory.push(currentDelta)
  currentDelta = null
}

function stepBackward() {
  if (stateHistory.length === 0) return false

  const delta = stateHistory.pop()

  // Restore registers
  for (const [reg, oldValue] of delta.registers) {
    cpu.registers[reg] = oldValue
  }

  // Restore flags
  for (const [flag, oldValue] of delta.flags) {
    cpu.flags[flag] = oldValue
  }

  // Restore memory
  for (const [addr, oldValue] of delta.memory) {
    memory.writeByte(addr, oldValue)
  }

  // Restore PC
  cpu.registers.PC = delta.pc

  updateUI()
  updateEditorExecutionLine()

  return true
}

function canStepBackward() {
  return stateHistory.length > 0
}

function clearHistory() {
  stateHistory = []
}

// ============================================================================
// UI Updates
// ============================================================================

function updateUI(scrollToAddr = null) {
  updateRegisters()
  updateMemoryView(scrollToAddr)
  updateButtonStates()
}

function updateButtonStates() {
  // Back button: enabled only if there's undo history
  document.getElementById('btn-step-back').disabled = undoHistory.length === 0

  // Quit button: enabled only if program is running or paused (not halted)
  document.getElementById('btn-quit').disabled = cpu.halted

  // Step button: enabled when program is loaded (not halted) and not running
  document.getElementById('btn-step').disabled = cpu.halted || running
}

// ============================================================================
// Execution Loop
// ============================================================================

let animationFrameId = null
let timeoutId = null
let intervalId = null
let lastUIUpdate = 0
const UI_UPDATE_INTERVAL = 100  // ms (10 updates/sec for debugging UI)
let executionStartTime = 0
let executionInstructionCount = 0

function executionLoop() {
  if (!running) {
    animationFrameId = null
    timeoutId = null
    return
  }

  // At max speed or high speeds, use more instructions per iteration
  const stepsPerFrame = speed === 0 ? 100000 : Math.max(1, Math.floor(speed / 60))

  // Run multiple batches before yielding to minimize setTimeout overhead
  const batchesBeforeYield = (speed === 0 || speed > 100000) ? 10 : 1

  for (let batch = 0; batch < batchesBeforeYield; batch++) {
    for (let i = 0; i < stepsPerFrame; i++) {
      if (!cpu.step()) {
        running = false
        if (debugMode) {
          const elapsed = (performance.now() - executionStartTime) / 1000
          const ips = Math.floor(executionInstructionCount / elapsed)
          consolePrint(`[CPU halted after ${executionInstructionCount.toLocaleString()} instructions in ${elapsed.toFixed(2)}s (${ips.toLocaleString()} inst/sec)]`)
        }
        document.getElementById('btn-run').textContent = 'run'
        clearExecutionLine()
        updateUI()  // Update immediately on halt
        break
      }

      executionInstructionCount++

      // Check for breakpoint
      if (checkBreakpoint()) {
        running = false
        document.getElementById('btn-run').textContent = 'run'
        updateUI()
        updateEditorExecutionLine()
        if (debugMode) consolePrint('[Breakpoint hit]')
        break
      }
    }

    // Break out of batch loop if halted or breakpoint hit
    if (!running) break
  }

  // Throttle UI updates to reduce DOM manipulation overhead
  // At high speeds (>10kHz or Max), disable debugging UI updates entirely
  if (speed > 0 && speed <= 10000) {
    const now = performance.now()
    if (now - lastUIUpdate > UI_UPDATE_INTERVAL) {
      updateUI()
      lastUIUpdate = now
    }
  }

  if (running) {
    // At high speeds, use setTimeout for immediate recursion (no 60fps cap)
    // At low speeds, use requestAnimationFrame for smooth debugging
    if (speed === 0 || speed > 10000) {
      timeoutId = setTimeout(executionLoop, 0)
    } else {
      animationFrameId = requestAnimationFrame(executionLoop)
    }
  } else {
    animationFrameId = null
    timeoutId = null
  }
}

function executionLoopSlow() {
  if (!running) {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    return
  }

  if (!cpu.step()) {
    running = false
    if (debugMode) consolePrint('[CPU halted]')
    document.getElementById('btn-run').textContent = 'run'
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    updateUI()
    clearExecutionLine()
    return
  }

  updateUI()
  // Update execution line for slow speeds (100Hz or less)
  if (speed <= 100) {
    updateEditorExecutionLine()
  }

  // Check for breakpoint
  if (checkBreakpoint()) {
    running = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    document.getElementById('btn-run').textContent = 'run'
    updateEditorExecutionLine()
    if (debugMode) consolePrint('[Breakpoint hit]')
  }
}

// ============================================================================
// Game Boy Button Input
// ============================================================================

// Game Boy button bit mapping (standard conventions)
const BUTTON_BITS = {
  'btn-right': 0x01,   // Bit 0
  'btn-left': 0x02,    // Bit 1
  'btn-up': 0x04,      // Bit 2
  'btn-down': 0x08,    // Bit 3
  'btn-a': 0x10,       // Bit 4
  'btn-b': 0x20,       // Bit 5
  'btn-select': 0x40,  // Bit 6
  'btn-start': 0x80,   // Bit 7
}

const BUTTON_ADDRESS = 0x0010
let currentButtonState = 0x00

function updateButtonState(buttonId, pressed) {
  if (pressed) {
    currentButtonState |= BUTTON_BITS[buttonId]
  } else {
    currentButtonState &= ~BUTTON_BITS[buttonId]
  }

  // Write to memory
  memory.writeByte(BUTTON_ADDRESS, currentButtonState)

  // Update memory view to show the change
  updateMemoryView(BUTTON_ADDRESS)
}

function setupGameBoyButtons() {
  Object.keys(BUTTON_BITS).forEach(buttonId => {
    const button = document.getElementById(buttonId)
    if (!button) return

    // Mouse events
    button.addEventListener('mousedown', (e) => {
      e.preventDefault()
      updateButtonState(buttonId, true)
    })

    button.addEventListener('mouseup', (e) => {
      e.preventDefault()
      updateButtonState(buttonId, false)
    })

    button.addEventListener('mouseleave', (e) => {
      // Release button if mouse leaves while pressed
      updateButtonState(buttonId, false)
    })

    // Touch events for mobile
    button.addEventListener('touchstart', (e) => {
      e.preventDefault()
      updateButtonState(buttonId, true)
    })

    button.addEventListener('touchend', (e) => {
      e.preventDefault()
      updateButtonState(buttonId, false)
    })
  })
}

// ============================================================================
// Control Buttons
// ============================================================================

function handleRun() {
  if (running) {
    // Pause
    running = false
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    document.getElementById('btn-run').textContent = 'run'
  } else {
    // Run
    running = true
    executionStartTime = performance.now()
    executionInstructionCount = 0
    document.getElementById('btn-run').textContent = 'pause'

    // For low speeds (<= 100 Hz), use setInterval for accurate timing
    // For high speeds, use requestAnimationFrame
    if (speed > 0 && speed <= 100) {
      const delayMs = 1000 / speed  // milliseconds per instruction
      intervalId = setInterval(executionLoopSlow, delayMs)
    } else {
      executionLoop()
    }
  }
}

function handleStep() {
  if (running) return // Don't step while running

  cpu.currentUndoList = []

  if (cpu.step()) {
    if (cpu.currentUndoList.length > 0) {
      if (undoHistory.length >= MAX_HISTORY) {
        undoHistory.shift()
      }
      undoHistory.push(cpu.currentUndoList)
    }
    cpu.currentUndoList = null
    updateUI()
    updateEditorExecutionLine()
  } else {
    cpu.currentUndoList = null
    if (debugMode) consolePrint('[CPU halted]')
    clearExecutionLine()
  }
}

function handleStepBack() {
  if (running || undoHistory.length === 0) return

  const undoList = undoHistory.pop()

  for (let i = undoList.length - 1; i >= 0; i--) {
    undoList[i]()
  }

  updateUI()
  updateEditorExecutionLine()
}

function handleQuit() {
  // Stop execution if running
  if (running) {
    running = false
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    document.getElementById('btn-run').textContent = 'run'
  }

  // Simulate EXIT syscall
  cpu.halted = true
  clearExecutionLine()
  updateUI()
  consolePrint('[Program terminated]')
}

function updateEditorExecutionLine() {
  // Only highlight if we have debug info and editor is open
  if (!debugInfo || !debugInfo.lineMap) {
    clearExecutionLine()
    return
  }

  const pc = cpu.registers.PC

  // lineMap is array of {pc, line} objects - find matching entry
  const entry = debugInfo.lineMap.find(e => e.pc === pc)
  const sourceLine = entry ? entry.line : undefined

  if (sourceLine !== undefined && sourceLine > 0) {
    setExecutionLine(sourceLine)
  } else {
    clearExecutionLine()
  }
}

function updateBreakpointPCMap() {
  // Update the runtime PC-to-breakpoint map from source line breakpoints
  if (!debugInfo || !debugInfo.lineMap || !memory) return

  // Lazy initialization
  if (!breakpointPCMap) {
    breakpointPCMap = new Uint8Array(memory.size)
  }

  // Clear map
  breakpointPCMap.fill(0)

  // Get line numbers with breakpoints
  const breakpointLines = getBreakpoints()
  if (breakpointLines.length === 0) return

  // For each line map entry, check if its line has a breakpoint
  for (let i = 0; i < debugInfo.lineMap.length; i++) {
    const entry = debugInfo.lineMap[i]
    if (breakpointLines.includes(entry.line)) {
      if (entry.pc < breakpointPCMap.length) {
        breakpointPCMap[entry.pc] = 1
      }
    }
  }
}

function checkBreakpoint() {
  // Fast O(1) PC lookup
  if (!breakpointPCMap) return false
  const pc = cpu.registers.PC
  return pc < breakpointPCMap.length && breakpointPCMap[pc] === 1
}

function handleReset() {
  running = false
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  memory.clear()
  cpu.reset()
  display.clear()
  undoHistory = []

  document.getElementById('btn-run').textContent = 'run'

  updateUI()
  clearExecutionLine()
  consolePrint('[Emulator reset]')
}

function handleSpeedChange(e) {
  speed = parseInt(e.target.value, 10)

  // If currently running, restart with new speed
  if (running) {
    // Stop current execution
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }

    // Restart with new speed
    if (speed > 0 && speed < 100) {
      const delayMs = 1000 / speed
      intervalId = setInterval(executionLoopSlow, delayMs)
    } else {
      executionLoop()
    }
  }
}

function handleMemorySizeChange(e) {
  const newSize = parseInt(e.target.value, 10)

  // Don't resize if emulator is running
  if (running) {
    consolePrint('[Cannot resize memory while running]')
    // Reset dropdown to current size
    e.target.value = memory.size
    return
  }

  try {
    // Get current BK and SP values before resize
    const currentBK = cpu.registers.BK
    const currentSP = cpu.registers.SP

    // Resize memory (preserves heap and stack)
    const result = memory.resize(newSize, currentBK, currentSP)

    // Update SP register to new stack position
    cpu.registers.SP = result.newStackPointer

    // Update UI to reflect changes
    updateUI()

    consolePrint(`[Memory resized to ${newSize} bytes (${newSize / 1024}K)]`)
  } catch (error) {
    consolePrint(`[Error resizing memory: ${error.message}]`)
    // Reset dropdown to current size
    e.target.value = memory.size
  }
}

// ============================================================================
// File System
// ============================================================================

let selectedFile = null
let isInEditorMode = false
let expandedFolders = new Set(['/']) // Root is always expanded

async function renderFileList() {
  const explorerEl = document.getElementById('file-explorer')
  if (!explorerEl) return

  const tree = await fs.getTree()

  // Build HTML with hierarchical tree
  let html = '<div class="explorer-table">'
  html += await renderTreeNode(tree, 0)
  html += '</div>'

  explorerEl.innerHTML = html

  // Wire up folder toggle handlers
  explorerEl.querySelectorAll('.explorer-row.folder').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't toggle if clicking on dropdown menu
      if (e.target.classList.contains('dropdown-btn') ||
          e.target.classList.contains('folder-menu-btn') ||
          e.target.closest('.dropdown')) return

      const folderPath = row.dataset.folder
      if (expandedFolders.has(folderPath)) {
        expandedFolders.delete(folderPath)
      } else {
        expandedFolders.add(folderPath)
      }
      renderFileList()
    })
  })

  // Wire up file click and double-click handlers
  explorerEl.querySelectorAll('.explorer-row:not(.folder)').forEach(row => {
    let clickCount = 0
    let clickTimer = null

    row.addEventListener('click', async (e) => {
      // Don't handle if clicking menu buttons or links
      if (e.target.classList.contains('dropdown-btn') ||
          e.target.classList.contains('file-menu-download') ||
          e.target.classList.contains('file-menu-delete') ||
          e.target.closest('.dropdown')) return

      const filePath = row.dataset.file

      clickCount++

      if (clickCount === 1) {
        // Single click - select file
        clickTimer = setTimeout(async () => {
          selectedFile = filePath
          await renderFileList()
          clickCount = 0
        }, 250)
      } else if (clickCount === 2) {
        // Double click - open file
        clearTimeout(clickTimer)
        clickCount = 0
        openFileInEditor(filePath)
      }
    })
  })

  // Wire up file menu dropdowns
  explorerEl.querySelectorAll('.file-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const dropdown = btn.closest('.dropdown')

      // Close all other dropdowns
      document.querySelectorAll('.dropdown.show').forEach(d => {
        if (d !== dropdown) d.classList.remove('show')
      })

      dropdown.classList.toggle('show')
    })
  })

  // Wire up file menu actions
  explorerEl.querySelectorAll('.file-menu-download').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const filePath = link.dataset.file
      await handleDownloadFile(filePath)
      document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    })
  })

  explorerEl.querySelectorAll('.file-menu-delete').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const filePath = link.dataset.file
      await handleDeleteFile(filePath)
      document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    })
  })

  // Wire up folder menu dropdowns
  explorerEl.querySelectorAll('.folder-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const dropdown = btn.closest('.dropdown')

      // Close all other dropdowns
      document.querySelectorAll('.dropdown.show').forEach(d => {
        if (d !== dropdown) d.classList.remove('show')
      })

      dropdown.classList.toggle('show')
    })
  })

  // Wire up folder menu actions
  explorerEl.querySelectorAll('.folder-menu-upload-zip-merge').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const folderPath = link.dataset.folder
      await handleFolderUploadZipMerge(folderPath)
      document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    })
  })

  explorerEl.querySelectorAll('.folder-menu-upload-zip-replace').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const folderPath = link.dataset.folder
      await handleFolderUploadZipReplace(folderPath)
      document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    })
  })

  explorerEl.querySelectorAll('.folder-menu-download-zip').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const folderPath = link.dataset.folder
      await handleFolderDownloadZip(folderPath)
      document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    })
  })
}

async function renderTreeNode(node, depth) {
  let html = ''
  const indent = depth * 18 // pixels per depth level

  if (node.type === 'directory' && node.path !== '/') {
    // Render directory row
    const isExpanded = expandedFolders.has(node.path)
    const expandIcon = isExpanded ? '▼' : '▶'
    const folderIcon = isExpanded ? '📂' : '📁'

    html += `
      <div class="explorer-row folder" data-folder="${node.path}">
        <div class="explorer-cell" style="padding-left: ${indent + 6}px">
          <span class="explorer-expand">${expandIcon}</span>
          <span class="explorer-icon">${folderIcon}</span>
          <span>${node.name}</span>
        </div>
        <div class="explorer-cell"></div>
        <div class="explorer-cell">File Folder</div>
        <div class="explorer-cell">
          <span class="explorer-actions">
            <div class="dropdown folder-dropdown">
              <button class="dropdown-btn folder-menu-btn" data-folder="${node.path}">&#9881;</button>
              <div class="dropdown-content folder-menu">
                <a href="#" class="folder-menu-upload-zip-merge" data-folder="${node.path}">Upload ZIP (Merge)</a>
                <a href="#" class="folder-menu-upload-zip-replace" data-folder="${node.path}">Upload ZIP (Replace)</a>
                <a href="#" class="folder-menu-download-zip" data-folder="${node.path}">Download as ZIP</a>
              </div>
            </div>
          </span>
        </div>
      </div>
    `

    // Render children if expanded
    if (isExpanded && node.children) {
      for (const child of node.children) {
        html += await renderTreeNode(child, depth + 1)
      }
    }
  } else if (node.type === 'file') {
    // Render file row
    const selected = selectedFile === node.path ? 'selected' : ''
    const icon = getFileIcon(node.name)

    // Get file size
    const content = await fs.readFile(node.path)
    const size = content instanceof ArrayBuffer ? content.byteLength : content.length
    const sizeStr = size < 1024 ? `${size} B` : `${Math.round(size / 1024)} KB`

    html += `
      <div class="explorer-row ${selected}" data-file="${node.path}">
        <div class="explorer-cell" style="padding-left: ${indent + 6}px">
          <span class="explorer-icon">${icon}</span>
          <span>${node.name}</span>
        </div>
        <div class="explorer-cell">${sizeStr}</div>
        <div class="explorer-cell">${getFileType(node.name)}</div>
        <div class="explorer-cell">
          <span class="explorer-actions">
            <div class="dropdown file-dropdown">
              <button class="dropdown-btn file-menu-btn" data-file="${node.path}">&#9881;</button>
              <div class="dropdown-content file-menu">
                <a href="#" class="file-menu-download" data-file="${node.path}">Download</a>
                <a href="#" class="file-menu-delete" data-file="${node.path}">Delete</a>
              </div>
            </div>
          </span>
        </div>
      </div>
    `
  } else if (node.path === '/' && node.children) {
    // Root node - just render children
    for (const child of node.children) {
      html += await renderTreeNode(child, depth)
    }
  }

  return html
}

function getFileIcon(fileName) {
  if (fileName.endsWith('.asm')) return '📄'
  if (fileName.endsWith('.txt')) return '📝'
  if (fileName.endsWith('.bin') || fileName.endsWith('.x366')) return '⚙️'
  if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif')) return '🖼️'
  if (fileName.endsWith('.cells')) return '📊'
  return '📄'
}

function getFileType(fileName) {
  if (fileName.endsWith('.asm')) return 'ASM File'
  if (fileName.endsWith('.txt')) return 'Text Document'
  if (fileName.endsWith('.bin')) return 'Binary File'
  if (fileName.endsWith('.x366')) return 'x366 Program'
  if (fileName.endsWith('.png')) return 'PNG Image'
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'JPEG Image'
  if (fileName.endsWith('.gif')) return 'GIF Image'
  if (fileName.endsWith('.cells')) return 'Game of Life'
  return 'File'
}

async function openFileInEditor(filePath) {
  // Save any open file first
  if (isInEditorMode) {
    await saveCurrentFile(false)
  }

  try {
    // Check file type and route to appropriate viewer
    if (filePath.match(/\.(x366|bin|exe)$/i)) {
      // Binary viewer
      await showBinaryView(filePath)
    } else if (filePath.match(/\.(png|jpg|jpeg|gif)$/i)) {
      // Image viewer
      await showImageView(filePath)
    } else {
      // Text editor (asm, txt, cells, etc.)
      await fs.setCurrentFile(filePath)
      await loadCurrentFile()
      await showEditorView()
    }
  } catch (err) {
    consolePrint(`[Error opening file: ${err.message}]`)
  }
}

async function showEditorView() {
  isInEditorMode = true

  document.getElementById('explorer-view').style.display = 'none'
  document.getElementById('editor-view').style.display = 'flex'
  document.getElementById('binary-view').style.display = 'none'
  document.getElementById('image-view').style.display = 'none'
  document.getElementById('editor-nav-bar').style.display = 'flex'

  const currentFile = await fs.getCurrentFile()

  // Show/hide buttons based on file type
  const isAsmFile = currentFile.endsWith('.asm')
  document.getElementById('btn-save').style.display = ''
  document.getElementById('btn-load-program').style.display = isAsmFile ? '' : 'none'
  document.getElementById('btn-run-program').style.display = isAsmFile ? '' : 'none'

  document.getElementById('current-path').textContent = currentFile
}

async function showExplorerView() {
  // Save file before going back
  if (isInEditorMode) {
    await saveCurrentFile(false)
  }

  isInEditorMode = false

  document.getElementById('explorer-view').style.display = 'flex'
  document.getElementById('editor-view').style.display = 'none'
  document.getElementById('binary-view').style.display = 'none'
  document.getElementById('image-view').style.display = 'none'
  document.getElementById('editor-nav-bar').style.display = 'none'

  await renderFileList()
}

async function showBinaryView(filePath) {
  isInEditorMode = true

  // Hide other views
  document.getElementById('explorer-view').style.display = 'none'
  document.getElementById('editor-view').style.display = 'none'
  document.getElementById('image-view').style.display = 'none'

  // Show binary view
  document.getElementById('binary-view').style.display = 'flex'
  document.getElementById('editor-nav-bar').style.display = 'flex'

  // Update path and hide save/load/run buttons (read-only)
  document.getElementById('current-path').textContent = filePath
  document.getElementById('btn-save').style.display = 'none'
  document.getElementById('btn-load-program').style.display = 'none'
  document.getElementById('btn-run-program').style.display = 'none'

  // Load and display binary
  const content = await fs.readFile(filePath)
  const binary = content instanceof ArrayBuffer ? new Uint8Array(content) : content
  renderBinaryViewer(binary, filePath)
}

async function showImageView(filePath) {
  isInEditorMode = true

  // Hide other views
  document.getElementById('explorer-view').style.display = 'none'
  document.getElementById('editor-view').style.display = 'none'
  document.getElementById('binary-view').style.display = 'none'

  // Show image view
  document.getElementById('image-view').style.display = 'flex'
  document.getElementById('editor-nav-bar').style.display = 'flex'

  // Update path and hide save/load/run buttons (read-only)
  document.getElementById('current-path').textContent = filePath
  document.getElementById('btn-save').style.display = 'none'
  document.getElementById('btn-load-program').style.display = 'none'
  document.getElementById('btn-run-program').style.display = 'none'

  // Load and display image
  const content = await fs.readFile(filePath)
  if (content instanceof ArrayBuffer) {
    const mimeType = filePath.endsWith('.png') ? 'image/png' :
                    filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' :
                    filePath.endsWith('.gif') ? 'image/gif' : 'image/png'
    const blob = new Blob([content], { type: mimeType })
    const blobUrl = URL.createObjectURL(blob)
    document.getElementById('image-viewer').src = blobUrl
  }
}

function renderBinaryViewer(binary, filePath) {
  const viewer = document.getElementById('binary-viewer')

  // Parse header
  const signature = String.fromCharCode(binary[0], binary[1], binary[2], binary[3])
  const version = binary[4]
  const memorySize = (binary[9] << 8) | binary[10]
  const sectionsOffset = (binary[12] << 24) | (binary[13] << 16) | (binary[14] << 8) | binary[15]
  const breakPointer = (binary[16] << 8) | binary[17]
  const codeBoundary = (binary[18] << 8) | binary[19]

  // Helper function to determine section type for a byte offset
  function getSectionInfo(offset) {
    if (offset < 0x0020) {
      return { name: 'Header', color: '#e8d5f0', desc: 'X366 Binary Header - Contains metadata about the executable' }
    } else if (offset >= 0x0020 && offset < codeBoundary) {
      return { name: 'Code', color: '#ffcccb', desc: 'Code Section - Executable instructions' }
    } else if (offset >= codeBoundary && offset < breakPointer) {
      return { name: 'Data', color: '#b3e5e0', desc: 'Data Section - Static data and strings' }
    } else if (sectionsOffset > 0 && offset >= sectionsOffset) {
      return { name: 'Debug', color: '#ffe4b3', desc: 'Debug Section - Symbol and line number information' }
    } else {
      return { name: 'Unused', color: '#e0e0e0', desc: 'Unused space in binary' }
    }
  }

  // Helper function to convert byte to printable character (Windows-1252)
  function byteToChar(byte) {
    if (byte === 0) return '.'
    // Standard ASCII printable
    if (byte >= 32 && byte <= 126) return String.fromCharCode(byte)
    // Windows-1252 specific mappings for 128-159 range
    if (byte >= 128 && byte <= 159) {
      const win1252 = {
        128: '\u20AC', 130: '\u201A', 131: '\u0192', 132: '\u201E', 133: '\u2026', 134: '\u2020', 135: '\u2021',
        136: '\u02C6', 137: '\u2030', 138: '\u0160', 139: '\u2039', 140: '\u0152', 142: '\u017D',
        145: '\u2018', 146: '\u2019', 147: '\u201C', 148: '\u201D', 149: '\u2022', 150: '\u2013', 151: '\u2014',
        152: '\u02DC', 153: '\u2122', 154: '\u0161', 155: '\u203A', 156: '\u0153', 158: '\u017E', 159: '\u0178'
      }
      return win1252[byte] || '\u00B7'
    }
    // Extended ASCII / Windows-1252 (160-255)
    if (byte >= 160 && byte <= 255) return String.fromCharCode(byte)
    // Non-printable
    return '·'
  }

  let html = `
    <div style="padding: 8px; font-family: 'Courier New', monospace; font-size: 13px; background: white; color: black;">
      <!-- Compact Header -->
      <div style="margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 2px; background: #f5f5f5;">
        <div style="color: #333; font-weight: bold; margin-bottom: 3px;">${filePath}</div>
        <div style="color: #666; font-size: 11px;">
          <span style="margin-right: 15px;">Format: ${signature} v${version}</span>
          <span style="margin-right: 15px;">Size: ${binary.length} bytes</span>
          <span>Memory: ${memorySize} bytes</span>
        </div>
      </div>

      <!-- Legend -->
      <div style="margin-bottom: 6px; padding: 5px; border: 1px solid #ccc; border-radius: 2px; font-size: 11px; background: #f5f5f5;">
        <span style="color: #333; margin-right: 10px;">Legend:</span>
        <span style="background: #e8d5f0; padding: 1px 4px; margin-right: 6px; border-radius: 2px; border: 1px solid #d0b8e0; color: #333;">Header</span>
        <span style="background: #ffcccb; padding: 1px 4px; margin-right: 6px; border-radius: 2px; border: 1px solid #ffb3b3; color: #333;">Code</span>
        <span style="background: #b3e5e0; padding: 1px 4px; margin-right: 6px; border-radius: 2px; border: 1px solid #99d6d0; color: #333;">Data</span>
        <span style="background: #ffe4b3; padding: 1px 4px; margin-right: 6px; border-radius: 2px; border: 1px solid #ffd699; color: #333;">Debug</span>
      </div>

      <!-- Hex Dump -->
      <div style="border: 1px solid #ccc; border-radius: 2px; padding: 5px; overflow-x: auto; max-height: calc(100vh - 250px); overflow-y: auto; background: white;">
        <table style="border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: white;">
            <tr style="border-bottom: 1px solid #ccc;">
              <th style="text-align: left; padding: 3px 8px; color: #666;">Offset</th>
              <th style="text-align: left; padding: 3px 8px; color: #666;">Hex</th>
              <th style="text-align: left; padding: 3px 8px; color: #666;">Decoded</th>
            </tr>
          </thead>
          <tbody>
  `

  // Generate hex dump rows (8 bytes per row for vertical orientation)
  const bytesPerRow = 8
  for (let offset = 0; offset < binary.length; offset += bytesPerRow) {
    const section = getSectionInfo(offset)

    // Build hex string
    let hexBytes = []
    let asciiChars = []

    for (let i = 0; i < bytesPerRow; i++) {
      const byteOffset = offset + i
      if (byteOffset < binary.length) {
        const byte = binary[byteOffset]
        const byteSectionInfo = getSectionInfo(byteOffset)
        hexBytes.push(`<span class="hex-byte" style="background: ${byteSectionInfo.color}; padding: 0px 2px; margin: 0 1px; cursor: help; border-radius: 1px; color: black; font-weight: bold;" title="${byteSectionInfo.name}: ${byteSectionInfo.desc}">${byte.toString(16).padStart(2, '0')}</span>`)
        asciiChars.push(byteToChar(byte))
      } else {
        hexBytes.push('<span style="margin: 0 1px; opacity: 0.3;">  </span>')
        asciiChars.push(' ')
      }
    }

    html += `
      <tr>
        <td style="padding: 2px 8px; color: #666; font-weight: bold;">0x${offset.toString(16).padStart(4, '0').toUpperCase()}</td>
        <td style="padding: 2px 8px; white-space: nowrap;">${hexBytes.join('')}</td>
        <td style="padding: 2px 8px; color: #333;">${asciiChars.join('')}</td>
      </tr>
    `
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `

  viewer.innerHTML = html
}

function formatInstruction(instr) {
  let result = instr.mnemonic

  if (instr.dest) {
    result += ` ${instr.dest}`
  }

  if (instr.src !== undefined && instr.src !== null) {
    if (typeof instr.src === 'object' && instr.src.type) {
      // Addressing mode
      if (instr.src.type === 'register') {
        result += `, ${instr.src.reg}`
      } else if (instr.src.type === 'immediate') {
        result += `, ${instr.src.value}`
      } else if (instr.src.type === 'direct') {
        result += `, [0x${instr.src.address.toString(16)}]`
      } else if (instr.src.type === 'register_indirect') {
        result += `, [${instr.src.reg}]`
      } else if (instr.src.type === 'register_relative') {
        const offset = instr.src.offset >= 0 ? `+${instr.src.offset}` : instr.src.offset
        result += `, [${instr.src.reg}${offset}]`
      }
    } else {
      result += `, ${instr.src}`
    }
  }

  return result
}


async function loadCurrentFile() {
  const editor = getEditor()
  const currentPathEl = document.getElementById('current-path')

  const filePath = await fs.getCurrentFile()
  const content = await fs.getCurrentContent()

  if (editor) {
    editor.setValue(content)
  }
  if (currentPathEl) {
    currentPathEl.textContent = filePath
  }
}

async function saveCurrentFile(showMessage = true) {
  const editor = getEditor()
  const content = editor ? editor.getValue() : ''

  try {
    await fs.saveCurrentContent(content)
    if (showMessage) {
      consolePrint(`[Saved ${await fs.getCurrentFile()}]`)
    }
  } catch (err) {
    consolePrint(`[Error saving: ${err.message}]`)
  }
}

async function handleNewFile() {
  const cwd = fs.pwd()
  const fileName = prompt(`Enter file name (will be created in ${cwd}):`)
  if (!fileName) return

  try {
    // Create file path relative to cwd
    const filePath = fileName.startsWith('/') ? fileName : `${cwd}/${fileName}`.replace('//', '/')

    await fs.createFile(filePath, '; New assembly file\n\nHALT\n')
    consolePrint(`[Created ${filePath}]`)

    // Expand the parent folder if needed
    const parentDir = fs.dirname(filePath)
    if (parentDir !== '/') {
      expandedFolders.add(parentDir)
    }

    // Refresh explorer or open file depending on current mode
    if (isInEditorMode) {
      await openFileInEditor(filePath)
    } else {
      selectedFile = filePath
      await renderFileList()
    }
  } catch (err) {
    consolePrint(`[Error creating file: ${err.message}]`)
    alert(err.message)
  }
}

async function handleDeleteFile(filePath) {
  const files = await fs.listFiles()
  if (files.length <= 1) {
    alert('Cannot delete the last file')
    return
  }

  if (!confirm(`Delete ${filePath}?`)) return

  try {
    const wasCurrentFile = filePath === (await fs.getCurrentFile())
    const wasSelectedFile = filePath === selectedFile

    await fs.deleteFile(filePath)
    consolePrint(`[Deleted ${filePath}]`)

    // If we deleted the currently selected file, clear selection
    if (wasSelectedFile) {
      selectedFile = null
    }

    // If we deleted the current open file in editor, go back to explorer
    if (wasCurrentFile && isInEditorMode) {
      await showExplorerView()
    } else {
      await renderFileList()
    }
  } catch (err) {
    consolePrint(`[Error deleting file: ${err.message}]`)
    alert(err.message)
  }
}

async function handleDownloadFile(filePath) {
  try {
    const content = await fs.readFile(filePath)
    const fileName = fs.basename(filePath)

    // Create blob based on content type
    let blob
    if (content instanceof ArrayBuffer) {
      // Binary file
      blob = new Blob([content])
    } else {
      // Text file
      blob = new Blob([content], { type: 'text/plain' })
    }

    // Create download link
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    consolePrint(`[Downloaded ${filePath}]`)
  } catch (err) {
    consolePrint(`[Error downloading file: ${err.message}]`)
  }
}

async function handleUploadFile() {
  const fileInput = document.getElementById('file-upload-input')

  // Reset the input
  fileInput.value = ''

  // Set up one-time change handler
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const cwd = fs.pwd()
      const filePath = `${cwd}/${file.name}`.replace('//', '/')

      // Read file content
      const arrayBuffer = await file.arrayBuffer()

      // Determine if it's a text or binary file based on extension
      const isText = file.name.match(/\.(asm|txt|cells)$/i)

      let content
      if (isText) {
        const decoder = new TextDecoder('utf-8')
        content = decoder.decode(arrayBuffer)
      } else {
        content = arrayBuffer
      }

      // Save to file system
      await fs.writeFile(filePath, content)

      consolePrint(`[Uploaded ${file.name} to ${filePath}]`)

      // Expand parent folder and refresh
      const parentDir = fs.dirname(filePath)
      if (parentDir !== '/') {
        expandedFolders.add(parentDir)
      }
      await renderFileList()
    } catch (err) {
      consolePrint(`[Error uploading file: ${err.message}]`)
      alert(err.message)
    }

    // Remove the event listener
    fileInput.removeEventListener('change', handleFileSelect)
  }

  fileInput.addEventListener('change', handleFileSelect)
  fileInput.click()
}

async function handleNewFolder() {
  const cwd = fs.pwd()
  const folderName = prompt(`Enter folder name (will be created in ${cwd}):`)
  if (!folderName) return

  try {
    const folderPath = folderName.startsWith('/') ? folderName : `${cwd}/${folderName}`.replace('//', '/')
    await fs.mkdir(folderPath)
    consolePrint(`[Created directory ${folderPath}]`)

    // Expand parent folder and refresh
    const parentDir = fs.dirname(folderPath)
    if (parentDir !== '/') {
      expandedFolders.add(parentDir)
    }
    expandedFolders.add(folderPath)
    await renderFileList()
  } catch (err) {
    consolePrint(`[Error creating folder: ${err.message}]`)
    alert(err.message)
  }
}

async function handleDelete() {
  const cwd = fs.pwd()
  const path = selectedFile || cwd

  if (path === '/') {
    alert('Cannot delete root directory')
    return
  }

  if (!confirm(`Delete ${path} and all its contents?`)) {
    return
  }

  try {
    const stat = await fs.stat(path)
    if (stat.type === 'directory') {
      await fs.rmdirRecursive(path)
      consolePrint(`[Deleted directory ${path}]`)
      expandedFolders.delete(path)
    } else {
      await fs.deleteFile(path)
      consolePrint(`[Deleted file ${path}]`)
    }

    // Close editor if the deleted item was open
    if (isInEditorMode && selectedFile === path) {
      await handleBack()
    }

    selectedFile = null
    await renderFileList()
  } catch (err) {
    consolePrint(`[Error deleting: ${err.message}]`)
    alert(err.message)
  }
}

let zipUploadMode = null

async function handleUploadZipMerge() {
  zipUploadMode = 'merge'
  document.getElementById('zip-upload-input').click()
}

async function handleUploadZipReplace() {
  zipUploadMode = 'replace'
  document.getElementById('zip-upload-input').click()
}

async function handleDownloadZip() {
  try {
    const cwd = fs.pwd()
    const zip = new JSZip()

    // Get all entries under the current directory
    const entries = await fs.getAllEntriesUnder(cwd)

    // Add files to zip
    for (const entry of entries) {
      if (entry.type === 'file') {
        // Make path relative to cwd
        let relativePath = entry.path
        if (cwd !== '/') {
          relativePath = entry.path.substring(cwd.length + 1)
        } else {
          relativePath = entry.path.substring(1)
        }

        if (relativePath) {
          zip.file(relativePath, entry.content)
        }
      }
    }

    // Generate zip file
    const content = await zip.generateAsync({ type: 'blob' })

    // Download
    const downloadName = cwd === '/' ? 'filesystem.zip' : `${fs.basename(cwd)}.zip`
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    a.click()
    URL.revokeObjectURL(url)

    consolePrint(`[Downloaded ${downloadName}]`)
  } catch (err) {
    consolePrint(`[Error creating zip: ${err.message}]`)
    alert(err.message)
  }
}

// Folder-specific versions of zip handlers
let folderZipUploadPath = null
let folderZipUploadMode = null

async function handleFolderUploadZipMerge(folderPath) {
  folderZipUploadPath = folderPath
  folderZipUploadMode = 'merge'
  document.getElementById('zip-upload-input').click()
}

async function handleFolderUploadZipReplace(folderPath) {
  folderZipUploadPath = folderPath
  folderZipUploadMode = 'replace'
  document.getElementById('zip-upload-input').click()
}

async function handleFolderDownloadZip(folderPath) {
  try {
    const zip = new JSZip()

    // Get all entries under the folder
    const entries = await fs.getAllEntriesUnder(folderPath)

    // Add files to zip
    for (const entry of entries) {
      if (entry.type === 'file') {
        // Make path relative to folder
        let relativePath = entry.path.substring(folderPath.length + 1)
        if (relativePath) {
          zip.file(relativePath, entry.content)
        }
      }
    }

    // Generate zip file
    const content = await zip.generateAsync({ type: 'blob' })

    // Download
    const downloadName = `${fs.basename(folderPath)}.zip`
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    a.click()
    URL.revokeObjectURL(url)

    consolePrint(`[Downloaded ${downloadName}]`)
  } catch (err) {
    consolePrint(`[Error creating zip: ${err.message}]`)
    alert(err.message)
  }
}

async function handleResetFileSystem() {
  if (!confirm('Reset file system to default examples? This will delete all your files!')) {
    consolePrint('Reset cancelled.')
    return
  }

  try {
    consolePrint('Resetting file system...')

    // Close existing filesystem connection if it exists
    if (fs && fs.db) {
      consolePrint('Closing file system connection...')
      fs.db.close()
    }

    // Delete IndexedDB database (wrap in promise)
    const dbName = 'mtmc-filesystem'
    await new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName)

      deleteRequest.onsuccess = () => {
        consolePrint('Cleared existing file system.')
        resolve()
      }

      deleteRequest.onerror = () => {
        consolePrint('Error deleting database, proceeding anyway...')
        resolve() // Resolve anyway to continue
      }

      deleteRequest.onblocked = () => {
        consolePrint('Waiting for database connections to close...')
        // Give it a moment then resolve anyway
        setTimeout(() => resolve(), 1000)
      }
    })

    // Small delay to ensure database is fully closed
    await new Promise(resolve => setTimeout(resolve, 100))

    // Recreate file system
    consolePrint('Creating new file system...')
    fs = new FileSystem()
    await fs.ready

    // Load from manifest
    consolePrint('Loading files from disk...')
    await fs.loadManifest('disk/manifest.json')

    // Reload UI
    consolePrint('Updating file browser...')
    await renderFileList()
    expandedFolders = new Set(['/'])

    consolePrint('File system reset complete!')
  } catch (err) {
    consolePrint(`Error resetting file system: ${err.message}`)
  }
}

// ============================================================================
// Assembler Integration
// ============================================================================

function handleLoadProgram() {
  const editor = getEditor()
  const source = editor ? editor.getValue() : ''

  try {
    const bytecode = assemble(source)
    const result = memory.loadBinary(bytecode)
    cpu.reset()

    // Set BK and CB from binary header
    cpu.registers.BK = result.breakPointer
    cpu.registers.CB = result.codeBase
    debugInfo = result.debugInfo

    // Update memory size dropdown if memory was resized
    const memorySelect = document.getElementById('memory-size-select')
    if (memorySelect && memorySelect.value != memory.size) {
      memorySelect.value = memory.size
    }

    // Update breakpoint PC map after loading program
    updateBreakpointPCMap()

    // Clear undo history on new program load
    undoHistory = []

    // Set AX to point to empty string at BK (no command line args from editor)
    memory.writeByte(cpu.registers.BK, 0)  // Write null terminator
    cpu.registers.AX = cpu.registers.BK
    cpu.registers.BK++  // Move BK past the null terminator

    if (debugMode) {
      consolePrint('[Assembly successful]')
      consolePrint(`[Code: 0x0020-0x${result.codeEnd.toString(16).toUpperCase()}, Data: 0x${result.codeEnd.toString(16).toUpperCase()}-0x${result.dataEnd.toString(16).toUpperCase()}]`)
      if (debugInfo) {
        consolePrint(`[Debug info: ${debugInfo.lineMap.length} lines, ${Object.keys(debugInfo.symbols).length} symbols]`)
      }
    }

    updateUI()
    updateEditorExecutionLine()  // Show initial line
  } catch (err) {
    consolePrint('[Assembly error]')
    consolePrint(err.message)
    clearExecutionLine()
  }
}

function handleRunProgram() {
  // Load the program
  handleLoadProgram()

  // Start execution
  if (!running) {
    handleRun()
  }
}

// ============================================================================
// Initialization
// ============================================================================

export async function initUI() {
  // Initialize Monaco Editor
  await initializeMonaco()

  // Set up breakpoint change callback
  setBreakpointChangeCallback(updateBreakpointPCMap)

  // Create memory
  memory = new Memory(1024)

  // Create display
  display = new Display('display-canvas')

  // Initialize file system
  fs = new FileSystem()
  await fs.ready

  // Create OS with filesystem
  os = new OS(null, memory, display, fs)

  // Create CPU with OS
  cpu = new CPU(memory, os)

  // Now set CPU reference in OS
  os.cpu = cpu

  // Set up OS callbacks
  os.setOutputCallback((text) => {
    consolePrint(text)
  })

  os.setHaltCallback(() => {
    running = false
    document.getElementById('btn-run').textContent = 'run'
    clearExecutionLine()
    if (debugMode) consolePrint('[Program exited]')
  })

  // Check if file system is empty (first time) and load from manifest
  const files = await fs.listFiles()
  if (files.length === 0) {
    consolePrint('Loading file system from disk...')
    try {
      await fs.loadManifest('disk/manifest.json')
      consolePrint('File system loaded.')
    } catch (err) {
      consolePrint(`Failed to load file system: ${err.message}`)
    }
  }

  // Load saved current working directory
  const savedCwd = await fs.getMetadata('cwd')
  if (savedCwd) {
    fs.cwd = savedCwd
  }

  // Load splash screen image
  try {
    const splashData = await fs.readFile('/img/mtmc-splash.png')
    const blob = new Blob([splashData], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    await display.loadImage(url)
    URL.revokeObjectURL(url)
  } catch (err) {
    // Splash screen is optional, don't error if missing
    console.log('Splash screen not found:', err.message)
  }

  // Wire up controls
  document.getElementById('btn-run').addEventListener('click', handleRun)
  document.getElementById('btn-step').addEventListener('click', handleStep)
  document.getElementById('btn-step-back').addEventListener('click', handleStepBack)
  document.getElementById('btn-quit').addEventListener('click', handleQuit)
  document.getElementById('btn-reset').addEventListener('click', handleReset)
  document.getElementById('speed-select').addEventListener('change', handleSpeedChange)
  document.getElementById('memory-size-select').addEventListener('change', handleMemorySizeChange)
  document.getElementById('btn-load-program').addEventListener('click', handleLoadProgram)
  document.getElementById('btn-run-program').addEventListener('click', handleRunProgram)
  document.getElementById('btn-save').addEventListener('click', saveCurrentFile)
  document.getElementById('btn-back').addEventListener('click', showExplorerView)
  document.getElementById('memory-mode-btn').addEventListener('click', toggleMemoryDisplayMode)
  document.getElementById('btn-expand-console').addEventListener('click', toggleConsoleFullscreen)
  document.getElementById('btn-expand-fs').addEventListener('click', toggleFsFullscreen)

  // File system menu dropdown
  document.getElementById('fs-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    const dropdown = document.querySelector('#fs-header .dropdown')
    document.querySelectorAll('.dropdown.show').forEach(d => {
      if (d !== dropdown) d.classList.remove('show')
    })
    dropdown.classList.toggle('show')
  })

  document.getElementById('menu-new-file').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleNewFile()
  })

  document.getElementById('menu-new-folder').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleNewFolder()
  })

  document.getElementById('menu-upload-file').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleUploadFile()
  })

  document.getElementById('menu-upload-zip-merge').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleUploadZipMerge()
  })

  document.getElementById('menu-upload-zip-replace').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleUploadZipReplace()
  })

  document.getElementById('menu-download-zip').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleDownloadZip()
  })

  document.getElementById('menu-delete').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleDelete()
  })

  document.getElementById('menu-reset-fs').addEventListener('click', (e) => {
    e.preventDefault()
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    handleResetFileSystem()
  })

  // ZIP upload handler
  document.getElementById('zip-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      // Determine target path - use folder-specific path if set, otherwise cwd
      const targetPath = folderZipUploadPath || fs.pwd()
      const mode = folderZipUploadMode || zipUploadMode

      consolePrint(`[Uploading ${file.name} to ${targetPath}...]`)

      // Read the zip file
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      // In replace mode, delete all existing content
      if (mode === 'replace') {
        consolePrint('[Replace mode: clearing existing files...]')
        const entries = await fs.getAllEntriesUnder(targetPath)
        for (const entry of entries) {
          if (entry.path !== targetPath) {
            try {
              if (entry.type === 'file') {
                await fs.deleteFile(entry.path)
              } else {
                await fs.rmdirRecursive(entry.path)
              }
            } catch (err) {
              consolePrint(`[Warning: Could not delete ${entry.path}: ${err.message}]`)
            }
          }
        }
      }

      // Extract files from zip
      let fileCount = 0
      const promises = []

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const promise = (async () => {
            const content = await zipEntry.async('string')
            const fullPath = targetPath === '/' ? `/${relativePath}` : `${targetPath}/${relativePath}`

            // Ensure parent directories exist
            const parts = fullPath.split('/').filter(p => p)
            for (let i = 0; i < parts.length - 1; i++) {
              const dirPath = '/' + parts.slice(0, i + 1).join('/')
              if (!(await fs.exists(dirPath))) {
                await fs.mkdir(dirPath)
              }
            }

            // Write the file
            await fs.writeFile(fullPath, content)
            fileCount++
          })()

          promises.push(promise)
        }
      })

      await Promise.all(promises)

      consolePrint(`[Extracted ${fileCount} files from ${file.name}]`)

      // Refresh file list
      await renderFileList()

      // Reset folder-specific upload variables
      folderZipUploadPath = null
      folderZipUploadMode = null
    } catch (err) {
      consolePrint(`[Error uploading zip: ${err.message}]`)
      alert(err.message)
    }

    // Reset the input
    e.target.value = ''
  })

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'))
    }
  })

  // Console input
  const consoleInput = document.getElementById('console-input')
  if (consoleInput) {
    consoleInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const input = consoleInput.value
        consoleInput.value = ''
        handleConsoleInput(input)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (commandHistory.length > 0) {
          if (commandHistoryIndex === commandHistory.length) {
            currentCommand = consoleInput.value
          }
          commandHistoryIndex = Math.max(0, commandHistoryIndex - 1)
          consoleInput.value = commandHistory[commandHistoryIndex]
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (commandHistoryIndex < commandHistory.length) {
          commandHistoryIndex = Math.min(commandHistory.length, commandHistoryIndex + 1)
          if (commandHistoryIndex === commandHistory.length) {
            consoleInput.value = currentCommand
          } else {
            consoleInput.value = commandHistory[commandHistoryIndex]
          }
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        await handleTabCompletion()
      }
    })

    // Focus console input when clicking on empty console area
    const consolePanel = document.getElementById('console-panel')
    if (consolePanel) {
      consolePanel.addEventListener('mousedown', (e) => {
        // Don't focus if:
        // - Clicking on a link or button
        // - Clicking on the input itself or input wrapper
        // - There's a text selection in progress
        // - Clicking on console history text (to allow selection)
        const isLink = e.target.tagName === 'A'
        const isButton = e.target.tagName === 'BUTTON'
        const isInput = e.target.id === 'console-input' ||
                       e.target.id === 'console-input-wrapper' ||
                       e.target.closest('#console-input-wrapper')
        const isHistoryText = e.target.closest('#console-history')
        const hasSelection = window.getSelection().toString().length > 0

        // Only focus if clicking on the console panel background or console div itself
        if (!isLink && !isButton && !isInput && !isHistoryText && !hasSelection) {
          // Check if we clicked on the console div or panel background
          if (e.target.id === 'console' || e.target.id === 'console-panel' ||
              e.target.closest('#console-header')) {
            e.preventDefault() // Prevent text selection on background
            consoleInput.focus()
          }
        }
      })
    }
  } else {
    console.error('Console input element not found!')
  }

  // F7 handler for step backward
  document.addEventListener('f7-pressed', () => {
    if (!isInEditorMode) return
    handleStepBack()
  })

  // F8 handler for load/step
  document.addEventListener('f8-pressed', () => {
    if (!isInEditorMode) return

    // Check if a program is loaded by checking if BK is beyond the header
    const isProgramLoaded = cpu.registers.BK > 0x20

    if (!isProgramLoaded) {
      // No program loaded, load it
      handleLoadProgram()
    } else {
      // Program is loaded, step
      handleStep()
    }
  })

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleStep()
    }
    if (e.ctrlKey && e.key === 'Enter' && isInEditorMode) {
      e.preventDefault()
      handleLoadProgram()
    }
    if (e.ctrlKey && e.key === 'r' && isInEditorMode) {
      e.preventDefault()
      handleRunProgram()
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      saveCurrentFile()
    }
  })

  // Setup Game Boy buttons
  setupGameBoyButtons()

  // Initialize display
  consolePrint('MTMC-16 x366 Emulator')
  consolePrint('Ready.')
  consolePrint('Type "help" for available commands.')
  consolePrint('')

  // Load file system and show explorer
  await renderFileList()

  // Initial UI update
  updateUI()

  // Load hello.exe by default
  try {
    await cmdLoad(['/bin/hello.exe'])
  } catch (err) {
    // hello.exe might not exist, silently continue
    console.log('Could not load hello.exe:', err)
  }
}