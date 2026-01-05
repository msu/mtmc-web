import { describe, it, expect, beforeEach } from 'vitest'
import { Registers, Memory, Opcode, decodeInstruction, getInstructionName, CPU } from '../emulator.js'
import { assemble } from '../assembler.js'
import { OS } from '../os.js'

// ============================================================================
// Registers Tests
// ============================================================================

describe('Registers', () => {
  let regs

  beforeEach(() => {
    regs = new Registers()
  })

  describe('General Purpose Registers', () => {
    it('should initialize all registers to 0', () => {
      expect(regs.AX).toBe(0)
      expect(regs.BX).toBe(0)
      expect(regs.CX).toBe(0)
      expect(regs.DX).toBe(0)
    })

    it('should get and set 16-bit registers', () => {
      regs.set('AX', 0x1234)
      expect(regs.get('AX')).toBe(0x1234)

      regs.set('BX', 0xABCD)
      expect(regs.get('BX')).toBe(0xABCD)
    })

    it('should handle case-insensitive register names', () => {
      regs.set('ax', 0x1234)
      expect(regs.get('AX')).toBe(0x1234)
      expect(regs.get('ax')).toBe(0x1234)
    })

    it('should mask values to 16 bits', () => {
      regs.set('AX', 0x12345)
      expect(regs.get('AX')).toBe(0x2345)
    })
  })

  describe('Byte Registers', () => {
    it('should get low byte of 16-bit registers', () => {
      regs.set('AX', 0x1234)
      expect(regs.get('AL')).toBe(0x34)

      regs.set('BX', 0xABCD)
      expect(regs.get('BL')).toBe(0xCD)
    })

    it('should set low byte without affecting high byte', () => {
      regs.set('AX', 0x1234)
      regs.set('AL', 0x56)
      expect(regs.get('AX')).toBe(0x1256)
      expect(regs.get('AL')).toBe(0x56)
    })

    it('should support all byte registers', () => {
      regs.set('CX', 0x1122)
      regs.set('CL', 0x33)
      expect(regs.get('CX')).toBe(0x1133)

      regs.set('DX', 0x4455)
      regs.set('DL', 0x66)
      expect(regs.get('DX')).toBe(0x4466)
    })
  })

  describe('Special Purpose Registers', () => {
    it('should support SP, FP, BK, PC', () => {
      regs.set('SP', 0x0400)
      expect(regs.get('SP')).toBe(0x0400)

      regs.set('FP', 0x0300)
      expect(regs.get('FP')).toBe(0x0300)

      regs.set('BK', 0x0020)
      expect(regs.get('BK')).toBe(0x0020)

      regs.set('PC', 0x0100)
      expect(regs.get('PC')).toBe(0x0100)
    })
  })

  describe('Flags', () => {
    it('should initialize flags to 0', () => {
      const flags = regs.getFlags()
      expect(flags.ZF).toBe(0)
      expect(flags.SF).toBe(0)
      expect(flags.CF).toBe(0)
      expect(flags.OF).toBe(0)
    })

    it('should set and get flags', () => {
      regs.setFlags({ ZF: 1, SF: 1 })
      const flags = regs.getFlags()
      expect(flags.ZF).toBe(1)
      expect(flags.SF).toBe(1)
      expect(flags.CF).toBe(0)
      expect(flags.OF).toBe(0)
    })

    it('should update flags based on result (16-bit)', () => {
      // Zero result
      regs.updateFlags(0, 16)
      expect(regs.ZF).toBe(1)
      expect(regs.SF).toBe(0)

      // Negative result (sign bit set)
      regs.updateFlags(0x8000, 16)
      expect(regs.ZF).toBe(0)
      expect(regs.SF).toBe(1)

      // Positive non-zero result
      regs.updateFlags(0x1234, 16)
      expect(regs.ZF).toBe(0)
      expect(regs.SF).toBe(0)
    })

    it('should update flags based on result (8-bit)', () => {
      // Zero result
      regs.updateFlags(0, 8)
      expect(regs.ZF).toBe(1)
      expect(regs.SF).toBe(0)

      // Negative result (sign bit set in byte)
      regs.updateFlags(0x80, 8)
      expect(regs.ZF).toBe(0)
      expect(regs.SF).toBe(1)
    })
  })

  describe('Reset', () => {
    it('should reset all registers to initial state', () => {
      regs.set('AX', 0x1234)
      regs.set('BX', 0x5678)
      regs.setFlags({ ZF: 1, SF: 1 })

      regs.reset(0x0400)

      expect(regs.get('AX')).toBe(0)
      expect(regs.get('BX')).toBe(0)
      expect(regs.get('SP')).toBe(0x0400)
      expect(regs.get('PC')).toBe(0x0020)
      expect(regs.get('BK')).toBe(0x0020)
      expect(regs.ZF).toBe(0)
      expect(regs.SF).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should throw on unknown register get', () => {
      expect(() => regs.get('XX')).toThrow('Unknown register: XX')
    })

    it('should throw on unknown register set', () => {
      expect(() => regs.set('XX', 0)).toThrow('Unknown register: XX')
    })
  })
})

// ============================================================================
// Memory Tests
// ============================================================================

