// x366 Emulator - CPU, Memory, Registers
// 16-bit x86-like architecture

// ============================================================================
// Instruction Opcodes
// ============================================================================

export const Opcode = {
  // System
  NOP: 0x00,
  HLT: 0x01,

  // Data Movement
  MOV_REG_REG: 0x10,
  MOV_REG_IMM: 0x11,
  LOAD: 0x12,          // MOV reg, [addr]
  STORE: 0x13,         // MOV [addr], reg
  LOADR: 0x14,         // MOV reg, [base+offset]
  STORER: 0x15,        // MOV [base+offset], reg
  LOADB: 0x16,         // MOV reg_byte, [addr]
  LEA: 0x17,           // LEA reg, [base+offset]
  STOREB: 0x18,        // MOV [addr], reg_byte
  LOADBR: 0x19,        // MOV reg_byte, [base+offset]
  STOREBR: 0x1A,       // MOV [base+offset], reg_byte
  STOREI: 0x1B,        // MOV [base], imm (16-bit)
  STOREI_DIRECT: 0x1C, // MOV [addr], imm (8-bit, legacy)
  INC_MEM: 0x1D,       // INC [addr]
  DEC_MEM: 0x1E,       // DEC [addr]
  INC_MEMR: 0x1F,      // INC [base+offset]

  // Arithmetic
  ADD_REG_REG: 0x20,
  ADD_REG_IMM: 0x21,
  SUB_REG_REG: 0x22,
  SUB_REG_IMM: 0x23,
  INC_REG: 0x24,
  DEC_REG: 0x25,
  MUL: 0x26,
  DIV: 0x27,
  ADD_MEM: 0x28,       // ADD reg, [addr]
  ADD_MEMR: 0x29,      // ADD reg, [base+offset]
  SUB_MEM: 0x2A,       // SUB reg, [addr]
  SUB_MEMR: 0x2B,      // SUB reg, [base+offset]
  DEC_MEMR: 0x2C,      // DEC [base+offset]
  LOAD_INDEXED: 0x2D,  // MOV reg, [base+index]
  STORE_INDEXED: 0x2E, // MOV [base+index], reg

  // Logical & Bitwise
  AND_REG_REG: 0x30,
  AND_REG_IMM: 0x31,
  OR_REG_REG: 0x32,
  OR_REG_IMM: 0x33,
  XOR_REG_REG: 0x34,
  XOR_REG_IMM: 0x35,
  NOT: 0x36,
  SHL: 0x37,
  SHR: 0x38,

  // Aliases for backwards compatibility with tests
  INC: 0x24,  // Alias for INC_REG
  DEC: 0x25,  // Alias for DEC_REG
  AND_REG: 0x30,
  AND_IMM: 0x31,  // Alias for AND_REG_IMM
  OR_REG: 0x32,
  XOR_REG: 0x34,
  ADD_MEM_REL: 0x29,
  SUB_MEM_REL: 0x2B,
  INC_MEM_REL: 0x1F,
  DEC_MEM_REL: 0x2C,
  CMP_MEM_REL: 0x43,

  // Comparison & Jumps
  CMP_REG_REG: 0x40,
  CMP_REG_IMM: 0x41,
  CMP_MEM: 0x42,       // CMP reg, [addr]
  CMP_MEMR: 0x43,      // CMP reg, [base+offset]
  JMP: 0x50,
  JE: 0x51,
  JNE: 0x52,
  JL: 0x53,
  JG: 0x54,
  JLE: 0x55,
  JGE: 0x56,
  LOOP: 0x57,

  // Stack & Functions
  PUSH: 0x60,
  POP: 0x61,
  CALL: 0x70,
  RET: 0x71,

  // System Calls
  SYSCALL: 0x90,
}

export const Syscall = {
  EXIT: 0,
  PRINT_CHAR: 1,
  PRINT_STRING: 2,
  PRINT_INT: 3,
  READ_CHAR: 4,
  READ_INT: 5,
  READ_STRING: 6,
  ATOI: 7,
  SBRK: 8,
  SCREEN: 9,
  SET_COLOR: 10,
  DRAW_PIXEL: 11,
  DRAW_LINE: 12,
  DRAW_RECT: 13,
  DRAW_CIRCLE: 14,
  CLEAR_SCREEN: 15,
  DRAW_TEXT: 16,
  PAINT_DISPLAY: 17,
  SLEEP: 18,
  READ_FILE: 19,
  MALLOC: 20,
  FREE: 21,
}

// Register name to code mapping
export const RegCode = {
  AX: 0, BX: 1, CX: 2, DX: 3,
  EX: 4, FX: 5, SP: 6, FP: 7,
  AL: 0, BL: 1, CL: 2, DL: 3,
  EL: 4, FL: 5,
}

// Code to register name mapping
export const RegName = ['AX', 'BX', 'CX', 'DX', 'EX', 'FX', 'SP', 'FP']

// ============================================================================
// Registers
// ============================================================================

export class Registers {
  constructor() {
    // General purpose registers (16-bit)
    this.AX = 0
    this.BX = 0
    this.CX = 0
    this.DX = 0
    this.EX = 0
    this.FX = 0

    // Special purpose registers
    this.SP = 0  // Stack Pointer
    this.FP = 0  // Frame Pointer
    this.BK = 0  // Break Pointer (end of heap)
    this.PC = 0  // Program Counter

    // Internal registers (not user-accessible)
    this.CB = 0  // Code Boundary (end of code segment)
    this.IR = 0  // Instruction Register (first word of current instruction)
    this.DR = 0  // Data Register (second word of current instruction, if any)

    // Flags
    this.ZF = 0  // Zero Flag
    this.SF = 0  // Sign Flag
    this.CF = 0  // Carry Flag
    this.OF = 0  // Overflow Flag
  }

