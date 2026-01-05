import { describe, it, expect } from 'vitest'
import { tokenize, assemble } from '../assembler.js'
import { Memory, CPU, Opcode } from '../emulator.js'

// ============================================================================
// Tokenizer Tests
// ============================================================================

describe('Tokenizer', () => {
  it('should tokenize simple instruction', () => {
    const tokens = tokenize('MOV AX, 5')

    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('INSTRUCTION')
    expect(tokens[0].instruction).toBe('MOV')
    expect(tokens[0].operands).toEqual(['AX', '5'])
  })

  it('should handle labels', () => {
    const source = `
loop:
  MOV AX, 5
    `
    const tokens = tokenize(source)

    expect(tokens).toHaveLength(2)
    expect(tokens[0].type).toBe('LABEL')
    expect(tokens[0].value).toBe('loop')
    expect(tokens[1].type).toBe('INSTRUCTION')
  })

  it('should handle label on same line as instruction', () => {
    const tokens = tokenize('start: MOV AX, 5')

    expect(tokens).toHaveLength(2)
    expect(tokens[0].type).toBe('LABEL')
    expect(tokens[0].value).toBe('start')
    expect(tokens[1].instruction).toBe('MOV')
  })

  it('should remove comments', () => {
    const source = `
MOV AX, 5  ; This is a comment
; Full line comment
ADD AX, 10
    `
    const tokens = tokenize(source)

    expect(tokens).toHaveLength(2)
    expect(tokens[0].instruction).toBe('MOV')
    expect(tokens[1].instruction).toBe('ADD')
  })

  it('should handle empty lines', () => {
    const source = `
MOV AX, 5

ADD AX, 10
    `
    const tokens = tokenize(source)

    expect(tokens).toHaveLength(2)
  })
})

// ============================================================================
// Assembler Tests
// ============================================================================