describe('Memory', () => {
  let mem

  beforeEach(() => {
    mem = new Memory(1024)
  })

  describe('Initialization', () => {
    it('should create memory with specified size', () => {
      expect(mem.size).toBe(1024)
      expect(mem.data.length).toBe(1024)
    })

    it('should accept valid memory sizes', () => {
      expect(() => new Memory(1024)).not.toThrow()
      expect(() => new Memory(2048)).not.toThrow()
      expect(() => new Memory(4096)).not.toThrow()
      expect(() => new Memory(8192)).not.toThrow()
      expect(() => new Memory(16384)).not.toThrow()
    })

    it('should reject invalid memory sizes', () => {
      expect(() => new Memory(512)).toThrow('Invalid memory size')
      expect(() => new Memory(3000)).toThrow('Invalid memory size')
    })

    it('should write signature on initialization', () => {
      expect(mem.validateSignature()).toBe(true)
    })

    it('should NOT have "Go Cats!" in runtime memory (signature is only in binary header)', () => {
      // Runtime memory 0x0000-0x001F is reserved and stays zero
      // The binary header (with signature) is NOT loaded into runtime memory
      for (let i = 0; i < 0x20; i++) {
        expect(mem.readByte(i)).toBe(0)
      }
    })
  })

  describe('Byte Access', () => {
    it('should read and write bytes', () => {
      mem.writeByte(0x0100, 0x42)
      expect(mem.readByte(0x0100)).toBe(0x42)
    })

    it('should mask byte values to 8 bits', () => {
      mem.writeByte(0x0100, 0x1234)
      expect(mem.readByte(0x0100)).toBe(0x34)
    })

    it('should throw on out-of-bounds read', () => {
      expect(() => mem.readByte(-1)).toThrow('out of bounds')
      expect(() => mem.readByte(1024)).toThrow('out of bounds')
    })

    it('should throw on out-of-bounds write', () => {
      expect(() => mem.writeByte(-1, 0)).toThrow('out of bounds')
      expect(() => mem.writeByte(1024, 0)).toThrow('out of bounds')
    })
  })

  describe('Word Access (Big-Endian)', () => {
    it('should read and write words in big-endian format', () => {
      mem.writeWord(0x0100, 0x1234)
      expect(mem.readWord(0x0100)).toBe(0x1234)

      // Verify big-endian: high byte first
      expect(mem.readByte(0x0100)).toBe(0x12)
      expect(mem.readByte(0x0101)).toBe(0x34)
    })

    it('should handle maximum word value', () => {
      mem.writeWord(0x0100, 0xFFFF)
      expect(mem.readWord(0x0100)).toBe(0xFFFF)
    })

    it('should mask word values to 16 bits', () => {
      mem.writeWord(0x0100, 0x12345)
      expect(mem.readWord(0x0100)).toBe(0x2345)
    })

    it('should throw on out-of-bounds word read', () => {
      expect(() => mem.readWord(1023)).toThrow('out of bounds')
      expect(() => mem.readWord(1024)).toThrow('out of bounds')
    })

    it('should throw on out-of-bounds word write', () => {
      expect(() => mem.writeWord(1023, 0x1234)).toThrow('out of bounds')
    })
  })

  describe('Load Binary', () => {
    it('should load binary data at specified address', () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04])
      mem.load(data, 0x0100)

      expect(mem.readByte(0x0100)).toBe(0x01)
      expect(mem.readByte(0x0101)).toBe(0x02)
      expect(mem.readByte(0x0102)).toBe(0x03)
      expect(mem.readByte(0x0103)).toBe(0x04)
    })

    it('should load at address 0 by default', () => {
      const data = new Uint8Array([0xAA, 0xBB])
      mem.load(data)

      expect(mem.readByte(0x0000)).toBe(0xAA)
      expect(mem.readByte(0x0001)).toBe(0xBB)
    })

    it('should throw if program too large', () => {
      const data = new Uint8Array(2000)
      expect(() => mem.load(data)).toThrow('too large')
    })
  })

  describe('Resize', () => {
    it('should resize memory and preserve heap data', () => {
      mem.writeByte(0x0020, 0xAA)
      mem.writeByte(0x0030, 0xBB)

      mem.resize(2048, 0x0040, 0x0400)

      expect(mem.size).toBe(2048)
      expect(mem.readByte(0x0020)).toBe(0xAA)
      expect(mem.readByte(0x0030)).toBe(0xBB)
    })

    it('should move stack data to new end', () => {
      const oldMem = new Memory(1024)
      oldMem.writeByte(0x03FE, 0xCC)
      oldMem.writeByte(0x03FF, 0xDD)

      const result = oldMem.resize(2048, 0x0040, 0x03FE)

      // Stack should move to new end
      expect(oldMem.size).toBe(2048)
      expect(result.newStackPointer).toBe(0x07FE)
    })

    it('should reject invalid sizes', () => {
      expect(() => mem.resize(3000, 0, 0)).toThrow('Invalid memory size')
    })
  })

  describe('Clear', () => {
    it('should clear all memory except signature', () => {
      mem.writeByte(0x0100, 0xAA)
      mem.writeByte(0x0200, 0xBB)

      mem.clear()

      expect(mem.readByte(0x0100)).toBe(0)
      expect(mem.readByte(0x0200)).toBe(0)
      expect(mem.validateSignature()).toBe(true)
    })
  })

  describe('Dump', () => {
    it('should return hex dump string', () => {
      mem.writeByte(0x0000, 0x12)
      mem.writeByte(0x0001, 0x34)

      const dump = mem.dump(0, 16)
      expect(dump).toContain('0x0000:')
      expect(dump).toContain('12')
    })
  })
})

// ============================================================================
// Instruction Decoder Tests
// ============================================================================