  /**
   * Get register value by name
   * Supports: AX, BX, CX, DX, EX, FX, AL, BL, CL, DL, EL, FL, SP, FP, BK, PC
   */
  get(name) {
    name = name.toUpperCase()

    // Byte registers (low byte access)
    if (name === 'AL') return this.AX & 0xFF
    if (name === 'BL') return this.BX & 0xFF
    if (name === 'CL') return this.CX & 0xFF
    if (name === 'DL') return this.DX & 0xFF
    if (name === 'EL') return this.EX & 0xFF
    if (name === 'FL') return this.FX & 0xFF

    // Word registers
    if (name in this) {
      return this[name] & 0xFFFF  // Ensure 16-bit
    }

    throw new Error(`Unknown register: ${name}`)
  }

  /**
   * Set register value by name
   * Supports: AX, BX, CX, DX, EX, FX, AL, BL, CL, DL, EL, FL, SP, FP, BK, PC
   */
  set(name, value) {
    name = name.toUpperCase()

    // Byte registers (set low byte only)
    if (name === 'AL') {
      this.AX = (this.AX & 0xFF00) | (value & 0xFF)
      return
    }
    if (name === 'BL') {
      this.BX = (this.BX & 0xFF00) | (value & 0xFF)
      return
    }
    if (name === 'CL') {
      this.CX = (this.CX & 0xFF00) | (value & 0xFF)
      return
    }
    if (name === 'DL') {
      this.DX = (this.DX & 0xFF00) | (value & 0xFF)
      return
    }
    if (name === 'EL') {
      this.EX = (this.EX & 0xFF00) | (value & 0xFF)
      return
    }
    if (name === 'FL') {
      this.FX = (this.FX & 0xFF00) | (value & 0xFF)
      return
    }

    // Word registers
    if (name in this) {
      this[name] = value & 0xFFFF  // Ensure 16-bit
      return
    }

    throw new Error(`Unknown register: ${name}`)
  }

  /**
   * Get all flags as object
   */
  getFlags() {
    return {
      ZF: this.ZF,
      SF: this.SF,
      CF: this.CF,
      OF: this.OF,
    }
  }

  /**
   * Set flags from object
   */
  setFlags({ ZF, SF, CF, OF }) {
    if (ZF !== undefined) this.ZF = ZF ? 1 : 0
    if (SF !== undefined) this.SF = SF ? 1 : 0
    if (CF !== undefined) this.CF = CF ? 1 : 0
    if (OF !== undefined) this.OF = OF ? 1 : 0
  }

  /**
   * Update flags based on result
   */
  updateFlags(result, bits = 16) {
    const mask = bits === 16 ? 0xFFFF : 0xFF
    const signBit = bits === 16 ? 0x8000 : 0x80

    result = result & mask

    this.ZF = result === 0 ? 1 : 0
    this.SF = (result & signBit) !== 0 ? 1 : 0

    return result
  }

  /**
   * Reset all registers to initial state
   */
  reset(memorySize = 0x0400) {
    this.AX = 0
    this.BX = 0
    this.CX = 0
    this.DX = 0
    this.EX = 0
    this.FX = 0
    this.SP = memorySize  // Stack starts at end of memory
    this.FP = 0
    this.BK = 0x0020      // Break pointer starts after header
    this.PC = 0x0020      // Code starts at 0x0020
    this.CB = 0x0020      // Code boundary starts at same place
    this.IR = 0           // Instruction register
    this.DR = 0           // Data register
    this.ZF = 0
    this.SF = 0
    this.CF = 0
    this.OF = 0
  }
}

// ============================================================================
// Memory
// ============================================================================

export class Memory {
  /**
   * Create memory with specified size
   * @param {number} size - Memory size in bytes (1024, 2048, 4096, 8192, or 16384)
   */
  constructor(size = 1024, display = null) {
    const validSizes = [1024, 2048, 4096, 8192, 16384]
    if (!validSizes.includes(size)) {
      throw new Error(`Invalid memory size: ${size}. Must be one of: ${validSizes.join(', ')}`)
    }

    this.size = size
    this.data = new Uint8Array(size)
    this.display = display

    // VRAM mapping: 0x4000-0x567F (5760 bytes)
    this.vramStart = 0x4000
    this.vramEnd = 0x567F

    // Note: Runtime memory 0x0000-0x001F is reserved and stays zero
    // The binary header is NOT loaded into runtime memory
  }

  /**
   * Validate signature in binary file (at offset 0x0000)
   */
  static validateSignature(binary) {
    const signature = 'Go Cats!'
    for (let i = 0; i < signature.length; i++) {
      if (binary[i] !== signature.charCodeAt(i)) {
        return false
      }
    }
    return true
  }

  /**
   * Read byte from memory
   */
  readByte(address) {
    // Allow VRAM access even if beyond physical memory
    if (this.display && address >= this.vramStart && address <= this.vramEnd) {
      const vramOffset = address - this.vramStart
      const vram = this.display.getVRAM()
      if (vramOffset < vram.length) {
        return vram[vramOffset]
      }
      return 0
    }

    if (address < 0 || address >= this.size) {
      throw new Error(`Memory read out of bounds: 0x${address.toString(16)}`)
    }
    return this.data[address]
  }

  /**
   * Write byte to memory
   */
  writeByte(address, value) {
    // Allow VRAM access even if beyond physical memory
    if (this.display && address >= this.vramStart && address <= this.vramEnd) {
      const vramOffset = address - this.vramStart
      const vram = this.display.getVRAM()
      if (vramOffset < vram.length) {
        vram[vramOffset] = value & 0xFF
        this.display.refresh()
      }
      return
    }

    if (address < 0 || address >= this.size) {
      throw new Error(`Memory write out of bounds: 0x${address.toString(16)}`)
    }
    this.data[address] = value & 0xFF
  }