describe('Assembler', () => {
  it('should assemble simple program', () => {
    const source = `
MOV AX, 5
HALT
    `
    const bytecode = assemble(source)

    expect(bytecode).toBeInstanceOf(Uint8Array)
    expect(bytecode.length).toBeGreaterThan(0)

    // Check signature
    const signature = 'Go Cats!'
    for (let i = 0; i < signature.length; i++) {
      expect(bytecode[i]).toBe(signature.charCodeAt(i))
    }

    // Check instructions start at 0x0020
    expect(bytecode[0x0020]).toBe(Opcode.MOV_REG_IMM)
  })

  it('should handle labels and jumps', () => {
    const source = `
start:
  MOV AX, 5
  JMP end
  MOV AX, 10
end:
  HALT
    `
    const bytecode = assemble(source)

    // Load into memory and verify
    const mem = new Memory(1024)
    mem.load(bytecode)

    // JMP instruction should have correct address
    expect(mem.readByte(0x0020)).toBe(Opcode.MOV_REG_IMM)
    expect(mem.readByte(0x0024)).toBe(Opcode.JMP)
  })

  it('should resolve forward labels', () => {
    const source = `
JMP target
MOV AX, 1
target:
  MOV AX, 2
  HALT
    `
    const bytecode = assemble(source)

    const mem = new Memory(1024)
    mem.load(bytecode)

    // First instruction should be JMP
    expect(mem.readByte(0x0020)).toBe(Opcode.JMP)

    // JMP target should point to 0x0028 (0x0020 + 4 + 4)
    const targetAddr = mem.readWord(0x0022)
    expect(targetAddr).toBe(0x0028)
  })

  describe('Instruction Encoding', () => {
    it('should encode MOV with immediate', () => {
      const bytecode = assemble('MOV AX, 0x1234')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.MOV_REG_IMM)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readWord(0x0022)).toBe(0x1234)
    })

    it('should encode MOV register to register', () => {
      const bytecode = assemble('MOV AX, BX')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.MOV_REG_REG)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readByte(0x0022)).toBe(1)  // BX
    })

    it('should encode ADD with immediate', () => {
      const bytecode = assemble('ADD AX, 10')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.ADD_REG_IMM)
      expect(mem.readByte(0x0021)).toBe(0)  // AX
      expect(mem.readWord(0x0022)).toBe(10)
    })

    it('should encode PUSH and POP', () => {
      const bytecode = assemble(`
PUSH AX
POP BX
      `)
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.PUSH)
      expect(mem.readByte(0x0021)).toBe(0)  // AX

      expect(mem.readByte(0x0022)).toBe(Opcode.POP)
      expect(mem.readByte(0x0023)).toBe(1)  // BX
    })

    it('should encode CALL and RET', () => {
      const bytecode = assemble(`
CALL func
HALT
func:
  RET
      `)
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readByte(0x0020)).toBe(Opcode.CALL)
      expect(mem.readByte(0x0024)).toBe(Opcode.HLT)
      expect(mem.readByte(0x0026)).toBe(Opcode.RET)
    })
  })

  describe('Number Formats', () => {
    it('should parse hexadecimal numbers', () => {
      const bytecode = assemble('MOV AX, 0xFF')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readWord(0x0022)).toBe(0xFF)
    })

    it('should parse decimal numbers', () => {
      const bytecode = assemble('MOV AX, 255')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readWord(0x0022)).toBe(255)
    })

    it('should parse binary numbers', () => {
      const bytecode = assemble('MOV AX, 0b11111111')
      const mem = new Memory(1024)
      mem.load(bytecode)

      expect(mem.readWord(0x0022)).toBe(255)
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Assembler Integration', () => {
  it('should execute assembled arithmetic program', () => {
    const source = `
MOV AX, 5
MOV BX, 10
ADD AX, BX
HALT
    `
    const bytecode = assemble(source)

    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    expect(cpu.registers.AX).toBe(15)
    expect(cpu.registers.BX).toBe(10)
  })

  it('should execute assembled conditional program', () => {
    const source = `
MOV CX, 5
loop:
  DEC CX
  CMP CX, 0
  JNE loop
HALT
    `
    const bytecode = assemble(source)

    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    let steps = 0
    while (cpu.step() && steps++ < 100) {
      // Execute until HALT
    }

    expect(cpu.registers.CX).toBe(0)
    expect(cpu.halted).toBe(true)
  })

  it('should execute assembled function call', () => {
    const source = `
CALL add_five
HALT

add_five:
  MOV AX, 5
  RET
    `
    const bytecode = assemble(source)

    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    expect(cpu.registers.AX).toBe(5)
    expect(cpu.halted).toBe(true)
  })

  it('should execute complex program with multiple labels', () => {
    const source = `
start:
  MOV AX, 0
  MOV CX, 3

loop:
  ADD AX, 5
  DEC CX
  CMP CX, 0
  JNZ loop

done:
  HALT
    `
    const bytecode = assemble(source)

    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    let steps = 0
    while (cpu.step() && steps++ < 100) {
      // Execute until HALT
    }

    expect(cpu.registers.AX).toBe(15)  // 5 + 5 + 5
    expect(cpu.registers.CX).toBe(0)
    expect(cpu.halted).toBe(true)
  })

  it('should handle nested function calls', () => {
    const source = `
CALL func_a
HALT

func_a:
  PUSH AX
  MOV AX, 10
  CALL func_b
  POP AX
  RET

func_b:
  ADD AX, 5
  RET
    `
    const bytecode = assemble(source)

    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    expect(cpu.registers.AX).toBe(0)  // Restored from stack
    expect(cpu.halted).toBe(true)
  })
})

// ============================================================================
// Comprehensive Instruction Syntax Tests
// ============================================================================