describe('Instruction Decoder', () => {
  let mem

  beforeEach(() => {
    mem = new Memory(1024)
  })

  describe('2-Byte Instructions', () => {
    it('should decode NOP', () => {
      mem.writeByte(0x0100, Opcode.NOP)
      mem.writeByte(0x0101, 0x00)

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.NOP)
      expect(instr.size).toBe(2)
    })

    it('should decode HLT', () => {
      mem.writeByte(0x0100, Opcode.HLT)
      mem.writeByte(0x0101, 0x00)

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.HLT)
      expect(instr.size).toBe(2)
    })

    it('should decode PUSH AX', () => {
      mem.writeByte(0x0100, Opcode.PUSH)
      mem.writeByte(0x0101, 0)  // AX register code

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.PUSH)
      expect(instr.reg).toBe(0)
      expect(instr.size).toBe(2)
    })

    it('should decode POP BX', () => {
      mem.writeByte(0x0100, Opcode.POP)
      mem.writeByte(0x0101, 1)  // BX register code

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.POP)
      expect(instr.reg).toBe(1)
      expect(instr.size).toBe(2)
    })

    it('should decode SYSCALL EXIT', () => {
      mem.writeByte(0x0100, Opcode.SYSCALL)
      mem.writeByte(0x0101, 0)  // EXIT syscall

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.SYSCALL)
      expect(instr.syscall).toBe(0)
      expect(instr.size).toBe(2)
    })

    it('should decode INC CX', () => {
      mem.writeByte(0x0100, Opcode.INC_REG)
      mem.writeByte(0x0101, 2)  // CX register code

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.INC_REG)
      expect(instr.reg).toBe(2)
      expect(instr.size).toBe(2)
    })
  })

  describe('4-Byte Instructions - Register-Register', () => {
    it('should decode MOV AX, BX', () => {
      mem.writeByte(0x0100, Opcode.MOV_REG_REG)
      mem.writeByte(0x0101, 0)  // AX dst
      mem.writeByte(0x0102, 1)  // BX src
      mem.writeByte(0x0103, 0)

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.MOV_REG_REG)
      expect(instr.dst).toBe(0)
      expect(instr.src).toBe(1)
      expect(instr.size).toBe(4)
    })

    it('should decode ADD CX, DX', () => {
      mem.writeByte(0x0100, Opcode.ADD_REG_REG)
      mem.writeByte(0x0101, 2)  // CX dst
      mem.writeByte(0x0102, 3)  // DX src
      mem.writeByte(0x0103, 0)

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.ADD_REG_REG)
      expect(instr.dst).toBe(2)
      expect(instr.src).toBe(3)
      expect(instr.size).toBe(4)
    })
  })

  describe('4-Byte Instructions - Register-Immediate', () => {
    it('should decode MOV AX, 0x1234 (little-endian imm)', () => {
      mem.writeByte(0x0100, Opcode.MOV_REG_IMM)
      mem.writeByte(0x0101, 0)     // AX dst
      mem.writeByte(0x0102, 0x12)  // imm high byte
      mem.writeByte(0x0103, 0x34)  // imm low byte

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.MOV_REG_IMM)
      expect(instr.dst).toBe(0)
      expect(instr.imm).toBe(0x1234)
      expect(instr.size).toBe(4)
    })

    it('should decode ADD BX, 42', () => {
      mem.writeByte(0x0100, Opcode.ADD_REG_IMM)
      mem.writeByte(0x0101, 1)     // BX dst
      mem.writeByte(0x0102, 0x00)  // imm high
      mem.writeByte(0x0103, 0x2A)  // imm low (42)

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.ADD_REG_IMM)
      expect(instr.dst).toBe(1)
      expect(instr.imm).toBe(42)
      expect(instr.size).toBe(4)
    })
  })

  describe('4-Byte Instructions - Memory Absolute', () => {
    it('should decode LOAD AX, [0x0200]', () => {
      mem.writeByte(0x0100, Opcode.LOAD)
      mem.writeByte(0x0101, 0)     // AX reg
      mem.writeByte(0x0102, 0x02)  // addr high
      mem.writeByte(0x0103, 0x00)  // addr low

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.LOAD)
      expect(instr.reg).toBe(0)
      expect(instr.addr).toBe(0x0200)
      expect(instr.size).toBe(4)
    })

    it('should decode STORE [0x0150], BX', () => {
      mem.writeByte(0x0100, Opcode.STORE)
      mem.writeByte(0x0101, 1)     // BX src
      mem.writeByte(0x0102, 0x01)  // addr high
      mem.writeByte(0x0103, 0x50)  // addr low

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.STORE)
      expect(instr.src).toBe(1)
      expect(instr.addr).toBe(0x0150)
      expect(instr.size).toBe(4)
    })
  })

  describe('4-Byte Instructions - Register-Relative', () => {
    it('should decode LOADR AX, [FP+4]', () => {
      mem.writeByte(0x0100, Opcode.LOADR)
      mem.writeByte(0x0101, 0)  // AX reg
      mem.writeByte(0x0102, 5)  // FP base
      mem.writeByte(0x0103, 4)  // offset +4

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.LOADR)
      expect(instr.reg).toBe(0)
      expect(instr.base).toBe(5)
      expect(instr.offset).toBe(4)
      expect(instr.size).toBe(4)
    })

    it('should decode LOADR BX, [FP-2] (signed offset)', () => {
      mem.writeByte(0x0100, Opcode.LOADR)
      mem.writeByte(0x0101, 1)    // BX reg
      mem.writeByte(0x0102, 5)    // FP base
      mem.writeByte(0x0103, 0xFE) // offset -2 (two's complement)

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.LOADR)
      expect(instr.reg).toBe(1)
      expect(instr.base).toBe(5)
      expect(instr.offset).toBe(-2)
      expect(instr.size).toBe(4)
    })

    it('should decode LEA AX, [FP-8]', () => {
      mem.writeByte(0x0100, Opcode.LEA)
      mem.writeByte(0x0101, 0)    // AX reg
      mem.writeByte(0x0102, 5)    // FP base
      mem.writeByte(0x0103, 0xF8) // offset -8

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.LEA)
      expect(instr.reg).toBe(0)
      expect(instr.base).toBe(5)
      expect(instr.offset).toBe(-8)
      expect(instr.size).toBe(4)
    })
  })

  describe('4-Byte Instructions - Jump/Call', () => {
    it('should decode JMP 0x0200', () => {
      mem.writeByte(0x0100, Opcode.JMP)
      mem.writeByte(0x0101, 0x00)
      mem.writeByte(0x0102, 0x02)  // addr high
      mem.writeByte(0x0103, 0x00)  // addr low

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.JMP)
      expect(instr.addr).toBe(0x0200)
      expect(instr.size).toBe(4)
    })

    it('should decode JE 0x0150', () => {
      mem.writeByte(0x0100, Opcode.JE)
      mem.writeByte(0x0101, 0x00)
      mem.writeByte(0x0102, 0x01)  // addr high
      mem.writeByte(0x0103, 0x50)  // addr low

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.JE)
      expect(instr.addr).toBe(0x0150)
      expect(instr.size).toBe(4)
    })

    it('should decode CALL 0x0300', () => {
      mem.writeByte(0x0100, Opcode.CALL)
      mem.writeByte(0x0101, 0x00)
      mem.writeByte(0x0102, 0x03)  // addr high
      mem.writeByte(0x0103, 0x00)  // addr low

      const instr = decodeInstruction(mem, 0x0100)
      expect(instr.opcode).toBe(Opcode.CALL)
      expect(instr.addr).toBe(0x0300)
      expect(instr.size).toBe(4)
    })
  })

  describe('Instruction Names', () => {
    it('should return correct instruction names', () => {
      expect(getInstructionName(Opcode.NOP)).toBe('NOP')
      expect(getInstructionName(Opcode.HLT)).toBe('HLT')
      expect(getInstructionName(Opcode.MOV_REG_REG)).toBe('MOV')
      expect(getInstructionName(Opcode.ADD_REG_IMM)).toBe('ADD')
      expect(getInstructionName(Opcode.JMP)).toBe('JMP')
      expect(getInstructionName(Opcode.CALL)).toBe('CALL')
      expect(getInstructionName(Opcode.SYSCALL)).toBe('SYSCALL')
    })

    it('should return UNKNOWN for invalid opcodes', () => {
      expect(getInstructionName(0xFF)).toContain('UNKNOWN')
      expect(getInstructionName(0xFF)).toContain('ff')
    })
  })
})