  /**
   * Read word (16-bit) from memory (big-endian)
   */
  readWord(address) {
    // Allow VRAM access even if beyond physical memory
    if (this.display && address >= this.vramStart && address + 1 <= this.vramEnd) {
      const high = this.readByte(address)
      const low = this.readByte(address + 1)
      return (high << 8) | low
    }

    if (address < 0 || address >= this.size - 1) {
      throw new Error(`Memory read out of bounds: 0x${address.toString(16)}`)
    }
    // Big-endian: high byte first, then low byte
    const high = this.data[address]
    const low = this.data[address + 1]
    return (high << 8) | low
  }

  /**
   * Write word (16-bit) to memory (big-endian)
   */
  writeWord(address, value) {
    // Allow VRAM access even if beyond physical memory
    if (this.display && address >= this.vramStart && address + 1 <= this.vramEnd) {
      value = value & 0xFFFF
      this.writeByte(address, (value >> 8) & 0xFF)
      this.writeByte(address + 1, value & 0xFF)
      return
    }

    if (address < 0 || address >= this.size - 1) {
      throw new Error(`Memory write out of bounds: 0x${address.toString(16)}`)
    }
    value = value & 0xFFFF
    // Big-endian: high byte first, then low byte
    this.data[address] = (value >> 8) & 0xFF
    this.data[address + 1] = value & 0xFF
  }

  /**
   * Load binary data into memory at specified address
   */
  /**
   * Load binary in new X366 format
   * Returns: { codeEnd, dataEnd, breakPointer, codeBase, debugInfo }
   */
  loadBinary(binary, commandLineArg = null) {
    // Validate signature
    if (!Memory.validateSignature(binary)) {
      throw new Error('Invalid binary: signature mismatch')
    }

    // Read header
    const memorySize = (binary[0x0009] << 8) | binary[0x000A]
    const sectionsOffset = (binary[0x000C] << 24) | (binary[0x000D] << 16) |
                          (binary[0x000E] << 8) | binary[0x000F]
    const breakPointer = (binary[0x0010] << 8) | binary[0x0011]  // BK
    const codeBoundary = (binary[0x0012] << 8) | binary[0x0013]  // CB

    // Resize memory if needed
    if (memorySize !== this.size) {
      this.size = memorySize
      this.data = new Uint8Array(memorySize)
    } else {
      // Zero out all memory before loading
      this.data.fill(0)
    }

    // Zero out reserved area (0x0000-0x001F) - redundant after fill(0) but explicit
    for (let i = 0; i < 0x0020; i++) {
      this.data[i] = 0
    }

    // Load code/data from binary offset 0x0020 into runtime memory at 0x0020
    const codeEnd = sectionsOffset > 0 ? sectionsOffset : binary.length
    for (let i = 0x0020; i < codeEnd && i < this.size; i++) {
      this.data[i] = binary[i] || 0
    }

    // Parse sections if present
    let debugInfo = null
    if (sectionsOffset > 0 && sectionsOffset < binary.length) {
      debugInfo = this.parseSections(binary, sectionsOffset)
    }

    // Handle command line argument
    let commandLineAddr = 0
    if (commandLineArg !== null && commandLineArg !== undefined) {
      // Append string AFTER the entire program binary (code + data)
      commandLineAddr = binary.length
      const argBytes = new TextEncoder().encode(commandLineArg)

      // Write string to memory
      for (let i = 0; i < argBytes.length; i++) {
        this.data[commandLineAddr + i] = argBytes[i]
      }
      // Null terminator
      this.data[commandLineAddr + argBytes.length] = 0
    }

    return {
      codeEnd: codeBoundary || codeEnd,
      dataEnd: breakPointer || codeEnd,
      breakPointer: breakPointer || 0x0020,
      codeBase: codeBoundary || 0x0020,
      commandLineAddr,
      debugInfo
    }
  }

  /**
   * Parse sections from binary
   */
  parseSections(binary, offset) {
    let debugInfo = null
    let pos = offset

    while (pos < binary.length) {
      const sectionType = binary[pos]
      if (sectionType === 0x00) {
        // End of sections
        break
      }

      // Read section size (32-bit big-endian)
      const size = (binary[pos + 1] << 24) | (binary[pos + 2] << 16) |
                   (binary[pos + 3] << 8) | binary[pos + 4]
      pos += 5

      // Read section data
      const sectionData = binary.slice(pos, pos + size)
      pos += size

      // Handle section based on type
      if (sectionType === 0x01) {
        // Debug Info
        debugInfo = this.parseDebugSection(sectionData)
      }
      // Other section types can be added here
    }

    return debugInfo
  }

  /**
   * Parse debug info section
   */
  parseDebugSection(data) {
    const lineMap = []  // Array of {pc, line}
    const symbols = {}  // Map of name → address
    let pos = 0

    // Parse source filename (null-terminated string)
    let sourceFilename = ''
    while (pos < data.length && data[pos] !== 0) {
      sourceFilename += String.fromCharCode(data[pos])
      pos++
    }
    pos++  // Skip null terminator

    // Parse line map
    while (pos < data.length - 3) {
      const pc = (data[pos] << 8) | data[pos + 1]
      const line = (data[pos + 2] << 8) | data[pos + 3]
      pos += 4

      if (pc === 0xFFFF) {
        // End marker
        break
      }

      lineMap.push({ pc, line })
    }

    // Parse symbol table
    while (pos < data.length - 3) {
      const addr = (data[pos] << 8) | data[pos + 1]
      const type = data[pos + 2]
      pos += 3

      if (addr === 0xFFFF) {
        // End marker
        break
      }

      // Read null-terminated symbol name
      let name = ''
      while (pos < data.length && data[pos] !== 0) {
        name += String.fromCharCode(data[pos])
        pos++
      }
      pos++  // Skip null terminator

      symbols[name] = addr
    }

    return { sourceFilename, lineMap, symbols }
  }