describe('MOV Instruction Variants', () => {
  it('should encode MOV register-indirect load (MOV AX, [BX])', () => {
    const bytecode = assemble('MOV AX, [BX]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readByte(0x0022)).toBe(1)  // BX
    expect(mem.readByte(0x0023)).toBe(0)  // offset 0
  })

  it('should encode MOV register-indirect store (MOV [BX], AX)', () => {
    const bytecode = assemble('MOV [BX], AX')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.STORER)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readByte(0x0022)).toBe(1)  // BX
    expect(mem.readByte(0x0023)).toBe(0)  // offset 0
  })

  it('should encode MOV with direct memory address', () => {
    const bytecode = assemble('MOV AX, [0x200]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.LOAD)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readWord(0x0022)).toBe(0x200)
  })

  it('should encode MOV [addr], imm with STOREI_DIRECT', () => {
    const bytecode = assemble('MOV [0x200], 42')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.STOREI_DIRECT)
    expect(mem.readWord(0x0021)).toBe(0x0200)  // address
    expect(mem.readByte(0x0023)).toBe(42)       // byte immediate
  })

  it('should reject MOV [addr], imm with value > 255', () => {
    expect(() => assemble('MOV [0x200], 256')).toThrow(/0-255/)
  })

  it('should encode MOV store to direct memory', () => {
    const bytecode = assemble('MOV [0x200], BX')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.STORE)
    expect(mem.readByte(0x0021)).toBe(1)  // BX
  })

  it('should encode MOV with register-relative positive offset', () => {
    const bytecode = assemble('MOV AX, [FP+4]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readByte(0x0022)).toBe(7)  // FP
    expect(mem.readByte(0x0023)).toBe(4)  // offset +4
  })

  it('should encode MOV with register-relative negative offset', () => {
    const bytecode = assemble('MOV AX, [FP-2]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readByte(0x0022)).toBe(7)  // FP
    expect(mem.readByte(0x0023)).toBe(254) // offset -2 (two's complement)
  })

  it('should encode MOV with label as immediate address', () => {
    const bytecode = assemble(`
data: DB 0
MOV AX, data
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    // Should encode as MOV_REG_IMM with address of data
    expect(mem.readByte(0x0020)).toBe(Opcode.MOV_REG_IMM)
    expect(mem.readByte(0x0021)).toBe(0)  // AX register
    // Address of data label should be in bytes 0x0022-0x0023
  })
})

describe('Byte Operations', () => {
  it('should encode byte immediate (MOV AL, 65)', () => {
    const bytecode = assemble('MOV AL, 65')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.MOV_REG_IMM)
    expect(mem.readWord(0x0022)).toBe(65)
  })

  it('should encode character literal (MOV AL, \'A\')', () => {
    const bytecode = assemble("MOV AL, 'A'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(65)  // ASCII 'A'
  })

  it('should encode escape sequence newline (MOV AL, \'\\n\')', () => {
    const bytecode = assemble("MOV AL, '\\n'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(10)  // newline
  })

  it('should encode escape sequence tab (MOV AL, \'\\t\')', () => {
    const bytecode = assemble("MOV AL, '\\t'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(9)  // tab
  })

  it('should encode escape sequence null (MOV AL, \'\\0\')', () => {
    const bytecode = assemble("MOV AL, '\\0'")
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readWord(0x0022)).toBe(0)  // null
  })

  it('should test all byte registers', () => {
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

    // All should encode as MOV_REG_IMM
    for (let i = 0; i < 6; i++) {
      expect(mem.readByte(0x0020 + i * 4)).toBe(Opcode.MOV_REG_IMM)
    }
  })
})

describe('Arithmetic Instructions', () => {
  it('should encode ADD with memory operand', () => {
    const bytecode = assemble('ADD AX, [0x200]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.ADD_MEM)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readWord(0x0022)).toBe(0x200)
  })

  it('should encode ADD with register-relative', () => {
    const bytecode = assemble('ADD AX, [FP+2]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.ADD_MEM_REL)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readByte(0x0022)).toBe(7)  // FP
    expect(mem.readByte(0x0023)).toBe(2)  // offset
  })

  it('should encode SUB with memory operand', () => {
    const bytecode = assemble('SUB BX, [0x300]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.SUB_MEM)
    expect(mem.readByte(0x0021)).toBe(1)  // BX
  })

  it('should encode INC with memory address', () => {
    const bytecode = assemble('INC [0x200]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.INC_MEM)
  })

  it('should encode INC with register-relative', () => {
    const bytecode = assemble('INC [FP+2]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.INC_MEM_REL)
  })

  it('should encode DEC with memory address', () => {
    const bytecode = assemble('DEC [0x200]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.DEC_MEM)
  })

  it('should encode all arithmetic register operations', () => {
    const bytecode = assemble(`
ADD AX, BX
SUB CX, DX
INC EX
DEC FX
MUL BX
DIV CX
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.ADD_REG_REG)
    expect(mem.readByte(0x0024)).toBe(Opcode.SUB_REG_REG)
    expect(mem.readByte(0x0028)).toBe(Opcode.INC)
    expect(mem.readByte(0x002A)).toBe(Opcode.DEC)
    expect(mem.readByte(0x002C)).toBe(Opcode.MUL)
    expect(mem.readByte(0x002E)).toBe(Opcode.DIV)
  })
})