// ============================================================================
// CPU Execution Tests
// ============================================================================

describe('CPU Execution', () => {
  let cpu, mem

  beforeEach(() => {
    mem = new Memory(1024)
    cpu = new CPU(mem)
  })

  describe('Basic Execution', () => {
    it('should execute MOV immediate', () => {
      // MOV AX, 0x1234
      mem.writeByte(0x0020, Opcode.MOV_REG_IMM)
      mem.writeByte(0x0021, 0)  // AX
      mem.writeByte(0x0022, 0x12)
      mem.writeByte(0x0023, 0x34)

      cpu.step()

      expect(cpu.registers.AX).toBe(0x1234)
      expect(cpu.registers.PC).toBe(0x0024)
    })

    it('should execute MOV register-to-register', () => {
      cpu.registers.BX = 0x5678

      // MOV AX, BX
      mem.writeByte(0x0020, Opcode.MOV_REG_REG)
      mem.writeByte(0x0021, 0)  // AX dst
      mem.writeByte(0x0022, 1)  // BX src
      mem.writeByte(0x0023, 0)

      cpu.step()

      expect(cpu.registers.AX).toBe(0x5678)
    })

    it('should execute MOV [addr], imm (STOREI_DIRECT)', () => {
      // MOV [0x0100], 42 (byte immediate)
      mem.writeByte(0x0020, Opcode.STOREI_DIRECT)
      mem.writeByte(0x0021, 0x01)  // addr high
      mem.writeByte(0x0022, 0x00)  // addr low
      mem.writeByte(0x0023, 42)    // byte immediate

      cpu.step()

      expect(mem.readWord(0x0100)).toBe(42)
      expect(cpu.registers.PC).toBe(0x0024)  // 4-byte instruction
    })

    it('should execute HLT', () => {
      mem.writeByte(0x0020, Opcode.HLT)
      mem.writeByte(0x0021, 0)

      const result = cpu.step()

      expect(result).toBe(false)
      expect(cpu.halted).toBe(true)
    })
  })

  describe('Arithmetic Operations', () => {
    it('should execute ADD with immediate', () => {
      cpu.registers.AX = 10

      // ADD AX, 5
      mem.writeByte(0x0020, Opcode.ADD_REG_IMM)
      mem.writeByte(0x0021, 0)  // AX
      mem.writeByte(0x0022, 0x00)
      mem.writeByte(0x0023, 0x05)

      cpu.step()

      expect(cpu.registers.AX).toBe(15)
      expect(cpu.registers.ZF).toBe(0)
    })

    it('should set zero flag on zero result', () => {
      cpu.registers.AX = 5

      // SUB AX, 5
      mem.writeByte(0x0020, Opcode.SUB_REG_IMM)
      mem.writeByte(0x0021, 0)  // AX
      mem.writeByte(0x0022, 0x00)
      mem.writeByte(0x0023, 0x05)

      cpu.step()

      expect(cpu.registers.AX).toBe(0)
      expect(cpu.registers.ZF).toBe(1)
    })

    it('should set carry flag on overflow', () => {
      cpu.registers.AX = 0xFFFF

      // ADD AX, 1
      mem.writeByte(0x0020, Opcode.ADD_REG_IMM)
      mem.writeByte(0x0021, 0)  // AX
      mem.writeByte(0x0022, 0x00)
      mem.writeByte(0x0023, 0x01)

      cpu.step()

      expect(cpu.registers.AX).toBe(0)
      expect(cpu.registers.CF).toBe(1)
      expect(cpu.registers.ZF).toBe(1)
    })
  })

  describe('Jump Instructions', () => {
    it('should execute unconditional jump', () => {
      // JMP 0x0100
      mem.writeByte(0x0020, Opcode.JMP)
      mem.writeByte(0x0021, 0x00)
      mem.writeByte(0x0022, 0x01)
      mem.writeByte(0x0023, 0x00)

      cpu.step()

      expect(cpu.registers.PC).toBe(0x0100)
    })

    it('should execute JE when ZF=1', () => {
      cpu.registers.ZF = 1

      // JE 0x0100
      mem.writeByte(0x0020, Opcode.JE)
      mem.writeByte(0x0021, 0x00)
      mem.writeByte(0x0022, 0x01)
      mem.writeByte(0x0023, 0x00)

      cpu.step()

      expect(cpu.registers.PC).toBe(0x0100)
    })

    it('should not jump on JE when ZF=0', () => {
      cpu.registers.ZF = 0

      // JE 0x0100
      mem.writeByte(0x0020, Opcode.JE)
      mem.writeByte(0x0021, 0x00)
      mem.writeByte(0x0022, 0x01)
      mem.writeByte(0x0023, 0x00)

      cpu.step()

      expect(cpu.registers.PC).toBe(0x0024)  // Skipped
    })

    it('should execute conditional jump after CMP', () => {
      // CMP with AX=5, imm=5 should set ZF
      cpu.registers.AX = 5

      // CMP AX, 5
      mem.writeByte(0x0020, Opcode.CMP_REG_IMM)
      mem.writeByte(0x0021, 0)  // AX
      mem.writeByte(0x0022, 0x00)
      mem.writeByte(0x0023, 0x05)

      // JE 0x0100
      mem.writeByte(0x0024, Opcode.JE)
      mem.writeByte(0x0025, 0x00)
      mem.writeByte(0x0026, 0x01)
      mem.writeByte(0x0027, 0x00)

      cpu.step()  // CMP
      expect(cpu.registers.ZF).toBe(1)

      cpu.step()  // JE
      expect(cpu.registers.PC).toBe(0x0100)
    })
  })

  describe('Stack Operations', () => {
    it('should PUSH and POP values', () => {
      // Write instructions first
      mem.writeByte(0x0020, Opcode.PUSH)
      mem.writeByte(0x0021, 0)  // AX
      mem.writeByte(0x0022, Opcode.POP)
      mem.writeByte(0x0023, 1)  // BX

      // Reset CPU to prefetch instructions
      cpu.reset()

      // Set register value
      cpu.registers.AX = 0x1234

      cpu.step()  // PUSH AX

      expect(cpu.registers.SP).toBe(0x03FE)
      expect(mem.readWord(0x03FE)).toBe(0x1234)

      cpu.registers.AX = 0  // Clear AX

      cpu.step()  // POP BX

      expect(cpu.registers.BX).toBe(0x1234)
      expect(cpu.registers.SP).toBe(0x0400)
    })

    it('should execute CALL and RET', () => {
      // Write CALL 0x0100
      mem.writeByte(0x0020, Opcode.CALL)
      mem.writeByte(0x0021, 0x00)
      mem.writeByte(0x0022, 0x01)
      mem.writeByte(0x0023, 0x00)

      // Write RET at 0x0100
      mem.writeByte(0x0100, Opcode.RET)
      mem.writeByte(0x0101, 0x00)

      // Reset CPU to prefetch instructions
      cpu.reset()

      cpu.step()  // CALL 0x0100

      expect(cpu.registers.PC).toBe(0x0100)
      expect(cpu.registers.SP).toBe(0x03FE)
      expect(mem.readWord(0x03FE)).toBe(0x0024)  // Return address

      cpu.step()  // RET

      expect(cpu.registers.PC).toBe(0x0024)
      expect(cpu.registers.SP).toBe(0x0400)
    })
  })

  describe('Complete Program', () => {
    it('should execute: add 5 + 10, store result, halt', () => {
      let pc = 0x0020

      // MOV AX, 5
      mem.writeByte(pc++, Opcode.MOV_REG_IMM)
      mem.writeByte(pc++, 0)
      mem.writeByte(pc++, 0x00)
      mem.writeByte(pc++, 0x05)

      // MOV BX, 10
      mem.writeByte(pc++, Opcode.MOV_REG_IMM)
      mem.writeByte(pc++, 1)
      mem.writeByte(pc++, 0x00)
      mem.writeByte(pc++, 0x0A)

      // ADD AX, BX
      mem.writeByte(pc++, Opcode.ADD_REG_REG)
      mem.writeByte(pc++, 0)  // AX
      mem.writeByte(pc++, 1)  // BX
      mem.writeByte(pc++, 0x00)

      // STORE [0x0200], AX
      mem.writeByte(pc++, Opcode.STORE)
      mem.writeByte(pc++, 0)  // AX
      mem.writeByte(pc++, 0x02)
      mem.writeByte(pc++, 0x00)

      // HLT
      mem.writeByte(pc++, Opcode.HLT)
      mem.writeByte(pc++, 0x00)

      // Execute program
      while (cpu.step()) {
        // Continue until halted
      }

      expect(cpu.registers.AX).toBe(15)
      expect(cpu.registers.BX).toBe(10)
      expect(mem.readWord(0x0200)).toBe(15)
      expect(cpu.halted).toBe(true)
    })

    it('should execute: conditional loop (count down from 5)', () => {
      let pc = 0x0020

      // MOV CX, 5  (counter)
      mem.writeByte(pc++, Opcode.MOV_REG_IMM)
      mem.writeByte(pc++, 2)  // CX
      mem.writeByte(pc++, 0x00)
      mem.writeByte(pc++, 0x05)

      // loop: (0x0024)
      const loopAddr = pc

      // DEC CX
      mem.writeByte(pc++, Opcode.DEC_REG)
      mem.writeByte(pc++, 2)  // CX

      // CMP CX, 0
      mem.writeByte(pc++, Opcode.CMP_REG_IMM)
      mem.writeByte(pc++, 2)  // CX
      mem.writeByte(pc++, 0x00)
      mem.writeByte(pc++, 0x00)

      // JNE loop
      mem.writeByte(pc++, Opcode.JNE)
      mem.writeByte(pc++, 0x00)
      mem.writeByte(pc++, (loopAddr >> 8) & 0xFF)
      mem.writeByte(pc++, loopAddr & 0xFF)

      // HLT
      mem.writeByte(pc++, Opcode.HLT)
      mem.writeByte(pc++, 0x00)

      // Execute
      let steps = 0
      while (cpu.step() && steps++ < 100) {
        // Limit iterations to prevent infinite loop
      }

      expect(cpu.registers.CX).toBe(0)
      expect(cpu.halted).toBe(true)
    })
  })

  describe('INC/DEC Memory Operations', () => {
    it('should increment word at direct address', () => {
      const source = `
        counter: DW 5
        main:
          INC [counter]
          MOV AX, [counter]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(6)
    })

    it('should decrement word at direct address', () => {
      const source = `
        counter: DW 10
        main:
          DEC [counter]
          MOV AX, [counter]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(9)
    })

    it('should increment with register-relative addressing', () => {
      const source = `
        main:
          MOV SP, 0x400
          PUSH FP
          MOV FP, SP
          SUB SP, 4
          MOV AX, 10
          MOV [FP-2], AX
          INC [FP-2]
          MOV AX, [FP-2]
          MOV SP, FP
          POP FP
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(11)
    })

    it('should decrement with register-relative addressing', () => {
      const source = `
        main:
          MOV SP, 0x400
          PUSH FP
          MOV FP, SP
          SUB SP, 4
          MOV AX, 20
          MOV [FP-2], AX
          DEC [FP-2]
          MOV AX, [FP-2]
          MOV SP, FP
          POP FP
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(19)
    })

    it('should work in loops', () => {
      const source = `
        counter: DW 0
        main:
          MOV CX, 5
        loop_start:
          INC [counter]
          DEC CX
          CMP CX, 0
          JNE loop_start
          MOV AX, [counter]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(5)
    })

    it('should handle zero crossing', () => {
      const source = `
        counter: DW 3
        main:
          DEC [counter]
          DEC [counter]
          DEC [counter]
          MOV AX, [counter]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(0)
      expect(cpu.registers.ZF).toBe(1)
    })

    it('should work with stack frames', () => {
      const source = `
        main:
          MOV SP, 0x400
          PUSH FP
          MOV FP, SP
          SUB SP, 6
          MOV AX, 1
          MOV [FP-2], AX
          MOV AX, 2
          MOV [FP-4], AX
          MOV AX, 3
          MOV [FP-6], AX
          INC [FP-2]
          INC [FP-4]
          INC [FP-6]
          MOV AX, [FP-2]
          ADD AX, [FP-4]
          ADD AX, [FP-6]
          MOV SP, FP
          POP FP
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(9)
    })

    it('should combine INC and DEC', () => {
      const source = `
        value: DW 10
        main:
          INC [value]
          INC [value]
          DEC [value]
          MOV AX, [value]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(11)
    })

    it('should handle negative values', () => {
      const source = `
        value: DW 0xFFFF
        main:
          INC [value]
          MOV AX, [value]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(0)
    })
  })

  describe('Arithmetic with Memory Operands', () => {
    it('should ADD from memory absolute', () => {
      const source = `
        JMP main
        value: DW 25
        main:
          MOV AX, 10
          ADD AX, [value]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(35)
    })

    it('should ADD from register-relative addressing', () => {
      const source = `
        JMP main
        data: DW 100, 200, 300
        main:
          MOV FP, data
          MOV AX, 5
          ADD AX, [FP+0]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(105)
    })

    it('should ADD with negative offset', () => {
      const source = `
        JMP main
        data: DW 50
        main:
          MOV FP, data
          ADD FP, 4
          MOV AX, 10
          ADD AX, [FP-4]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(60)
    })

    it('should SUB from memory absolute', () => {
      const source = `
        JMP main
        value: DW 15
        main:
          MOV AX, 50
          SUB AX, [value]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(35)
    })

    it('should SUB from register-relative addressing', () => {
      const source = `
        JMP main
        data: DW 20
        main:
          MOV FP, data
          MOV AX, 100
          SUB AX, [FP+0]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(80)
    })

    it('should CMP with memory absolute - equal', () => {
      const source = `
        JMP main
        value: DW 42
        main:
          MOV AX, 42
          CMP AX, [value]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.ZF).toBe(1)
    })

    it('should CMP with memory absolute - less than', () => {
      const source = `
        JMP main
        value: DW 100
        main:
          MOV AX, 50
          CMP AX, [value]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.SF).toBe(1)
    })

    it('should CMP with register-relative addressing', () => {
      const source = `
        JMP main
        data: DW 30
        main:
          MOV FP, data
          MOV AX, 30
          CMP AX, [FP+0]
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.ZF).toBe(1)
    })
  })

  describe('SBRK Syscall', () => {
    it('should allocate memory and return old break pointer', () => {
      const source = `
        MOV AX, 16
        SYSCALL SBRK
        SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      const info = mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os

      const initialBK = cpu.registers.BK
      while (cpu.step()) { }

      expect(cpu.registers.AX).toBe(initialBK)
      expect(cpu.registers.BK).toBe(initialBK + 16)
    })

    it('should handle multiple SBRK calls', () => {
      const source = `
        MOV AX, 10
        SYSCALL SBRK
        MOV BX, AX
        MOV AX, 20
        SYSCALL SBRK
        MOV CX, AX
        SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      const info = mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os

      const initialBK = cpu.registers.BK
      while (cpu.step()) { }

      expect(cpu.registers.BX).toBe(initialBK)
      expect(cpu.registers.CX).toBe(initialBK + 10)
      expect(cpu.registers.BK).toBe(initialBK + 30)
    })

    it('should work with existing data segment', () => {
      const source = `
        msg: DB "Hello", 0
        main:
          MOV AX, 32
          SYSCALL SBRK
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      const info = mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os

      const initialBK = cpu.registers.BK
      while (cpu.step()) { }

      expect(cpu.registers.AX).toBe(initialBK)
      expect(cpu.registers.BK).toBe(initialBK + 32)
    })
  })

  describe('ATOI Syscall', () => {
    it('should parse basic integer', () => {
      const source = `
        JMP start
        str: DB "123", 0
        start:
          MOV AX, str
          SYSCALL ATOI
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(123)
    })

    it('should handle leading whitespace', () => {
      const source = `
        JMP start
        str: DB "  42", 0
        start:
          MOV AX, str
          SYSCALL ATOI
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(42)
    })

    it('should parse multiple numbers from string', () => {
      const source = `
        JMP start
        str: DB "30 10 20", 0
        start:
          MOV AX, str
          SYSCALL ATOI
          PUSH AX
          MOV AX, BX
          SYSCALL ATOI
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(10)
    })

    it('should update pointer past parsed number', () => {
      const source = `
        JMP start
        str: DB "42X", 0
        start:
          MOV AX, str
          PUSH AX
          SYSCALL ATOI
          POP CX
          SUB BX, CX
          MOV AX, BX
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(2)
    })

    it('should parse zero', () => {
      const source = `
        JMP start
        str: DB "0", 0
        start:
          MOV AX, str
          SYSCALL ATOI
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(0)
    })

    it('should return zero for non-digit string', () => {
      const source = `
        JMP start
        str: DB "ABC", 0
        start:
          MOV AX, str
          SYSCALL ATOI
          SYSCALL EXIT
      `
      const bytecode = assemble(source)
      const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
      const mem = new Memory(memSize)
      mem.loadBinary(bytecode)
      const cpu = new CPU(mem)
      const os = new OS(cpu, mem)
      cpu.os = os
      while (cpu.step()) { }
      expect(cpu.registers.AX).toBe(0)
    })
  })
})

// ========== 16K Memory Tests ==========

describe('16K Memory Support', () => {
  it('should support .MEMORY 16K directive', () => {
    const source = `
      .MEMORY 16K
      main:
        MOV SP, 0x4000
        MOV AX, SP
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    expect(memSize).toBe(0x4000)
    const mem = new Memory(memSize)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(0x4000)
  })

  it('should handle large data buffers in 16K memory', () => {
    const source = `
      .MEMORY 16K
      large_buffer: DB 8192 DUP(0)
      test_value: DW 42
      main:
        MOV AX, [test_value]
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(42)
  })

  it('should support stack operations in 16K memory', () => {
    const source = `
      .MEMORY 16K
      main:
        MOV SP, 0x4000
        MOV AX, 100
        PUSH AX
        MOV AX, 200
        PUSH AX
        POP BX
        POP AX
        ADD AX, BX
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(300)
  })

  it('should allow access to upper memory addresses', () => {
    const source = `
      .MEMORY 16K
      main:
        MOV AX, 99
        MOV [0x3FFE], AX
        MOV BX, [0x3FFE]
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.BX).toBe(99)
  })

  it('should still support default 1K memory when directive not specified', () => {
    const source = `
      main:
        MOV SP, 0x400
        MOV AX, SP
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    expect(memSize).toBe(0x0400)
    const mem = new Memory(memSize)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(0x0400)
  })
})

// ========== Command Line Input Tests ==========

describe('Command Line Input', () => {
  it('should make command line input accessible via AX register', () => {
    const source = `
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    const info = mem.loadBinary(bytecode, 'Hello')
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os

    // AX should point to the command line input
    cpu.registers.AX = info.commandLineAddr

    const strAddr = cpu.registers.AX
    let result = ''
    for (let i = 0; i < 5; i++) {
      result += String.fromCharCode(mem.readByte(strAddr + i))
    }
    expect(result).toBe('Hello')
  })

  it('should handle empty command line input', () => {
    const source = `
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    const info = mem.loadBinary(bytecode, '')
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os

    // AX should point to a null-terminated string
    cpu.registers.AX = info.commandLineAddr
    const strAddr = cpu.registers.AX
    expect(mem.readByte(strAddr)).toBe(0)
  })

  it('should parse command line numbers with ATOI', () => {
    const source = `
      MOV BX, AX
      MOV AX, BX
      SYSCALL ATOI
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    const info = mem.loadBinary(bytecode, '42 100')
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os

    // Set AX to point to command line input
    cpu.registers.AX = info.commandLineAddr

    while (cpu.step()) { }

    // AX should contain first number
    expect(cpu.registers.AX).toBe(42)
  })
})

// ========== Sort Program Integration Tests ==========

describe('Sort Program Integration', () => {
  it('should sort three numbers and return smallest', () => {
    const source = `
      tmp: DW 0
      main:
        MOV BX, AX
        MOV CX, 0
      parse_loop:
        MOV AX, [BX+0]
        AND AX, 0xFF
        CMP AX, 0
        JE parse_done
        MOV AX, BX
        SYSCALL ATOI
        PUSH AX
        INC CX
        JMP parse_loop
      parse_done:
        PUSH CX
      sort_outer:
        MOV DX, 0
        LEA BX, [SP+2]
        MOV CX, [SP+0]
      sort_inner:
        DEC CX
        CMP CX, 0
        JL check_swap
        JE check_swap
        MOV AX, [BX+0]
        CMP AX, [BX+2]
        JL no_swap
        MOV [tmp], AX
        MOV AX, [BX+2]
        MOV [BX+0], AX
        MOV AX, [tmp]
        MOV [BX+2], AX
        MOV DX, 1
      no_swap:
        ADD BX, 2
        JMP sort_inner
      check_swap:
        CMP DX, 0
        JNE sort_outer
        POP CX
      print_loop:
        CMP CX, 0
        JE done
        POP AX
        PUSH CX
        JMP done
      done:
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    const info = mem.loadBinary(bytecode, '30 10 20')
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    cpu.registers.AX = info.commandLineAddr
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(10)
  })

  it('should sort six numbers and return smallest', () => {
    const source = `
      tmp: DW 0
      main:
        MOV BX, AX
        MOV CX, 0
      parse_loop:
        MOV AX, [BX+0]
        AND AX, 0xFF
        CMP AX, 0
        JE parse_done
        MOV AX, BX
        SYSCALL ATOI
        PUSH AX
        INC CX
        JMP parse_loop
      parse_done:
        PUSH CX
      sort_outer:
        MOV DX, 0
        LEA BX, [SP+2]
        MOV CX, [SP+0]
      sort_inner:
        DEC CX
        CMP CX, 0
        JL check_swap
        JE check_swap
        MOV AX, [BX+0]
        CMP AX, [BX+2]
        JL no_swap
        MOV [tmp], AX
        MOV AX, [BX+2]
        MOV [BX+0], AX
        MOV AX, [tmp]
        MOV [BX+2], AX
        MOV DX, 1
      no_swap:
        ADD BX, 2
        JMP sort_inner
      check_swap:
        CMP DX, 0
        JNE sort_outer
        POP CX
        POP AX
        SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const memSize = (bytecode[0x09] << 8) | bytecode[0x0A]
    const mem = new Memory(memSize)
    const info = mem.loadBinary(bytecode, '5 3 8 1 9 2')
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    cpu.registers.AX = info.commandLineAddr
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(1)
  })

  // ========== LOOP Instruction Tests ==========

  it('should execute LOOP instruction - basic countdown', () => {
    const source = `
      MOV CX, 5
      MOV AX, 0
    loop_start:
      INC AX
      LOOP loop_start
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.CX).toBe(0)
    expect(cpu.registers.AX).toBe(5)
  })

  it('should execute LOOP with single iteration', () => {
    const source = `
      MOV CX, 1
      MOV AX, 100
    loop_start:
      MOV AX, 999
      LOOP loop_start
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.CX).toBe(0)
    expect(cpu.registers.AX).toBe(999)
  })

  it('should execute LOOP with calculation', () => {
    const source = `
      MOV CX, 10
      MOV AX, 0
    sum_loop:
      ADD AX, CX
      LOOP sum_loop
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.CX).toBe(0)
    expect(cpu.registers.AX).toBe(55)  // Sum of 1-10
  })

  // ========== Indexed Addressing Tests ==========

  it('should execute MOV reg, [base+index] - load indexed', () => {
    const source = `
      JMP main
    array: DW 10, 20, 30, 40, 50
    main:
      MOV BX, array
      MOV CX, 4
      MOV AX, [BX+CX]
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(30)  // array[2]
  })

  it('should execute MOV [base+index], reg - store indexed', () => {
    const source = `
      JMP main
    array: DW 0, 0, 0, 0, 0
    main:
      MOV BX, array
      MOV CX, 6
      MOV AX, 999
      MOV [BX+CX], AX
      MOV DX, [BX+CX]
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.DX).toBe(999)  // array[3]
  })

  it('should execute indexed addressing with zero index', () => {
    const source = `
      JMP main
    array: DW 100, 200, 300
    main:
      MOV BX, array
      MOV CX, 0
      MOV AX, [BX+CX]
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.AX).toBe(100)  // array[0]
  })

  it('should execute indexed addressing with different registers', () => {
    const source = `
      JMP main
    data: DW 111, 222, 333, 444
    main:
      MOV AX, data
      MOV DX, 2
      MOV CX, [AX+DX]
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.CX).toBe(222)  // data[1]
  })

  it('should combine LOOP and indexed addressing', () => {
    const source = `
      JMP main
    array: DW 10 DUP(0)
    main:
      MOV BX, array
      MOV CX, 10
      MOV DX, 0
      MOV AX, 1
    fill_loop:
      MOV [BX+DX], AX
      ADD DX, 2
      INC AX
      LOOP fill_loop
      MOV DX, 8
      MOV AX, [BX+DX]
      SYSCALL EXIT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.loadBinary(bytecode)
    const cpu = new CPU(mem)
    const os = new OS(cpu, mem)
    cpu.os = os
    while (cpu.step()) { }
    expect(cpu.registers.CX).toBe(0)
    expect(cpu.registers.AX).toBe(5)  // array[4]
  })
})