  /**
   * Legacy load method (for backwards compatibility)
   * Use loadBinary() for new format binaries
   */
  load(data, address = 0) {
    if (address + data.length > this.size) {
      throw new Error('Program too large for memory')
    }
    this.data.set(data, address)
  }

  /**
   * Resize memory (preserves data below BK and stack data)
   */
  resize(newSize, breakPointer, stackPointer) {
    const validSizes = [1024, 2048, 4096, 8192, 16384]
    if (!validSizes.includes(newSize)) {
      throw new Error(`Invalid memory size: ${newSize}`)
    }

    const oldData = this.data
    const oldSize = this.size

    this.size = newSize
    this.data = new Uint8Array(newSize)

    // Copy data below break pointer
    const heapEnd = Math.min(breakPointer, oldSize, newSize)
    this.data.set(oldData.slice(0, heapEnd))

    // Copy stack data (from SP to end of old memory)
    if (stackPointer < oldSize) {
      const stackSize = oldSize - stackPointer
      const newStackStart = newSize - stackSize
      this.data.set(oldData.slice(stackPointer), newStackStart)
    }

    return {
      newStackPointer: newSize - (oldSize - stackPointer)
    }
  }

  /**
   * Get memory dump as hex string
   */
  dump(start = 0, length = 256) {
    const end = Math.min(start + length, this.size)
    let result = ''

    for (let i = start; i < end; i += 16) {
      // Address
      result += `0x${i.toString(16).padStart(4, '0')}: `

      // Hex bytes
      for (let j = 0; j < 16 && i + j < end; j++) {
        result += this.data[i + j].toString(16).padStart(2, '0') + ' '
      }

      result += '\n'
    }

    return result
  }

  /**
   * Write signature to runtime memory (no-op in new architecture)
   * Runtime memory 0x0000-0x001F stays zero per spec
   */
  writeSignature() {
    // No-op: signatures are only in binary files, not runtime memory
  }

  /**
   * Validate signature in runtime memory (always true in new architecture)
   * Runtime memory doesn't contain signatures per spec
   */
  validateSignature() {
    // Always valid since runtime memory doesn't store signatures
    return true
  }

  /**
   * Clear all memory (reset to zero)
   */
  clear() {
    this.data.fill(0)
    this.writeSignature()
  }
}

// ============================================================================
// Instruction Decoder
// ============================================================================

/**
 * Decode instruction from byte array
 * Returns instruction object with opcode, operands, and size
 */
export function decodeFromBytes(bytes) {
  const opcode = bytes[0]

  // 2-byte instructions: NOP, HLT, RET, single-register ops
  if (opcode === Opcode.NOP || opcode === Opcode.HLT || opcode === Opcode.RET ||
      opcode === Opcode.INC_REG || opcode === Opcode.DEC_REG ||
      opcode === Opcode.MUL || opcode === Opcode.DIV || opcode === Opcode.NOT ||
      opcode === Opcode.PUSH || opcode === Opcode.POP || opcode === Opcode.SYSCALL) {
    const param = bytes[1] || 0
    return {
      opcode,
      param,
      size: 2,
      reg: param,  // For register operations
      syscall: param,  // For SYSCALL
    }
  }

  // All instructions are 2 or 4 bytes
  const byte1 = bytes[1] || 0
  const byte2 = bytes[2] || 0
  const byte3 = bytes[3] || 0

  // Decode based on instruction type
  const result = {
    opcode,
    size: 4,
    byte1,
    byte2,
    byte3,
  }

  // Register-register operations (dst, src in byte1, byte2)
  if (opcode === Opcode.MOV_REG_REG || opcode === Opcode.ADD_REG_REG ||
      opcode === Opcode.SUB_REG_REG || opcode === Opcode.AND_REG_REG ||
      opcode === Opcode.OR_REG_REG || opcode === Opcode.XOR_REG_REG ||
      opcode === Opcode.CMP_REG_REG) {
    result.dst = byte1
    result.src = byte2
    return result
  }

  // Register-immediate operations (dst, imm16 little-endian in bytes 2-3)
  if (opcode === Opcode.MOV_REG_IMM || opcode === Opcode.ADD_REG_IMM ||
      opcode === Opcode.SUB_REG_IMM || opcode === Opcode.AND_REG_IMM ||
      opcode === Opcode.OR_REG_IMM || opcode === Opcode.XOR_REG_IMM ||
      opcode === Opcode.CMP_REG_IMM || opcode === Opcode.SHL || opcode === Opcode.SHR) {
    result.dst = byte1
    result.imm = (byte2 << 8) | byte3  // Little-endian in instruction bytes
    return result
  }

  // Memory operations with absolute address (reg, addr)
  if (opcode === Opcode.LOAD || opcode === Opcode.LOADB ||
      opcode === Opcode.ADD_MEM || opcode === Opcode.SUB_MEM ||
      opcode === Opcode.CMP_MEM || opcode === Opcode.INC_MEM || opcode === Opcode.DEC_MEM) {
    result.reg = byte1
    result.addr = (byte2 << 8) | byte3  // Little-endian
    return result
  }

  // Store operations (src, addr) - note: addr is little-endian in bytes 2-3
  if (opcode === Opcode.STORE || opcode === Opcode.STOREB) {
    result.src = byte1
    result.addr = (byte2 << 8) | byte3  // Little-endian
    return result
  }

  // Register-relative operations (dst/src, base, offset)
  if (opcode === Opcode.LOADR || opcode === Opcode.LOADBR || opcode === Opcode.LEA ||
      opcode === Opcode.ADD_MEMR || opcode === Opcode.SUB_MEMR ||
      opcode === Opcode.CMP_MEMR || opcode === Opcode.INC_MEMR || opcode === Opcode.DEC_MEMR) {
    result.reg = byte1
    result.base = byte2
    result.offset = signExtend8(byte3)  // Signed offset
    return result
  }

  // Store register-relative (src, base, offset)
  if (opcode === Opcode.STORER || opcode === Opcode.STOREBR) {
    result.src = byte1
    result.base = byte2
    result.offset = signExtend8(byte3)  // Signed offset
    return result
  }

  // Store immediate to register-indirect (base, imm16)
  if (opcode === Opcode.STOREI) {
    result.base = byte1
    result.imm = (byte2 << 8) | byte3  // Little-endian
    return result
  }

  // Store byte immediate to direct address (addr, byte_imm)
  if (opcode === Opcode.STOREI_DIRECT) {
    result.addr = (byte1 << 8) | byte2  // Big-endian for address
    result.imm = byte3  // Byte immediate (0-255)
    return result
  }

  // Jump/Call instructions (addr in bytes 2-3, little-endian)
  if (opcode === Opcode.JMP || opcode === Opcode.JE || opcode === Opcode.JNE ||
      opcode === Opcode.JL || opcode === Opcode.JG || opcode === Opcode.JLE ||
      opcode === Opcode.JGE || opcode === Opcode.LOOP || opcode === Opcode.CALL) {
    result.addr = (byte2 << 8) | byte3  // Little-endian
    return result
  }

  // Indexed addressing (reg, base, index)
  if (opcode === Opcode.LOAD_INDEXED || opcode === Opcode.STORE_INDEXED) {
    result.reg = byte1
    result.base = byte2
    result.index = byte3
    return result
  }

  return result
}

