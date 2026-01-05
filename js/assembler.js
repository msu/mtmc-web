// x366 Assembler - Convert assembly text to bytecode
// Two-pass assembler with label resolution

import { Opcode, RegCode, RegName } from './emulator.js'

// ============================================================================
// Syscall Name Mapping
// ============================================================================

const SyscallCode = {
  'EXIT': 0,
  'PRINT_CHAR': 1,
  'PRINT_STRING': 2,
  'PRINT_INT': 3,
  'READ_CHAR': 4,
  'READ_INT': 5,
  'READ_STRING': 6,
  'ATOI': 7,
  'SBRK': 8,
  'SCREEN': 9,
  'SET_COLOR': 10,
  'DRAW_PIXEL': 11,
  'DRAW_LINE': 12,
  'DRAW_RECT': 13,
  'DRAW_CIRCLE': 14,
  'CLEAR_SCREEN': 15,
  'DRAW_TEXT': 16,
  'PAINT_DISPLAY': 17,
  'SLEEP': 18,
  'READ_FILE': 19,
  'MALLOC': 20,
  'FREE': 21,
}

// ============================================================================
// Tokenizer
// ============================================================================

export function tokenize(source) {
  const tokens = []
  const lines = source.split('\n')

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    let line = lines[lineNum].trim()

    // Remove comments (but preserve strings)
    let commentIndex = -1
    let inString = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && (i === 0 || line[i-1] !== '\\')) {
        inString = !inString
      } else if (line[i] === ';' && !inString) {
        commentIndex = i
        break
      }
    }
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex).trim()
    }

    if (line === '') continue

    // Check for label (ends with ':')
    if (line.endsWith(':')) {
      tokens.push({
        type: 'LABEL',
        value: line.slice(0, -1).trim(),
        line: lineNum + 1
      })
      continue
    }

    // Check for label on same line as instruction/directive
    const labelMatch = line.match(/^(\w+):\s+(.+)/)
    if (labelMatch) {
      tokens.push({
        type: 'LABEL',
        value: labelMatch[1],
        line: lineNum + 1
      })
      line = labelMatch[2]
    }

    // Check for .MEMORY directive
    const memoryMatch = line.match(/^\.MEMORY\s+(\d+K?)$/i)
    if (memoryMatch) {
      tokens.push({
        type: 'MEMORY',
        value: memoryMatch[1].toUpperCase(),
        line: lineNum + 1
      })
      continue
    }

    // Check for data directive (DB or DW)
    const directiveMatch = line.match(/^(DB|DW)\s+(.+)$/i)
    if (directiveMatch) {
      const directive = directiveMatch[1].toUpperCase()
      const data = directiveMatch[2].trim()
      tokens.push({
        type: 'DIRECTIVE',
        directive,
        data,
        line: lineNum + 1
      })
      continue
    }

    // Parse instruction (preserve character and string literals)
    {
      const parts = []
      let current = ''
      let inString = false
      let inChar = false

      for (let i = 0; i < line.length; i++) {
        const ch = line[i]

        if (ch === '"' && (i === 0 || line[i-1] !== '\\')) {
          inString = !inString
          current += ch
        } else if (ch === "'" && (i === 0 || line[i-1] !== '\\')) {
          inChar = !inChar
          current += ch
        } else if ((ch === ' ' || ch === '\t' || ch === ',') && !inString && !inChar) {
          if (current) {
            parts.push(current)
            current = ''
          }
        } else {
          current += ch
        }
      }
      if (current) {
        parts.push(current)
      }

      if (parts.length === 0) continue

      const instruction = parts[0].toUpperCase()
      const operands = parts.slice(1)

      tokens.push({
        type: 'INSTRUCTION',
        instruction,
        operands,
        line: lineNum + 1
      })
    }
  }

  return tokens
}

// ============================================================================
// Data Directive Parsers
// ============================================================================

