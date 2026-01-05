import { describe, it, expect } from 'vitest'
import { assemble } from '../assembler.js'
import { Memory, CPU, Opcode } from '../emulator.js'

/**
 * Comprehensive X366 Assembly Syntax Tests
 * Tests all instruction variants and addressing modes
 */

describe('MOV Addressing Modes', () => {
  describe('Register-Indirect ([BX])', () => {
    it('should encode MOV AX, [BX]', () => {
      const bytecode = assemble('MOV AX, [BX]')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readByte(0x0022)).toBe(1)  // BX
      expect(mem.readByte(0x0023)).toBe(0)  // offset 0
    })

    it('should encode MOV [CX], DX', () => {
      const bytecode = assemble('MOV [CX], DX')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.STORER)
      expect(mem.readByte(0x0021)).toBe(3)  // DX
      expect(mem.readByte(0x0022)).toBe(2)  // CX
      expect(mem.readByte(0x0023)).toBe(0)  // offset 0
    })

    it('should execute MOV with register-indirect', () => {
      const bytecode = assemble(`
MOV BX, 0x100
MOV [BX], 42
MOV AX, [BX]
HALT
      `)
      const mem = new Memory(1024)
      mem.load(bytecode)
      const cpu = new CPU(mem)

      while (cpu.step()) {}

      expect(cpu.registers.AX).toBe(42)
      expect(cpu.registers.BX).toBe(0x100)
    })
  })

  describe('Direct Memory', () => {
    it('should encode MOV AX, [0x200]', () => {
      const bytecode = assemble('MOV AX, [0x200]')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.LOAD)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readWord(0x0022)).toBe(0x200)
    })

    it('should encode MOV [0x300], BX', () => {
      const bytecode = assemble('MOV [0x300], BX')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.STORE)
      expect(mem.readByte(0x0021)).toBe(1)  // BX
    })
  })

  describe('Register-Relative', () => {
    it('should encode positive offset: MOV AX, [FP+4]', () => {
      const bytecode = assemble('MOV AX, [FP+4]')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readByte(0x0022)).toBe(7)  // FP
      expect(mem.readByte(0x0023)).toBe(4)  // offset +4
    })

    it('should encode negative offset: MOV AX, [FP-2]', () => {
      const bytecode = assemble('MOV AX, [FP-2]')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readByte(0x0022)).toBe(7)  // FP
      expect(mem.readByte(0x0023)).toBe(254) // offset -2 (two's complement)
    })

    it('should encode store relative: MOV [SP+2], CX', () => {
      const bytecode = assemble('MOV [SP+2], CX')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.STORER)
      expect(mem.readByte(0x0021)).toBe(2)  // CX
      expect(mem.readByte(0x0022)).toBe(6)  // SP
      expect(mem.readByte(0x0023)).toBe(2)  // offset +2
    })
  })

  describe('All Registers', () => {
    it('should support all 8 registers', () => {
      const bytecode = assemble(`
MOV AX, 1
MOV BX, 2
MOV CX, 3
MOV DX, 4
MOV EX, 5
MOV FX, 6
MOV SP, 7
MOV FP, 8
      `)
      const mem = new Memory(1024)
      mem.load(bytecode)
      const cpu = new CPU(mem)

      while (cpu.step() && cpu.registers.PC < 0x0040) {}

      expect(cpu.registers.AX).toBe(1)
      expect(cpu.registers.BX).toBe(2)
      expect(cpu.registers.CX).toBe(3)
      expect(cpu.registers.DX).toBe(4)
      expect(cpu.registers.EX).toBe(5)
      expect(cpu.registers.FX).toBe(6)
      expect(cpu.registers.SP).toBe(7)
      expect(cpu.registers.FP).toBe(8)
    })
  })
})