/**
 * Decode instruction at given memory address
 * Returns instruction object with opcode, operands, and size
 */
export function decodeInstruction(memory, address) {
  const bytes = []
  for (let i = 0; i < 4; i++) {
    bytes.push(memory.readByte(address + i))
  }
  return decodeFromBytes(bytes)
}

/**
 * Sign-extend 8-bit value to signed 16-bit
 */
function signExtend8(value) {
  if (value & 0x80) {
    // Negative: extend with 1s, then convert to signed
    const extended = value | 0xFF00
    // Convert to signed 16-bit range (-32768 to 32767)
    return extended > 32767 ? extended - 65536 : extended
  }
  return value  // Positive: extend with 0s
}

/**
 * Get human-readable instruction mnemonic
 */
export function getInstructionName(opcode) {
  const names = {
    [Opcode.NOP]: 'NOP',
    [Opcode.HLT]: 'HLT',
    [Opcode.MOV_REG_REG]: 'MOV',
    [Opcode.MOV_REG_IMM]: 'MOV',
    [Opcode.LOAD]: 'MOV',
    [Opcode.STORE]: 'MOV',
    [Opcode.LOADR]: 'MOV',
    [Opcode.STORER]: 'MOV',
    [Opcode.LOADB]: 'MOV',
    [Opcode.LEA]: 'LEA',
    [Opcode.STOREB]: 'MOV',
    [Opcode.LOADBR]: 'MOV',
    [Opcode.STOREBR]: 'MOV',
    [Opcode.STOREI]: 'MOV',
    [Opcode.STOREI_DIRECT]: 'MOV',
    [Opcode.INC_MEM]: 'INC',
    [Opcode.DEC_MEM]: 'DEC',
    [Opcode.INC_MEMR]: 'INC',
    [Opcode.ADD_REG_REG]: 'ADD',
    [Opcode.ADD_REG_IMM]: 'ADD',
    [Opcode.SUB_REG_REG]: 'SUB',
    [Opcode.SUB_REG_IMM]: 'SUB',
    [Opcode.INC_REG]: 'INC',
    [Opcode.DEC_REG]: 'DEC',
    [Opcode.MUL]: 'MUL',
    [Opcode.DIV]: 'DIV',
    [Opcode.ADD_MEM]: 'ADD',
    [Opcode.ADD_MEMR]: 'ADD',
    [Opcode.SUB_MEM]: 'SUB',
    [Opcode.SUB_MEMR]: 'SUB',
    [Opcode.DEC_MEMR]: 'DEC',
    [Opcode.LOAD_INDEXED]: 'MOV',
    [Opcode.STORE_INDEXED]: 'MOV',
    [Opcode.AND_REG_REG]: 'AND',
    [Opcode.AND_REG_IMM]: 'AND',
    [Opcode.OR_REG_REG]: 'OR',
    [Opcode.OR_REG_IMM]: 'OR',
    [Opcode.XOR_REG_REG]: 'XOR',
    [Opcode.XOR_REG_IMM]: 'XOR',
    [Opcode.NOT]: 'NOT',
    [Opcode.SHL]: 'SHL',
    [Opcode.SHR]: 'SHR',
    [Opcode.CMP_REG_REG]: 'CMP',
    [Opcode.CMP_REG_IMM]: 'CMP',
    [Opcode.CMP_MEM]: 'CMP',
    [Opcode.CMP_MEMR]: 'CMP',
    [Opcode.JMP]: 'JMP',
    [Opcode.JE]: 'JE',
    [Opcode.JNE]: 'JNE',
    [Opcode.JL]: 'JL',
    [Opcode.JG]: 'JG',
    [Opcode.JLE]: 'JLE',
    [Opcode.JGE]: 'JGE',
    [Opcode.LOOP]: 'LOOP',
    [Opcode.PUSH]: 'PUSH',
    [Opcode.POP]: 'POP',
    [Opcode.CALL]: 'CALL',
    [Opcode.RET]: 'RET',
    [Opcode.SYSCALL]: 'SYSCALL',
  }
  return names[opcode] || `UNKNOWN(0x${opcode.toString(16)})`
}