function parseDataDirective(directive, data, lineNum) {
  const bytes = []

  // Parse comma-separated values
  const items = []
  let current = ''
  let inString = false
  let inChar = false
  let depth = 0

  for (let i = 0; i < data.length; i++) {
    const char = data[i]

    if (char === '"' && (i === 0 || data[i-1] !== '\\')) {
      inString = !inString
      current += char
    } else if (char === "'" && (i === 0 || data[i-1] !== '\\')) {
      inChar = !inChar
      current += char
    } else if (char === '(' && !inString && !inChar) {
      depth++
      current += char
    } else if (char === ')' && !inString && !inChar) {
      depth--
      current += char
    } else if (char === ',' && !inString && !inChar && depth === 0) {
      items.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) {
    items.push(current.trim())
  }

  // Process each item
  for (const item of items) {
    // Check for DUP (e.g., "256 DUP(0)")
    const dupMatch = item.match(/^(\d+)\s+DUP\s*\((.+)\)$/i)
    if (dupMatch) {
      const count = parseInt(dupMatch[1], 10)
      const value = parseDataValue(dupMatch[2].trim(), directive, lineNum)

      for (let i = 0; i < count; i++) {
        bytes.push(...value)
      }
      continue
    }

    // Regular value
    const value = parseDataValue(item, directive, lineNum)
    bytes.push(...value)
  }

  return bytes
}

function parseDataValue(item, directive, lineNum) {
  // String literal
  if (item.startsWith('"') && item.endsWith('"')) {
    const str = item.slice(1, -1)
    const bytes = []

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\\' && i + 1 < str.length) {
        // Escape sequence
        const escapes = {
          'n': 10, 't': 9, 'r': 13, '0': 0,
          '\\': 92, '"': 34, "'": 39
        }
        const next = str[i + 1]
        if (next in escapes) {
          bytes.push(escapes[next])
          i++
        } else {
          bytes.push(str.charCodeAt(i))
        }
      } else {
        bytes.push(str.charCodeAt(i))
      }
    }

    return bytes
  }

  // Character literal
  if (item.startsWith("'") && item.endsWith("'")) {
    const inner = item.slice(1, -1)
    if (inner.startsWith('\\') && inner.length === 2) {
      const escapes = {
        'n': 10, 't': 9, 'r': 13, '0': 0,
        '\\': 92, "'": 39
      }
      const escapeChar = inner[1]
      if (escapeChar in escapes) {
        const value = escapes[escapeChar]
        return directive === 'DW' ? [(value >> 8) & 0xFF, value & 0xFF] : [value & 0xFF]
      }
    }
    if (inner.length === 1) {
      const value = inner.charCodeAt(0)
      return directive === 'DW' ? [(value >> 8) & 0xFF, value & 0xFF] : [value & 0xFF]
    }
    // Invalid character literal
    const prefix = lineNum ? `Line ${lineNum}: ` : ''
    throw new Error(`${prefix}Invalid character literal: ${item}`)
  }

  // Numeric value
  let value = 0
  if (item.startsWith('0x') || item.startsWith('0X')) {
    value = parseInt(item, 16)
  } else if (item.startsWith('0b') || item.startsWith('0B')) {
    value = parseInt(item.slice(2), 2)
  } else {
    value = parseInt(item, 10)
  }

  if (directive === 'DW') {
    // Word: big-endian (high byte, low byte)
    return [(value >> 8) & 0xFF, value & 0xFF]
  } else {
    // Byte
    return [value & 0xFF]
  }
}

// ============================================================================
// Parser Helpers
// ============================================================================

function parseRegister(operand) {
  const reg = operand.toUpperCase()
  if (reg in RegCode) {
    const isByteReg = reg.endsWith('L')  // AL, BL, CL, DL, EL, FL are byte registers
    return { type: 'register', value: RegCode[reg], name: reg, isByte: isByteReg }
  }
  return null
}

function parseImmediate(operand, lineNum) {
  // Character literal: 'A' or '\n'
  if (operand.startsWith("'") && operand.endsWith("'")) {
    const inner = operand.slice(1, -1)  // Remove quotes

    // Handle escape sequences
    if (inner.startsWith('\\') && inner.length === 2) {
      const escapes = {
        'n': 10,   // newline
        't': 9,    // tab
        'r': 13,   // carriage return
        '0': 0,    // null
        '\\': 92,  // backslash
        "'": 39,   // single quote
      }
      const escapeChar = inner[1]
      if (escapeChar in escapes) {
        return { type: 'immediate', value: escapes[escapeChar] }
      }
    }

    // Regular character
    if (inner.length === 1) {
      return { type: 'immediate', value: inner.charCodeAt(0) }
    }

    const prefix = lineNum ? `Line ${lineNum}: ` : ''
    throw new Error(`${prefix}Invalid character literal: ${operand}`)
  }

  // Hex: 0x1234
  if (operand.startsWith('0x') || operand.startsWith('0X')) {
    return { type: 'immediate', value: parseInt(operand, 16) }
  }
  // Binary: 0b1010
  if (operand.startsWith('0b') || operand.startsWith('0B')) {
    return { type: 'immediate', value: parseInt(operand.slice(2), 2) }
  }
  // Decimal
  if (/^-?\d+$/.test(operand)) {
    return { type: 'immediate', value: parseInt(operand, 10) }
  }
  return null
}