describe('Character Literals', () => {
  it("should parse 'A' as 65", () => {
    const bytecode = assemble("MOV AL, 'A'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(65)
  })

  it("should parse escape sequence '\\n'", () => {
    const bytecode = assemble("MOV AL, '\\n'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(10)
  })

  it("should parse escape sequence '\\t'", () => {
    const bytecode = assemble("MOV AL, '\\t'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(9)
  })

  it("should parse escape sequence '\\0'", () => {
    const bytecode = assemble("MOV AL, '\\0'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(0)
  })

  it("should parse escape sequence '\\\\'", () => {
    const bytecode = assemble("MOV AL, '\\\\'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(92) // backslash
  })
})

describe('Byte Registers', () => {
  it('should support AL, BL, CL, DL, EL, FL', () => {
    const bytecode = assemble(`
MOV AL, 1
MOV BL, 2
MOV CL, 3
MOV DL, 4
MOV EL, 5
MOV FL, 6
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step() && cpu.registers.PC < 0x0040) {}

    expect(cpu.registers.AX & 0xFF).toBe(1)
    expect(cpu.registers.BX & 0xFF).toBe(2)
    expect(cpu.registers.CX & 0xFF).toBe(3)
    expect(cpu.registers.DX & 0xFF).toBe(4)
    expect(cpu.registers.EX & 0xFF).toBe(5)
    expect(cpu.registers.FX & 0xFF).toBe(6)
  })
})

describe('Data Directives', () => {
  it('should assemble DB with string', () => {
    const bytecode = assemble('msg: DB "Hello", 0')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(72)  // 'H'
    expect(mem.readByte(0x0021)).toBe(101) // 'e'
    expect(mem.readByte(0x0022)).toBe(108) // 'l'
    expect(mem.readByte(0x0023)).toBe(108) // 'l'
    expect(mem.readByte(0x0024)).toBe(111) // 'o'
    expect(mem.readByte(0x0025)).toBe(0)   // null
  })

  it('should assemble DB with character literals', () => {
    const bytecode = assemble("data: DB 'A', 'B', '\\n', '\\0'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(65)  // 'A'
    expect(mem.readByte(0x0021)).toBe(66)  // 'B'
    expect(mem.readByte(0x0022)).toBe(10)  // '\n'
    expect(mem.readByte(0x0023)).toBe(0)   // '\0'
  })

  it('should assemble DB with DUP', () => {
    const bytecode = assemble('buffer: DB 10 DUP(0)')
    const mem = new Memory(1024)
    mem.load(bytecode)

    for (let i = 0; i < 10; i++) {
      expect(mem.readByte(0x0020 + i)).toBe(0)
    }
  })

  it('should assemble DW (Define Word)', () => {
    const bytecode = assemble('words: DW 100, 200, 0x1234')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0020)).toBe(100)
    expect(mem.readWord(0x0022)).toBe(200)
    expect(mem.readWord(0x0024)).toBe(0x1234)
  })

  it('should assemble DW with DUP', () => {
    const bytecode = assemble('array: DW 5 DUP(1000)')
    const mem = new Memory(1024)
    mem.load(bytecode)

    for (let i = 0; i < 5; i++) {
      expect(mem.readWord(0x0020 + i * 2)).toBe(1000)
    }
  })

  it('should separate code and data segments', () => {
    const bytecode = assemble(`
MOV AX, msg
HALT
msg: DB "Test", 0
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    // Code should be at 0x0020
    expect(mem.readByte(0x0020)).toBe(Opcode.MOV_REG_IMM)
    expect(mem.readByte(0x0024)).toBe(Opcode.HLT)

    // Data should be after code (at 0x0026)
    expect(mem.readByte(0x0026)).toBe(84)  // 'T'
  })
})

describe('All Instruction Types', () => {
  it('should encode all arithmetic instructions', () => {
    const bytecode = assemble(`
ADD AX, BX
ADD CX, 10
SUB DX, EX
SUB FX, 5
INC AX
DEC BX
MUL CX
DIV DX
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.ADD_REG_REG)
    expect(mem.readByte(0x0024)).toBe(Opcode.ADD_REG_IMM)
    expect(mem.readByte(0x0028)).toBe(Opcode.SUB_REG_REG)
    expect(mem.readByte(0x002C)).toBe(Opcode.SUB_REG_IMM)
    expect(mem.readByte(0x0030)).toBe(Opcode.INC_REG)
    expect(mem.readByte(0x0032)).toBe(Opcode.DEC_REG)
    expect(mem.readByte(0x0034)).toBe(Opcode.MUL)
    expect(mem.readByte(0x0036)).toBe(Opcode.DIV)
  })

  it('should encode all logical instructions', () => {
    const bytecode = assemble(`
AND AX, BX
AND CX, 0xFF
OR DX, EX
OR FX, 0xF0
XOR AX, BX
XOR CX, 0x00FF
NOT DX
SHL EX, 4
SHR FX, 2
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.AND_REG_REG)
    expect(mem.readByte(0x0024)).toBe(Opcode.AND_REG_IMM)
    expect(mem.readByte(0x0028)).toBe(Opcode.OR_REG_REG)
    expect(mem.readByte(0x002C)).toBe(Opcode.OR_REG_IMM)
    expect(mem.readByte(0x0030)).toBe(Opcode.XOR_REG_REG)
    expect(mem.readByte(0x0034)).toBe(Opcode.XOR_REG_IMM)
    expect(mem.readByte(0x0038)).toBe(Opcode.NOT)
    expect(mem.readByte(0x003A)).toBe(Opcode.SHL)
    expect(mem.readByte(0x003E)).toBe(Opcode.SHR)
  })

  it('should encode all comparison and jump instructions', () => {
    const bytecode = assemble(`
label:
CMP AX, BX
CMP CX, 10
JMP label
JE label
JNE label
JL label
JG label
JLE label
JGE label
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.CMP_REG_REG)
    expect(mem.readByte(0x0024)).toBe(Opcode.CMP_REG_IMM)
    expect(mem.readByte(0x0028)).toBe(Opcode.JMP)
    expect(mem.readByte(0x002C)).toBe(Opcode.JE)
    expect(mem.readByte(0x0030)).toBe(Opcode.JNE)
    expect(mem.readByte(0x0034)).toBe(Opcode.JL)
    expect(mem.readByte(0x0038)).toBe(Opcode.JG)
    expect(mem.readByte(0x003C)).toBe(Opcode.JLE)
    expect(mem.readByte(0x0040)).toBe(Opcode.JGE)
  })

  it('should encode stack and function instructions', () => {
    const bytecode = assemble(`
PUSH AX
PUSH BX
POP CX
POP DX
CALL func
RET
func:
  HALT
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.PUSH)
    expect(mem.readByte(0x0022)).toBe(Opcode.PUSH)
    expect(mem.readByte(0x0024)).toBe(Opcode.POP)
    expect(mem.readByte(0x0026)).toBe(Opcode.POP)
    expect(mem.readByte(0x0028)).toBe(Opcode.CALL)
    expect(mem.readByte(0x002C)).toBe(Opcode.RET)
  })
})

describe('Edge Cases', () => {
  it('should handle maximum positive offset (+127)', () => {
    const bytecode = assemble('MOV AX, [FP+127]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0023)).toBe(127)
  })

  it('should handle maximum negative offset (-128)', () => {
    const bytecode = assemble('MOV AX, [FP-128]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0023)).toBe(128) // -128 in two's complement
  })

  it('should handle maximum immediate value (0xFFFF)', () => {
    const bytecode = assemble('MOV AX, 0xFFFF')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(0xFFFF)
  })

  it('should handle negative immediate values', () => {
    const bytecode = assemble('MOV AX, -1')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(0xFFFF) // -1 in two's complement
  })

  it('should handle zero offset [BX+0] same as [BX]', () => {
    const bytecode1 = assemble('MOV AX, [BX+0]')
    const bytecode2 = assemble('MOV AX, [BX]')
    const mem1 = new Memory(1024)
    const mem2 = new Memory(1024)
    mem1.load(bytecode1)
    mem2.load(bytecode2)

    // Both should encode the same way
    expect(mem1.readByte(0x0020)).toBe(mem2.readByte(0x0020))
    expect(mem1.readByte(0x0021)).toBe(mem2.readByte(0x0021))
    expect(mem1.readByte(0x0022)).toBe(mem2.readByte(0x0022))
    expect(mem1.readByte(0x0023)).toBe(mem2.readByte(0x0023))
  })
})

describe('Integration Tests', () => {
  it('should execute program using register-indirect addressing', () => {
    const bytecode = assemble(`
msg: DB "A", 0

main:
MOV BX, msg
MOV AL, [BX]
HALT
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {}

    expect(cpu.registers.AX & 0xFF).toBe(65) // 'A'
  })

  it('should execute complex program with all features', () => {
    const bytecode = assemble(`
; Data
values: DW 10, 20, 30

main:
  ; Load array pointer
  MOV BX, values

  ; Load first value
  MOV AX, [BX]

  ; Use character comparison
  CMP AL, 'A'
  JL skip

skip:
  ; Stack operations
  PUSH AX
  POP CX

  HALT
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    let steps = 0
    while (cpu.step() && steps++ < 100) {}

    expect(cpu.halted).toBe(true)
  })
})