// ============================================================================
// CPU
// ============================================================================

export class CPU {
  constructor(memory, os = null) {
    this.memory = memory
    this.os = os
    this.registers = new Registers()
    this.halted = false
    this.cachedInstruction = null  // Cache prefetched instruction
    this.currentUndoList = null    // For backward stepping

    // Initialize for program execution
    this.registers.reset(memory.size)
  }

  /**
   * Get register value by register code (0-7)
   */
  getReg(code) {
    return this.registers[RegName[code]] || 0
  }

  /**
   * Set register value by register code (0-7)
   */
  setReg(code, value) {
    const name = RegName[code]
    if (name && name !== '??') {
      if (this.currentUndoList) {
        const oldValue = this.registers[name]
        this.currentUndoList.push(() => {
          this.registers[name] = oldValue
        })
      }
      this.registers[name] = value & 0xFFFF
    }
  }

  /**
   * Set register value by name (for syscalls)
   */
  setRegByName(name, value) {
    if (name in this.registers) {
      if (this.currentUndoList) {
        const oldValue = this.registers[name]
        this.currentUndoList.push(() => {
          this.registers[name] = oldValue
        })
      }
      this.registers[name] = value & 0xFFFF
    }
  }

  /**
   * Set flag value
   */
  setFlag(flag, value) {
    if (this.currentUndoList) {
      const oldValue = this.registers[flag]
      this.currentUndoList.push(() => {
        this.registers[flag] = oldValue
      })
    }
    this.registers[flag] = value ? 1 : 0
  }

  /**
   * Write to memory
   */
  writeMemory(address, value) {
    if (this.currentUndoList) {
      const oldValue = this.memory.readWord(address)
      this.currentUndoList.push(() => {
        this.memory.writeWord(address, oldValue)
      })
    }
    this.memory.writeWord(address, value)
  }

  /**
   * Write byte to memory
   */
  writeMemoryByte(address, value) {
    if (this.currentUndoList) {
      const oldValue = this.memory.readByte(address)
      this.currentUndoList.push(() => {
        this.memory.writeByte(address, oldValue)
      })
    }
    this.memory.writeByte(address, value)
  }

  /**
   * Set PC value
   */
  setPC(value) {
    if (this.currentUndoList) {
      const oldValue = this.registers.PC
      this.currentUndoList.push(() => {
        this.registers.PC = oldValue
      })
    }
    this.registers.PC = value & 0xFFFF
  }

  /**
   * Increment PC by instruction size
   */
  incPC(size) {
    if (this.currentUndoList) {
      const oldValue = this.registers.PC
      this.currentUndoList.push(() => {
        this.registers.PC = oldValue
      })
    }
    this.registers.PC = (this.registers.PC + size) & 0xFFFF
  }

  /**
   * Set SP value
   */
  setSP(value) {
    if (this.currentUndoList) {
      const oldValue = this.registers.SP
      this.currentUndoList.push(() => {
        this.registers.SP = oldValue
      })
    }
    this.registers.SP = value & 0xFFFF
  }

  /**
   * Update ZF and SF flags based on result
   */
  updateFlags(result, bits = 16) {
    const mask = bits === 16 ? 0xFFFF : 0xFF
    const signBit = bits === 16 ? 0x8000 : 0x80

    result = result & mask

    this.setFlag('ZF', result === 0)
    this.setFlag('SF', (result & signBit) !== 0)

    return result
  }

  /**
   * Prefetch next instruction into IR and DR
   * Returns the decoded instruction for caching
   */
  prefetchInstruction() {
    const pc = this.registers.PC
    const instr = decodeInstruction(this.memory, pc)

    // Load IR with first word (opcode + param/byte1)
    const byte0 = this.memory.readByte(pc)
    const byte1 = this.memory.readByte(pc + 1)
    this.registers.IR = (byte0 << 8) | byte1

    // Load DR with second word (byte2 + byte3) if 4-byte instruction
    if (instr.size === 4) {
      const byte2 = this.memory.readByte(pc + 2)
      const byte3 = this.memory.readByte(pc + 3)
      this.registers.DR = (byte2 << 8) | byte3
    } else {
      this.registers.DR = 0
    }

    return instr
  }

  /**
   * Execute one instruction at current PC
   * Returns false if halted, true if continuing
   */
  step() {
    if (this.halted) {
      return false
    }

    // Use cached instruction if available, otherwise decode
    const instr = this.cachedInstruction || decodeInstruction(this.memory, this.registers.PC)
    this.cachedInstruction = null

    // Execute instruction
    this.executeInstruction(instr)

    // Prefetch next instruction into IR/DR for display and cache it
    if (!this.halted) {
      this.cachedInstruction = this.prefetchInstruction()
    }

    return !this.halted
  }