function parseMemory(operand, lineNum) {
  // [0x1234] or [1234]
  const directMatch = operand.match(/^\[(.+)\]$/)
  if (directMatch) {
    const inner = directMatch[1].trim()

    // Check for indexed addressing: [BX+CX] where both are registers
    const indexedMatch = inner.match(/^(\w+)\s*\+\s*(\w+)$/)
    if (indexedMatch) {
      const baseReg = parseRegister(indexedMatch[1])
      const indexReg = parseRegister(indexedMatch[2])
      if (baseReg && indexReg) {
        return {
          type: 'memory_indexed',
          base: baseReg.value,
          index: indexReg.value
        }
      }
    }

    // Check for register+offset: [FP+4] or [FP-2]
    const regOffsetMatch = inner.match(/^(\w+)\s*([+-])\s*(\d+)$/)
    if (regOffsetMatch) {
      const baseReg = parseRegister(regOffsetMatch[1])
      if (baseReg) {
        const offset = parseInt(regOffsetMatch[3], 10)
        const actualOffset = regOffsetMatch[2] === '-' ? -offset : offset
        return {
          type: 'memory_relative',
          base: baseReg.value,
          offset: actualOffset
        }
      }
    }

    // Check for just register: [AX]
    const reg = parseRegister(inner)
    if (reg) {
      return { type: 'memory_indirect', base: reg.value }
    }

    // Direct address
    const addr = parseImmediate(inner, lineNum)
    if (addr) {
      return { type: 'memory_direct', address: addr.value }
    }

    // Label reference
    return { type: 'memory_label', label: inner }
  }

  return null
}

function parseOperand(operand, lineNum) {
  operand = operand.trim()

  // Try register
  const reg = parseRegister(operand)
  if (reg) return reg

  // Try memory
  const mem = parseMemory(operand, lineNum)
  if (mem) return mem

  // Try immediate
  const imm = parseImmediate(operand, lineNum)
  if (imm) return imm

  // Must be a label
  return { type: 'label', name: operand }
}

// ============================================================================
// Instruction Encoder
// ============================================================================