describe('Logical & Bitwise Instructions', () => {
  it('should encode AND register-register', () => {
    const bytecode = assemble('AND AX, BX')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.AND_REG)
  })

  it('should encode AND register-immediate', () => {
    const bytecode = assemble('AND AX, 0xFF')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.AND_IMM)
    expect(mem.readWord(0x0022)).toBe(0xFF)
  })

  it('should encode OR, XOR, NOT', () => {
    const bytecode = assemble(`
OR AX, BX
XOR CX, DX
NOT EX
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.OR_REG)
    expect(mem.readByte(0x0024)).toBe(Opcode.XOR_REG)
    expect(mem.readByte(0x0028)).toBe(Opcode.NOT)
  })

  it('should encode shift operations', () => {
    const bytecode = assemble(`
SHL AX, 4
SHR BX, 2
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.SHL)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readWord(0x0022)).toBe(4)  // shift count (16-bit big-endian)
    expect(mem.readByte(0x0024)).toBe(Opcode.SHR)
    expect(mem.readByte(0x0025)).toBe(1)  // BX
    expect(mem.readWord(0x0026)).toBe(2)  // shift count (16-bit big-endian)
  })
})

describe('Comparison & Jump Instructions', () => {
  it('should encode CMP with memory operand', () => {
    const bytecode = assemble('CMP AX, [0x200]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.CMP_MEM)
  })

  it('should encode CMP with register-relative', () => {
    const bytecode = assemble('CMP BX, [FP+4]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.CMP_MEM_REL)
  })

  it('should encode all jump types', () => {
    const bytecode = assemble(`
label:
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

    expect(mem.readByte(0x0020)).toBe(Opcode.JMP)
    expect(mem.readByte(0x0024)).toBe(Opcode.JE)
    expect(mem.readByte(0x0028)).toBe(Opcode.JNE)
    expect(mem.readByte(0x002C)).toBe(Opcode.JL)
    expect(mem.readByte(0x0030)).toBe(Opcode.JG)
    expect(mem.readByte(0x0034)).toBe(Opcode.JLE)
    expect(mem.readByte(0x0038)).toBe(Opcode.JGE)
  })
})

describe('Data Directives', () => {
  it('should assemble DB with string', () => {
    const bytecode = assemble('msg: DB "Hello", 0')
    const mem = new Memory(1024)
    mem.load(bytecode)

    // Data starts at 0x0020
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

    // Should create 10 zero bytes
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

    // Should create 5 words of value 1000
    for (let i = 0; i < 5; i++) {
      expect(mem.readWord(0x0020 + i * 2)).toBe(1000)
    }
  })

  it('should place data at end after code', () => {
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

describe('LEA Instruction', () => {
  it('should encode LEA with register-relative', () => {
    const bytecode = assemble('LEA AX, [FP-4]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.LEA)
    expect(mem.readByte(0x0021)).toBe(0)  // AX
    expect(mem.readByte(0x0022)).toBe(7)  // FP
    expect(mem.readByte(0x0023)).toBe(252) // offset -4
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

  it('should handle zero offset [BX+0]', () => {
    const bytecode = assemble('MOV AX, [BX+0]')
    const mem = new Memory(1024)
    mem.load(bytecode)

    expect(mem.readByte(0x0020)).toBe(Opcode.LOADR)
    expect(mem.readByte(0x0023)).toBe(0)
  })

  it('should handle all registers', () => {
    const bytecode = assemble(`
MOV AX, AX
MOV BX, BX
MOV CX, CX
MOV DX, DX
MOV EX, EX
MOV FX, FX
MOV SP, SP
MOV FP, FP
    `)
    const mem = new Memory(1024)
    mem.load(bytecode)

    // All should encode as MOV_REG_REG
    for (let i = 0; i < 8; i++) {
      expect(mem.readByte(0x0020 + i * 4)).toBe(Opcode.MOV_REG_REG)
    }
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
})

// ============================================================================
// JZ/JNZ Alias Tests
// ============================================================================

describe('JZ/JNZ Aliases', () => {
  it('JZ should be alias for JE (same opcode)', () => {
    const codeJZ = assemble('JZ done\ndone: HALT')
    const codeJE = assemble('JE done\ndone: HALT')

    // Both should produce identical bytecode
    expect(codeJZ[0x20]).toBe(codeJE[0x20])
    expect(codeJZ[0x20]).toBe(0x51) // JE opcode
  })

  it('JNZ should be alias for JNE (same opcode)', () => {
    const codeJNZ = assemble('JNZ loop\nloop: HALT')
    const codeJNE = assemble('JNE loop\nloop: HALT')

    // Both should produce identical bytecode
    expect(codeJNZ[0x20]).toBe(codeJNE[0x20])
    expect(codeJNZ[0x20]).toBe(0x52) // JNE opcode
  })

  it('JZ should work in typical context (after DEC)', () => {
    const source = `
MOV AX, 3
loop:
  DEC AX
  JZ done
  JMP loop
done:
  HALT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    expect(cpu.registers.AX).toBe(0)
    expect(cpu.halted).toBe(true)
  })

  it('JNZ should work in typical loop', () => {
    const source = `
MOV CX, 3
MOV AX, 0
loop:
  ADD AX, 5
  DEC CX
  JNZ loop
HALT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    expect(cpu.registers.AX).toBe(15) // 5 + 5 + 5
    expect(cpu.registers.CX).toBe(0)
  })
})

// ============================================================================
// HLT/HALT Alias Tests
// ============================================================================

describe('HLT/HALT Aliases', () => {
  it('HALT should be alias for HLT (same opcode)', () => {
    const codeHALT = assemble('HALT')
    const codeHLT = assemble('HLT')

    // Both should produce identical bytecode
    expect(codeHALT[0x20]).toBe(codeHLT[0x20])
    expect(codeHALT[0x20]).toBe(0x01) // HLT opcode
  })

  it('Both HLT and HALT should halt execution', () => {
    const sourceHLT = 'MOV AX, 42\nHLT'
    const sourceHALT = 'MOV AX, 42\nHALT'

    const bytecodeHLT = assemble(sourceHLT)
    const bytecodeHALT = assemble(sourceHALT)

    const memHLT = new Memory(1024)
    memHLT.load(bytecodeHLT)
    const cpuHLT = new CPU(memHLT)

    const memHALT = new Memory(1024)
    memHALT.load(bytecodeHALT)
    const cpuHALT = new CPU(memHALT)

    // Run both to completion
    while (cpuHLT.step()) {}
    while (cpuHALT.step()) {}

    // Both should halt with same result
    expect(cpuHLT.halted).toBe(true)
    expect(cpuHALT.halted).toBe(true)
    expect(cpuHLT.registers.AX).toBe(42)
    expect(cpuHALT.registers.AX).toBe(42)
  })
})

// ============================================================================
// Stacked Labels Tests
// ============================================================================

describe('Stacked Labels', () => {
  it('Multiple labels should point to the same instruction', () => {
    const source = `
label1:
label2:
label3:
  MOV AX, 42
  JMP label1
  JMP label2
  JMP label3
  HLT
    `
    const bytecode = assemble(source)

    // All three JMP instructions should target the same address (0x20 - the MOV instruction)
    // JMP is 4 bytes: [opcode][unused][addr_hi][addr_lo]
    // JMP label1 is at 0x24-0x27, target at bytes 0x26-0x27
    // JMP label2 is at 0x28-0x2B, target at bytes 0x2A-0x2B
    // JMP label3 is at 0x2C-0x2F, target at bytes 0x2E-0x2F
    const jmp1_target = (bytecode[0x26] << 8) | bytecode[0x27]
    const jmp2_target = (bytecode[0x2A] << 8) | bytecode[0x2B]
    const jmp3_target = (bytecode[0x2E] << 8) | bytecode[0x2F]

    expect(jmp1_target).toBe(0x20)
    expect(jmp2_target).toBe(0x20)
    expect(jmp3_target).toBe(0x20)
  })

  it('Stacked labels should work with data directives', () => {
    const source = `
msg1:
msg2:
  DB "Hello", 0
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.load(bytecode)

    // Both labels should point to the start of data
    // Data starts after code, which starts at 0x20
    // Since there's no code, data should be at 0x20
    expect(mem.readByte(0x20)).toBe(72) // 'H'
  })
})

// ============================================================================
// Default Shift Count Tests
// ============================================================================

describe('Default Shift Count', () => {
  it('SHL without count should default to 1', () => {
    const codeDefault = assemble('SHL AX')
    const codeExplicit = assemble('SHL AX, 1')

    // Both should produce identical bytecode
    expect(codeDefault[0x20]).toBe(codeExplicit[0x20]) // opcode
    expect(codeDefault[0x21]).toBe(codeExplicit[0x21]) // register
    // Count is in bytes 2-3 (big-endian 16-bit)
    expect(codeDefault[0x22]).toBe(0) // high byte
    expect(codeDefault[0x23]).toBe(1) // low byte = 1
  })

  it('SHR without count should default to 1', () => {
    const codeDefault = assemble('SHR BX')
    const codeExplicit = assemble('SHR BX, 1')

    expect(codeDefault[0x20]).toBe(codeExplicit[0x20])
    expect(codeDefault[0x21]).toBe(codeExplicit[0x21])
    expect(codeDefault[0x23]).toBe(1) // low byte of count
  })

  it('SHL with explicit count should still work', () => {
    const code = assemble('SHL AX, 4')
    expect(code[0x23]).toBe(4) // low byte of count = 4
  })

  it('SHL default should execute correctly', () => {
    const source = `
MOV AX, 8
SHL AX
HALT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    // AX started at 8, shifted left by 1 = 16
    expect(cpu.registers.AX).toBe(16)
  })

  it('SHR default should execute correctly', () => {
    const source = `
MOV AX, 16
SHR AX
HALT
    `
    const bytecode = assemble(source)
    const mem = new Memory(1024)
    mem.load(bytecode)
    const cpu = new CPU(mem)

    while (cpu.step()) {
      // Execute until HALT
    }

    // AX started at 16, shifted right by 1 = 8
    expect(cpu.registers.AX).toBe(8)
  })
})

// ============================================================================
// Debug Section Tests
// ============================================================================

describe('Debug Section Format', () => {
  it('should generate debug section with correct type', () => {
    const source = `
main:
  MOV AX, 10
  ADD AX, 20
  HALT
    `
    const bytecode = assemble(source)

    // Read sections offset from header (0x000C-0x000F, big-endian 32-bit)
    const sectionsOffset = (bytecode[0x0C] << 24) |
                          (bytecode[0x0D] << 16) |
                          (bytecode[0x0E] << 8) |
                          bytecode[0x0F]

    expect(sectionsOffset).toBeGreaterThan(0)
    expect(sectionsOffset).toBeLessThan(bytecode.length)

    // Section type should be 0x01 (debug info)
    expect(bytecode[sectionsOffset]).toBe(0x01)
  })

  it('should have correct debug section size field', () => {
    const source = `
loop:
  MOV AX, 5
  JMP loop
    `
    const bytecode = assemble(source)

    const sectionsOffset = (bytecode[0x0C] << 24) |
                          (bytecode[0x0D] << 16) |
                          (bytecode[0x0E] << 8) |
                          bytecode[0x0F]

    // Read section size (4 bytes, big-endian)
    const sectionSize = (bytecode[sectionsOffset + 1] << 24) |
                       (bytecode[sectionsOffset + 2] << 16) |
                       (bytecode[sectionsOffset + 3] << 8) |
                       bytecode[sectionsOffset + 4]

    expect(sectionSize).toBeGreaterThan(0)

    // Verify size is reasonable (should contain line map + symbol table)
    expect(sectionSize).toBeLessThan(1000)
  })

  it('should generate line number map with correct format', () => {
    const source = `
MOV AX, 10
ADD AX, 20
    `
    const bytecode = assemble(source)

    const sectionsOffset = (bytecode[0x0C] << 24) |
                          (bytecode[0x0D] << 16) |
                          (bytecode[0x0E] << 8) |
                          bytecode[0x0F]

    let offset = sectionsOffset + 5 // Skip type and size fields

    // First line map entry: PC=0x0020 (first instruction)
    const pc1 = (bytecode[offset] << 8) | bytecode[offset + 1]
    const line1 = (bytecode[offset + 2] << 8) | bytecode[offset + 3]
    expect(pc1).toBe(0x0020)
    expect(line1).toBeGreaterThan(0) // Should have a valid line number

    offset += 4

    // Second line map entry: PC=0x0024 (second instruction, 4-byte MOV)
    const pc2 = (bytecode[offset] << 8) | bytecode[offset + 1]
    const line2 = (bytecode[offset + 2] << 8) | bytecode[offset + 3]
    expect(pc2).toBe(0x0024)
    expect(line2).toBeGreaterThan(line1) // Later line

    offset += 4

    // Line map end marker: 0xFFFF 0x0000
    expect(bytecode[offset]).toBe(0xFF)
    expect(bytecode[offset + 1]).toBe(0xFF)
    expect(bytecode[offset + 2]).toBe(0x00)
    expect(bytecode[offset + 3]).toBe(0x00)
  })

  it('should generate symbol table with null-terminated strings', () => {
    const source = `
main:
  MOV AX, 10
loop:
  ADD AX, 1
  JMP loop
    `
    const bytecode = assemble(source)

    const sectionsOffset = (bytecode[0x0C] << 24) |
                          (bytecode[0x0D] << 16) |
                          (bytecode[0x0E] << 8) |
                          bytecode[0x0F]

    let offset = sectionsOffset + 5

    // Skip line number map - find end marker 0xFFFF 0x0000
    while (offset < bytecode.length - 4) {
      if (bytecode[offset] === 0xFF &&
          bytecode[offset + 1] === 0xFF &&
          bytecode[offset + 2] === 0x00 &&
          bytecode[offset + 3] === 0x00) {
        offset += 4
        break
      }
      offset += 4 // Each line map entry is 4 bytes
    }

    // Now at symbol table
    // First symbol: address (2 bytes), type (1 byte), name (null-terminated)
    const addr1 = (bytecode[offset] << 8) | bytecode[offset + 1]
    const type1 = bytecode[offset + 2]
    expect(type1).toBe(0x00) // Symbol type: label

    // Read null-terminated name
    let name1 = ''
    let i = offset + 3
    while (bytecode[i] !== 0x00 && i < bytecode.length) {
      name1 += String.fromCharCode(bytecode[i])
      i++
    }
    expect(name1.length).toBeGreaterThan(0)
    expect(bytecode[i]).toBe(0x00) // Null terminator

    // Verify it's one of our labels
    expect(['main', 'loop']).toContain(name1)
  })

  it('should end symbol table with correct marker', () => {
    const source = `
test:
  MOV AX, 42
  HALT
    `
    const bytecode = assemble(source)

    const sectionsOffset = (bytecode[0x0C] << 24) |
                          (bytecode[0x0D] << 16) |
                          (bytecode[0x0E] << 8) |
                          bytecode[0x0F]

    const sectionSize = (bytecode[sectionsOffset + 1] << 24) |
                       (bytecode[sectionsOffset + 2] << 16) |
                       (bytecode[sectionsOffset + 3] << 8) |
                       bytecode[sectionsOffset + 4]

    // Symbol table end marker should be at: sectionsOffset + 5 + sectionSize - 4
    const endMarkerOffset = sectionsOffset + 5 + sectionSize - 4

    // End marker: 0xFFFF 0x00 0x00
    expect(bytecode[endMarkerOffset]).toBe(0xFF)
    expect(bytecode[endMarkerOffset + 1]).toBe(0xFF)
    expect(bytecode[endMarkerOffset + 2]).toBe(0x00)
    expect(bytecode[endMarkerOffset + 3]).toBe(0x00)
  })

  it('should handle multiple labels correctly', () => {
    const source = `
start:
  MOV AX, 0
loop1:
  ADD AX, 5
loop2:
  SUB AX, 1
end:
  HALT
    `
    const bytecode = assemble(source)

    const sectionsOffset = (bytecode[0x0C] << 24) |
                          (bytecode[0x0D] << 16) |
                          (bytecode[0x0E] << 8) |
                          bytecode[0x0F]

    let offset = sectionsOffset + 5

    // Skip to symbol table (past line map)
    while (offset < bytecode.length - 4) {
      if (bytecode[offset] === 0xFF &&
          bytecode[offset + 1] === 0xFF &&
          bytecode[offset + 2] === 0x00 &&
          bytecode[offset + 3] === 0x00) {
        offset += 4
        break
      }
      offset += 4
    }

    // Count symbols
    let symbolCount = 0
    const labels = []

    while (offset < bytecode.length - 4) {
      // Check for end marker
      if (bytecode[offset] === 0xFF &&
          bytecode[offset + 1] === 0xFF &&
          bytecode[offset + 2] === 0x00 &&
          bytecode[offset + 3] === 0x00) {
        break
      }

      // Read symbol
      const addr = (bytecode[offset] << 8) | bytecode[offset + 1]
      const type = bytecode[offset + 2]
      offset += 3

      // Read name
      let name = ''
      while (bytecode[offset] !== 0x00 && offset < bytecode.length) {
        name += String.fromCharCode(bytecode[offset])
        offset++
      }
      offset++ // Skip null terminator

      labels.push(name)
      symbolCount++
    }

    expect(symbolCount).toBe(4) // start, loop1, loop2, end
    expect(labels).toContain('start')
    expect(labels).toContain('loop1')
    expect(labels).toContain('loop2')
    expect(labels).toContain('end')
  })
})