  /**
   * Execute decoded instruction
   */
  executeInstruction(instr) {
    const { opcode } = instr

    switch (opcode) {
      // ========== System ==========
      case Opcode.NOP:
        this.incPC(instr.size)
        break

      case Opcode.HLT:
        this.halted = true
        break

      // ========== Data Movement ==========
      case Opcode.MOV_REG_REG: {
        const value = this.getReg(instr.src)
        this.setReg(instr.dst, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.MOV_REG_IMM: {
        this.setReg(instr.dst, instr.imm)
        this.incPC(instr.size)
        break
      }

      case Opcode.LOAD: {
        const value = this.memory.readWord(instr.addr)
        this.setReg(instr.reg, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.STORE: {
        const value = this.getReg(instr.src)
        this.writeMemory(instr.addr, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.LOADR: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const value = this.memory.readWord(addr)
        this.setReg(instr.reg, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.STORER: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const value = this.getReg(instr.src)
        this.writeMemory(addr, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.LOADB: {
        const value = this.memory.readByte(instr.addr)
        this.setReg(instr.reg, value)  // Zero-extended
        this.incPC(instr.size)
        break
      }

      case Opcode.STOREB: {
        const value = this.getReg(instr.src) & 0xFF
        this.writeMemoryByte(instr.addr, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.LOADBR: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const value = this.memory.readByte(addr)
        this.setReg(instr.reg, value)  // Zero-extended
        this.incPC(instr.size)
        break
      }

      case Opcode.STOREBR: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const value = this.getReg(instr.src) & 0xFF
        this.writeMemoryByte(addr, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.LEA: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        this.setReg(instr.reg, addr)
        this.incPC(instr.size)
        break
      }

      case Opcode.STOREI: {
        const base = this.getReg(instr.base)
        this.writeMemory(base, instr.imm)
        this.incPC(instr.size)
        break
      }

      case Opcode.STOREI_DIRECT: {
        this.writeMemory(instr.addr, instr.imm)
        this.incPC(instr.size)
        break
      }

      // ========== Arithmetic ==========
      case Opcode.ADD_REG_REG: {
        const a = this.getReg(instr.dst)
        const b = this.getReg(instr.src)
        const result = a + b

        // Set flags
        this.setFlag('CF', result > 0xFFFF)
        this.updateFlags(result, 16)

        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.ADD_REG_IMM: {
        const a = this.getReg(instr.dst)
        const result = a + instr.imm

        this.setFlag('CF', result > 0xFFFF)
        this.updateFlags(result, 16)

        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.ADD_MEM: {
        const a = this.getReg(instr.reg)
        const b = this.memory.readWord(instr.addr)
        const result = a + b

        this.setFlag('CF', result > 0xFFFF)
        this.updateFlags(result, 16)

        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.ADD_MEMR: {
        const a = this.getReg(instr.reg)
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const b = this.memory.readWord(addr)
        const result = a + b

        this.setFlag('CF', result > 0xFFFF)
        this.updateFlags(result, 16)

        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.SUB_REG_REG: {
        const a = this.getReg(instr.dst)
        const b = this.getReg(instr.src)
        const result = a - b

        this.setFlag('CF', b > a)
        this.updateFlags(result, 16)

        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.SUB_REG_IMM: {
        const a = this.getReg(instr.dst)
        const result = a - instr.imm

        this.setFlag('CF', instr.imm > a)
        this.updateFlags(result, 16)

        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.SUB_MEM: {
        const a = this.getReg(instr.reg)
        const b = this.memory.readWord(instr.addr)
        const result = a - b

        this.setFlag('CF', b > a)
        this.updateFlags(result, 16)

        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.SUB_MEMR: {
        const a = this.getReg(instr.reg)
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const b = this.memory.readWord(addr)
        const result = a - b

        this.setFlag('CF', b > a)
        this.updateFlags(result, 16)

        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.INC_REG: {
        const value = this.getReg(instr.reg)
        const result = value + 1
        this.updateFlags(result, 16)
        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.DEC_REG: {
        const value = this.getReg(instr.reg)
        const result = value - 1
        this.updateFlags(result, 16)
        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.INC_MEM: {
        const value = this.memory.readWord(instr.addr)
        const result = (value + 1) & 0xFFFF
        this.writeMemory(instr.addr, result)
        this.updateFlags(result, 16)
        this.incPC(instr.size)
        break
      }

      case Opcode.DEC_MEM: {
        const value = this.memory.readWord(instr.addr)
        const result = (value - 1) & 0xFFFF
        this.writeMemory(instr.addr, result)
        this.updateFlags(result, 16)
        this.incPC(instr.size)
        break
      }

      case Opcode.INC_MEMR: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const value = this.memory.readWord(addr)
        const result = (value + 1) & 0xFFFF
        this.writeMemory(addr, result)
        this.updateFlags(result, 16)
        this.incPC(instr.size)
        break
      }

      case Opcode.DEC_MEMR: {
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const value = this.memory.readWord(addr)
        const result = (value - 1) & 0xFFFF
        this.writeMemory(addr, result)
        this.updateFlags(result, 16)
        this.incPC(instr.size)
        break
      }

      case Opcode.LOAD_INDEXED: {
        const base = this.getReg(instr.base)
        const index = this.getReg(instr.index)
        const addr = (base + index) & 0xFFFF
        const value = this.memory.readWord(addr)
        this.setReg(instr.reg, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.STORE_INDEXED: {
        const base = this.getReg(instr.base)
        const index = this.getReg(instr.index)
        const addr = (base + index) & 0xFFFF
        const value = this.getReg(instr.reg)
        this.writeMemory(addr, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.MUL: {
        const a = this.registers.AX
        const b = this.getReg(instr.reg)
        const result = a * b
        this.setReg(0, result & 0xFFFF)  // AX = 0
        this.updateFlags(this.registers.AX, 16)
        this.incPC(instr.size)
        break
      }

      case Opcode.DIV: {
        const divisor = this.getReg(instr.reg)
        if (divisor === 0) {
          throw new Error('Division by zero')
        }
        const quotient = Math.floor(this.registers.AX / divisor)
        const remainder = this.registers.AX % divisor
        this.setReg(0, quotient & 0xFFFF)  // AX = 0
        this.setReg(3, remainder & 0xFFFF)  // DX = 3
        this.updateFlags(this.registers.AX, 16)
        this.incPC(instr.size)
        break
      }

      // ========== Comparison ==========
      case Opcode.CMP_REG_REG: {
        const a = this.getReg(instr.dst)
        const b = this.getReg(instr.src)
        const result = a - b

        this.setFlag('CF', b > a)
        this.updateFlags(result, 16)

        this.incPC(instr.size)
        break
      }

      case Opcode.CMP_REG_IMM: {
        const a = this.getReg(instr.dst)
        const result = a - instr.imm

        this.setFlag('CF', instr.imm > a)
        this.updateFlags(result, 16)

        this.incPC(instr.size)
        break
      }

      case Opcode.CMP_MEM: {
        const a = this.getReg(instr.reg)
        const b = this.memory.readWord(instr.addr)
        const result = a - b

        this.setFlag('CF', b > a)
        this.updateFlags(result, 16)

        this.incPC(instr.size)
        break
      }

      case Opcode.CMP_MEMR: {
        const a = this.getReg(instr.reg)
        const base = this.getReg(instr.base)
        const addr = (base + instr.offset) & 0xFFFF
        const b = this.memory.readWord(addr)
        const result = a - b

        this.setFlag('CF', b > a)
        this.updateFlags(result, 16)

        this.incPC(instr.size)
        break
      }

      // ========== Jumps ==========
      case Opcode.JMP:
        this.setPC(instr.addr)
        break

      case Opcode.JE:
        if (this.registers.ZF === 1) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      case Opcode.JNE:
        if (this.registers.ZF === 0) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      case Opcode.JL:
        if (this.registers.SF !== this.registers.OF) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      case Opcode.JG:
        if (this.registers.ZF === 0 && this.registers.SF === this.registers.OF) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      case Opcode.JLE:
        if (this.registers.ZF === 1 || this.registers.SF !== this.registers.OF) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      case Opcode.JGE:
        if (this.registers.SF === this.registers.OF) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      case Opcode.LOOP:
        // Decrement CX and jump if CX != 0
        this.registers.CX = (this.registers.CX - 1) & 0xFFFF
        if (this.registers.CX !== 0) {
          this.setPC(instr.addr)
        } else {
          this.incPC(instr.size)
        }
        break

      // ========== Stack & Functions ==========
      case Opcode.PUSH: {
        this.setSP((this.registers.SP - 2) & 0xFFFF)
        const value = this.getReg(instr.reg)
        this.writeMemory(this.registers.SP, value)
        this.incPC(instr.size)
        break
      }

      case Opcode.POP: {
        const value = this.memory.readWord(this.registers.SP)
        this.setReg(instr.reg, value)
        this.setSP((this.registers.SP + 2) & 0xFFFF)
        this.incPC(instr.size)
        break
      }

      case Opcode.CALL: {
        // Push return address (PC + 4)
        const returnAddr = (this.registers.PC + instr.size) & 0xFFFF
        this.setSP((this.registers.SP - 2) & 0xFFFF)
        this.writeMemory(this.registers.SP, returnAddr)

        // Jump to function
        this.setPC(instr.addr)
        break
      }

      case Opcode.RET: {
        // Pop return address
        const returnAddr = this.memory.readWord(this.registers.SP)
        this.setSP((this.registers.SP + 2) & 0xFFFF)
        this.setPC(returnAddr)
        break
      }

      // ========== Logical & Bitwise ==========
      case Opcode.AND_REG_REG: {
        const a = this.getReg(instr.dst)
        const b = this.getReg(instr.src)
        const result = a & b
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.AND_REG_IMM: {
        const a = this.getReg(instr.dst)
        const result = a & instr.imm
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.OR_REG_REG: {
        const a = this.getReg(instr.dst)
        const b = this.getReg(instr.src)
        const result = a | b
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.OR_REG_IMM: {
        const a = this.getReg(instr.dst)
        const result = a | instr.imm
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.XOR_REG_REG: {
        const a = this.getReg(instr.dst)
        const b = this.getReg(instr.src)
        const result = a ^ b
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.XOR_REG_IMM: {
        const a = this.getReg(instr.dst)
        const result = a ^ instr.imm
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.NOT: {
        const value = this.getReg(instr.reg)
        const result = (~value) & 0xFFFF
        this.updateFlags(result, 16)
        this.setReg(instr.reg, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.SHL: {
        const value = this.getReg(instr.dst)
        const count = instr.imm & 0x0F  // Limit to 15
        const result = (value << count) & 0xFFFF
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      case Opcode.SHR: {
        const value = this.getReg(instr.dst)
        const count = instr.imm & 0x0F  // Limit to 15
        const result = value >>> count
        this.updateFlags(result, 16)
        this.setReg(instr.dst, result)
        this.incPC(instr.size)
        break
      }

      // ========== System Calls ==========
      case Opcode.SYSCALL:
        if (this.os) {
          this.os.syscall(instr.syscall)
        }
        this.incPC(instr.size)
        break

      default:
        throw new Error(`Unknown opcode: 0x${opcode.toString(16)} at PC=0x${this.registers.PC.toString(16)}`)
    }
  }

  /**
   * Reset CPU to initial state
   */
  reset() {
    this.registers.reset(this.memory.size)
    this.halted = false
    // Prefetch first instruction for display and cache it
    this.cachedInstruction = this.prefetchInstruction()
  }
}