function encodeInstruction(instruction, operands, labels, currentAddress, lineNum) {
  const bytes = []

  // Helper to add line context to errors
  const throwError = (msg) => {
    throw new Error(`Line ${lineNum}: ${msg}`)
  }

  // Helper to format operand for error messages
  const formatOperand = (op) => {
    if (!op) return 'undefined'
    switch (op.type) {
      case 'register': return RegName[op.value] || `R${op.value}`
      case 'immediate': return `${op.value}`
      case 'label': return op.name
      case 'memory_direct': return `[0x${op.address.toString(16)}]`
      case 'memory_indirect': return `[${RegName[op.base] || `R${op.base}`}]`
      case 'memory_relative': return `[${RegName[op.base] || `R${op.base}`}${op.offset >= 0 ? '+' : ''}${op.offset}]`
      case 'memory_indexed': return `[${RegName[op.base] || `R${op.base}`}+${RegName[op.index] || `R${op.index}`}]`
      case 'memory_label': return `[${op.label}]`
      default: return JSON.stringify(op)
    }
  }

  // Helper to resolve label to address
  const resolveLabel = (labelName) => {
    if (labelName in labels) {
      return labels[labelName]
    }
    throwError(`Undefined label: ${labelName}`)
  }

  // Helper to encode 2-byte instruction
  const encode2Byte = (opcode, param) => {
    bytes.push(opcode, param & 0xFF)
  }

  // Helper to encode 4-byte instruction
  const encode4Byte = (opcode, byte1, byte2, byte3) => {
    bytes.push(opcode, byte1 & 0xFF, byte2 & 0xFF, byte3 & 0xFF)
  }

  const ops = operands.map(op => parseOperand(op, lineNum))

  switch (instruction) {
    case 'NOP':
      encode2Byte(Opcode.NOP, 0)
      break

    case 'HLT':
    case 'HALT':
      encode2Byte(Opcode.HLT, 0)
      break

    // MOV variations
    case 'MOV': {
      let dst = ops[0]
      let src = ops[1]

      // Resolve label to immediate value
      if (src.type === 'label') {
        src = { type: 'immediate', value: resolveLabel(src.name) }
      }

      // Resolve memory_label to memory_direct
      if (src.type === 'memory_label') {
        src = { type: 'memory_direct', address: resolveLabel(src.label) }
      }
      if (dst.type === 'memory_label') {
        dst = { type: 'memory_direct', address: resolveLabel(dst.label) }
      }

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.MOV_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.MOV_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_direct') {
        const addr = src.address & 0xFFFF
        // Use LOADB for byte registers, LOAD for word registers
        const opcode = dst.isByte ? Opcode.LOADB : Opcode.LOAD
        encode4Byte(opcode, dst.value, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (dst.type === 'memory_direct' && src.type === 'register') {
        const addr = dst.address & 0xFFFF
        // Use STOREB for byte registers, STORE for word registers
        const opcode = src.isByte ? Opcode.STOREB : Opcode.STORE
        encode4Byte(opcode, src.value, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (dst.type === 'memory_direct' && src.type === 'immediate') {
        // MOV [addr], imm -> STOREI_DIRECT (4-byte, immediate must fit in 8 bits)
        const addr = dst.address & 0xFFFF
        const imm = src.value
        if (imm < 0 || imm > 255) {
          throwError(`MOV [addr], imm requires immediate value 0-255, got ${imm}. Use: MOV reg, ${imm}; MOV ${formatOperand(dst)}, reg`)
        }
        encode4Byte(Opcode.STOREI_DIRECT, (addr >> 8) & 0xFF, addr & 0xFF, imm & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_indirect') {
        // MOV AX, [BX] -> LOADR with offset 0
        // MOV AL, [BX] -> LOADBR with offset 0 (byte load)
        const opcode = dst.isByte ? Opcode.LOADBR : Opcode.LOADR
        encode4Byte(opcode, dst.value, src.base, 0)
      } else if (dst.type === 'memory_indirect' && src.type === 'register') {
        // MOV [BX], AX -> STORER with offset 0
        // MOV [BX], AL -> STOREBR with offset 0 (byte store)
        const opcode = src.isByte ? Opcode.STOREBR : Opcode.STORER
        encode4Byte(opcode, src.value, dst.base, 0)
      } else if (dst.type === 'memory_indirect' && src.type === 'immediate') {
        // MOV [BX], 42 -> STOREI
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.STOREI, dst.base, (imm >> 8) & 0xFF, imm & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_relative') {
        const opcode = dst.isByte ? Opcode.LOADBR : Opcode.LOADR
        encode4Byte(opcode, dst.value, src.base, src.offset & 0xFF)
      } else if (dst.type === 'memory_relative' && src.type === 'register') {
        // MOV [BX+offset], AX -> STORER
        // MOV [BX+offset], AL -> STOREBR (byte store)
        const opcode = src.isByte ? Opcode.STOREBR : Opcode.STORER
        encode4Byte(opcode, src.value, dst.base, dst.offset & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_indexed') {
        // MOV AX, [BX+CX] -> LOAD_INDEXED
        encode4Byte(Opcode.LOAD_INDEXED, dst.value, src.base, src.index)
      } else if (dst.type === 'memory_indexed' && src.type === 'register') {
        // MOV [BX+CX], AX -> STORE_INDEXED
        encode4Byte(Opcode.STORE_INDEXED, src.value, dst.base, dst.index)
      } else {
        throwError(`Invalid MOV operands: MOV ${formatOperand(dst)}, ${formatOperand(src)}`)
      }
      break
    }

    // LEA - Load Effective Address
    case 'LEA': {
      const dst = ops[0]
      const src = ops[1]

      if (dst.type === 'register' && src.type === 'memory_relative') {
        // LEA AX, [FP+4] -> LEA
        encode4Byte(Opcode.LEA, dst.value, src.base, src.offset & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_indirect') {
        // LEA AX, [BX] -> LEA with offset 0
        encode4Byte(Opcode.LEA, dst.value, src.base, 0)
      } else {
        throwError(`Invalid LEA operands (must be: LEA reg, [reg+offset])`)
      }
      break
    }

    // Arithmetic - ADD
    case 'ADD': {
      let dst = ops[0]
      let src = ops[1]

      // Resolve memory_label to memory_direct
      if (src.type === 'memory_label') {
        src = { type: 'memory_direct', address: resolveLabel(src.label) }
      }

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.ADD_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.ADD_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_direct') {
        // ADD AX, [0x200] -> ADD_MEM
        const addr = src.address & 0xFFFF
        encode4Byte(Opcode.ADD_MEM, dst.value, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_relative') {
        // ADD AX, [FP+4] -> ADD_MEMR
        encode4Byte(Opcode.ADD_MEMR, dst.value, src.base, src.offset & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_indirect') {
        // ADD AX, [BX] -> ADD_MEMR with offset 0
        encode4Byte(Opcode.ADD_MEMR, dst.value, src.base, 0)
      } else {
        throwError(`Invalid ADD operands`)
      }
      break
    }

    // Arithmetic - SUB
    case 'SUB': {
      let dst = ops[0]
      let src = ops[1]

      // Resolve memory_label to memory_direct
      if (src.type === 'memory_label') {
        src = { type: 'memory_direct', address: resolveLabel(src.label) }
      }

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.SUB_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.SUB_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_direct') {
        // SUB AX, [0x200] -> SUB_MEM
        const addr = src.address & 0xFFFF
        encode4Byte(Opcode.SUB_MEM, dst.value, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_relative') {
        // SUB AX, [FP+4] -> SUB_MEMR
        encode4Byte(Opcode.SUB_MEMR, dst.value, src.base, src.offset & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_indirect') {
        // SUB AX, [BX] -> SUB_MEMR with offset 0
        encode4Byte(Opcode.SUB_MEMR, dst.value, src.base, 0)
      } else {
        throwError(`Invalid SUB operands`)
      }
      break
    }

    // INC
    case 'INC': {
      // Resolve memory_label to memory_direct
      if (ops[0].type === 'memory_label') {
        ops[0] = { type: 'memory_direct', address: resolveLabel(ops[0].label) }
      }

      if (ops[0].type === 'register') {
        encode2Byte(Opcode.INC_REG, ops[0].value)
      } else if (ops[0].type === 'memory_direct') {
        // INC [0x200] -> INC_MEM
        const addr = ops[0].address & 0xFFFF
        encode4Byte(Opcode.INC_MEM, 0, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (ops[0].type === 'memory_relative') {
        // INC [FP+4] -> INC_MEMR
        encode4Byte(Opcode.INC_MEMR, 0, ops[0].base, ops[0].offset & 0xFF)
      } else if (ops[0].type === 'memory_indirect') {
        // INC [BX] -> INC_MEMR with offset 0
        encode4Byte(Opcode.INC_MEMR, 0, ops[0].base, 0)
      } else {
        throwError(`Invalid INC operand`)
      }
      break
    }

    // DEC
    case 'DEC': {
      // Resolve memory_label to memory_direct
      if (ops[0].type === 'memory_label') {
        ops[0] = { type: 'memory_direct', address: resolveLabel(ops[0].label) }
      }

      if (ops[0].type === 'register') {
        encode2Byte(Opcode.DEC_REG, ops[0].value)
      } else if (ops[0].type === 'memory_direct') {
        // DEC [0x200] -> DEC_MEM
        const addr = ops[0].address & 0xFFFF
        encode4Byte(Opcode.DEC_MEM, 0, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (ops[0].type === 'memory_relative') {
        // DEC [FP+4] -> DEC_MEMR
        encode4Byte(Opcode.DEC_MEMR, 0, ops[0].base, ops[0].offset & 0xFF)
      } else if (ops[0].type === 'memory_indirect') {
        // DEC [BX] -> DEC_MEMR with offset 0
        encode4Byte(Opcode.DEC_MEMR, 0, ops[0].base, 0)
      } else {
        throwError(`Invalid DEC operand`)
      }
      break
    }

    // MUL
    case 'MUL': {
      if (ops[0].type === 'register') {
        encode2Byte(Opcode.MUL, ops[0].value)
      } else {
        throwError(`Invalid MUL operand`)
      }
      break
    }

    // DIV
    case 'DIV': {
      if (ops[0].type === 'register') {
        encode2Byte(Opcode.DIV, ops[0].value)
      } else {
        throwError(`Invalid DIV operand`)
      }
      break
    }

    // CMP
    case 'CMP': {
      let dst = ops[0]
      let src = ops[1]

      // Resolve memory_label to memory_direct
      if (src.type === 'memory_label') {
        src = { type: 'memory_direct', address: resolveLabel(src.label) }
      }

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.CMP_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.CMP_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_direct') {
        // CMP AX, [0x200] -> CMP_MEM
        const addr = src.address & 0xFFFF
        encode4Byte(Opcode.CMP_MEM, dst.value, (addr >> 8) & 0xFF, addr & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_relative') {
        // CMP AX, [FP+4] -> CMP_MEMR
        encode4Byte(Opcode.CMP_MEMR, dst.value, src.base, src.offset & 0xFF)
      } else if (dst.type === 'register' && src.type === 'memory_indirect') {
        // CMP AX, [BX] -> CMP_MEMR with offset 0
        encode4Byte(Opcode.CMP_MEMR, dst.value, src.base, 0)
      } else {
        throwError(`Invalid CMP operands`)
      }
      break
    }

    // Jumps
    case 'JMP': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JMP, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'JE':
    case 'JZ': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JE, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'JNE':
    case 'JNZ': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JNE, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'JL': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JL, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'JG': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JG, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'JLE': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JLE, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'JGE': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.JGE, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'LOOP': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.LOOP, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    // Stack
    case 'PUSH': {
      if (ops[0].type === 'register') {
        encode2Byte(Opcode.PUSH, ops[0].value)
      } else {
        throwError(`Invalid PUSH operand`)
      }
      break
    }

    case 'POP': {
      if (ops[0].type === 'register') {
        encode2Byte(Opcode.POP, ops[0].value)
      } else {
        throwError(`Invalid POP operand`)
      }
      break
    }

    // Call/Return
    case 'CALL': {
      const target = ops[0].type === 'label' ? resolveLabel(ops[0].name) : ops[0].value
      encode4Byte(Opcode.CALL, 0, (target >> 8) & 0xFF, target & 0xFF)
      break
    }

    case 'RET': {
      encode2Byte(Opcode.RET, 0)
      break
    }

    // Logical
    case 'AND': {
      const dst = ops[0]
      const src = ops[1]

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.AND_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.AND_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else {
        throwError(`Invalid AND operands`)
      }
      break
    }

    case 'OR': {
      const dst = ops[0]
      const src = ops[1]

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.OR_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.OR_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else {
        throwError(`Invalid OR operands`)
      }
      break
    }

    case 'XOR': {
      const dst = ops[0]
      const src = ops[1]

      if (dst.type === 'register' && src.type === 'register') {
        encode4Byte(Opcode.XOR_REG_REG, dst.value, src.value, 0)
      } else if (dst.type === 'register' && src.type === 'immediate') {
        const imm = src.value & 0xFFFF
        encode4Byte(Opcode.XOR_REG_IMM, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else {
        throwError(`Invalid XOR operands`)
      }
      break
    }

    case 'NOT': {
      if (ops[0].type === 'register') {
        encode2Byte(Opcode.NOT, ops[0].value)
      } else {
        throwError(`Invalid NOT operand`)
      }
      break
    }

    case 'SHL': {
      const dst = ops[0]
      // Default count to 1 if not provided (x86 compatible)
      const count = ops[1] || { type: 'immediate', value: 1 }
      if (dst.type === 'register' && count.type === 'immediate') {
        const imm = count.value & 0xFFFF
        encode4Byte(Opcode.SHL, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else {
        throwError(`Invalid SHL operands`)
      }
      break
    }

    case 'SHR': {
      const dst = ops[0]
      // Default count to 1 if not provided (x86 compatible)
      const count = ops[1] || { type: 'immediate', value: 1 }
      if (dst.type === 'register' && count.type === 'immediate') {
        const imm = count.value & 0xFFFF
        encode4Byte(Opcode.SHR, dst.value, (imm >> 8) & 0xFF, imm & 0xFF)
      } else {
        throwError(`Invalid SHR operands`)
      }
      break
    }

    // System calls
    case 'SYSCALL': {
      let syscallCode
      if (ops[0].type === 'immediate') {
        syscallCode = ops[0].value
      } else if (ops[0].type === 'label') {
        // Check if it's a syscall name
        const syscallName = ops[0].name.toUpperCase()
        if (syscallName in SyscallCode) {
          syscallCode = SyscallCode[syscallName]
        } else {
          throwError(`Unknown syscall name: ${ops[0].name}`)
        }
      } else {
        throwError(`Invalid SYSCALL operand (must be immediate or syscall name)`)
      }
      encode2Byte(Opcode.SYSCALL, syscallCode)
      break
    }

    default:
      throwError(`Unknown instruction: ${instruction}`)
  }

  return bytes
}

// ============================================================================
// Two-Pass Assembler
// ============================================================================

export function assemble(source) {
  const tokens = tokenize(source)
  const labels = {}
  const instructions = []
  const directives = []
  let memorySize = 0x0400  // Default 1KB

  // Parse .MEMORY directive first
  for (const token of tokens) {
    if (token.type === 'MEMORY') {
      const value = token.value
      const sizeMap = {
        '1K': 1024,
        '2K': 2048,
        '4K': 4096,
        '8K': 8192,
        '16K': 16384
      }
      if (!(value in sizeMap)) {
        throw new Error(`Invalid memory size: ${value}. Must be one of: 1K, 2K, 4K, 8K, 16K`)
      }
      memorySize = sizeMap[value]
      break  // Only process the first .MEMORY directive
    }
  }

  // Pass 1: Separate code and data, assign addresses
  // Code segment starts at 0x0020
  let codeAddress = 0x0020

  // First, process all instructions and assign code labels
  for (const token of tokens) {
    if (token.type === 'INSTRUCTION') {
      instructions.push({ ...token, address: codeAddress })

      // Determine instruction size
      const inst = token.instruction
      const ops = token.operands

      // Check if instruction is 2-byte or 4-byte
      // INC/DEC with memory operands are 4-byte, with register operands are 2-byte
      let size = 2  // Default to 2-byte

      if (['INC', 'DEC'].includes(inst) && ops.length > 0) {
        // Check if operand is memory reference (contains '[')
        const hasMemoryOperand = ops[0].includes('[')
        size = hasMemoryOperand ? 4 : 2
      } else if (['NOP', 'HLT', 'HALT', 'RET', 'MUL', 'DIV',
                  'PUSH', 'POP', 'NOT', 'SYSCALL'].includes(inst)) {
        size = 2
      } else {
        size = 4
      }

      codeAddress += size
    }
  }

  // Data segment starts after code
  let dataAddress = codeAddress

  // Now process directives and labels
  let pendingLabels = []
  for (const token of tokens) {
    if (token.type === 'LABEL') {
      pendingLabels.push(token.value)
    } else if (token.type === 'DIRECTIVE') {
      // This is a data directive - place in data segment
      const bytes = parseDataDirective(token.directive, token.data, token.line)

      // If there are pending labels, assign them all to this data address
      for (const label of pendingLabels) {
        labels[label] = dataAddress
      }
      pendingLabels = []

      directives.push({ ...token, address: dataAddress, bytes })
      dataAddress += bytes.length
    } else if (token.type === 'INSTRUCTION') {
      // This is an instruction - labels go to code address
      if (pendingLabels.length > 0) {
        // Find this instruction in our instructions array
        const instr = instructions.find(i => i.line === token.line)
        if (instr) {
          for (const label of pendingLabels) {
            labels[label] = instr.address
          }
        }
        pendingLabels = []
      }
    }
  }

  // Pass 2: Generate bytecode
  const bytecode = []
  const lineMap = []  // Array of {pc, line} objects

  // Emit data directives
  for (const dir of directives) {
    for (let i = 0; i < dir.bytes.length; i++) {
      bytecode[dir.address + i] = dir.bytes[i]
    }
    // Add to line map
    lineMap.push({ pc: dir.address, line: dir.line })
  }

  // Encode instructions and build line map
  for (const instr of instructions) {
    const bytes = encodeInstruction(instr.instruction, instr.operands, labels, instr.address, instr.line)

    for (let i = 0; i < bytes.length; i++) {
      bytecode[instr.address + i] = bytes[i]
    }

    // Add to line map (PC → source line)
    lineMap.push({ pc: instr.address, line: instr.line })
  }

  // Calculate memory layout
  const codeEnd = codeAddress      // End of code segment
  const dataEnd = dataAddress      // End of data segment (also the break pointer)
  const sectionsOffset = dataEnd   // Sections start after data

  // Generate debug info section
  const debugSection = generateDebugSection(lineMap, labels)

  // Generate sections area
  const sections = []

  // Section 0x01: Debug Info
  sections.push(0x01)  // Section type
  const debugSize = debugSection.length
  sections.push((debugSize >> 24) & 0xFF)  // Size (32-bit big-endian)
  sections.push((debugSize >> 16) & 0xFF)
  sections.push((debugSize >> 8) & 0xFF)
  sections.push(debugSize & 0xFF)
  sections.push(...debugSection)

  // Section 0x00: End marker
  sections.push(0x00)  // Type
  sections.push(0x00, 0x00, 0x00, 0x00)  // Size = 0

  // Write header (new format)
  const header = []

  // 0x0000-0x0007: Signature "Go Cats!"
  const signature = 'Go Cats!'
  for (let i = 0; i < signature.length; i++) {
    header[i] = signature.charCodeAt(i)
  }

  // 0x0008: Padding
  header[0x0008] = 0x00

  // 0x0009-0x000A: Memory size (big-endian)
  header[0x0009] = (memorySize >> 8) & 0xFF
  header[0x000A] = memorySize & 0xFF

  // 0x000B: Padding
  header[0x000B] = 0x00

  // 0x000C-0x000F: Sections offset (big-endian, 32-bit)
  header[0x000C] = (sectionsOffset >> 24) & 0xFF
  header[0x000D] = (sectionsOffset >> 16) & 0xFF
  header[0x000E] = (sectionsOffset >> 8) & 0xFF
  header[0x000F] = sectionsOffset & 0xFF

  // 0x0010-0x0011: Break pointer (BK) - end of data segment (big-endian, 16-bit)
  header[0x0010] = (dataEnd >> 8) & 0xFF
  header[0x0011] = dataEnd & 0xFF

  // 0x0012-0x0013: Code boundary (CB) - end of code segment (big-endian, 16-bit)
  header[0x0012] = (codeEnd >> 8) & 0xFF
  header[0x0013] = codeEnd & 0xFF

  // 0x0014-0x001F: Reserved (zeros)
  for (let i = 0x0014; i < 0x0020; i++) {
    header[i] = 0x00
  }

  // Combine: header + code + sections
  const binary = new Uint8Array(sectionsOffset + sections.length)

  // Copy header
  for (let i = 0; i < header.length; i++) {
    binary[i] = header[i]
  }

  // Copy code
  for (let i = 0x0020; i < sectionsOffset; i++) {
    binary[i] = bytecode[i] || 0
  }

  // Copy sections
  for (let i = 0; i < sections.length; i++) {
    binary[sectionsOffset + i] = sections[i]
  }

  return binary
}

// ============================================================================
// Debug Info Generation
// ============================================================================

function generateDebugSection(lineMap, labels) {
  const section = []

  // Write line map
  for (const entry of lineMap) {
    // PC address (big-endian, 16-bit)
    section.push((entry.pc >> 8) & 0xFF)
    section.push(entry.pc & 0xFF)

    // Line number (big-endian, 16-bit)
    section.push((entry.line >> 8) & 0xFF)
    section.push(entry.line & 0xFF)
  }

  // End marker for line map
  section.push(0xFF, 0xFF, 0x00, 0x00)

  // Write symbol table
  for (const [name, addr] of Object.entries(labels)) {
    // Address (big-endian, 16-bit)
    section.push((addr >> 8) & 0xFF)
    section.push(addr & 0xFF)

    // Symbol type (0x00 = label)
    section.push(0x00)

    // Symbol name (null-terminated ASCII)
    for (let i = 0; i < name.length; i++) {
      section.push(name.charCodeAt(i))
    }
    section.push(0x00)  // Null terminator
  }

  // End marker for symbol table
  section.push(0xFF, 0xFF, 0x00, 0x00)

  return section
}