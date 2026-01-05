// Comprehensive tests for byte instructions
import { describe, it, expect, beforeEach } from 'vitest'
import { Memory, CPU } from '../emulator.js'
import { assemble } from '../assembler.js'

describe('Byte Instructions', () => {
  let mem, cpu

  beforeEach(() => {
    mem = new Memory(1024)
    cpu = new CPU(mem)
  })

  describe('Assembly Integration', () => {
    it('should assemble and execute MOV AL, [addr]', () => {
      const asm = `
        .MEMORY 1K

        data: DB 0x42

        main:
          MOV AL, [data]
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // Execute MOV AL, [data]

      expect(cpu.registers.get('AL')).toBe(0x42)
      expect(cpu.registers.get('AX')).toBe(0x42)  // Zero-extended
    })

    it('should assemble and execute MOV [addr], BL', () => {
      const asm = `
        .MEMORY 1K

        data: DB 0

        main:
          MOV BX, 0xABCD
          MOV [data], BL
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV BX, 0xABCD
      cpu.step()  // MOV [data], BL

      // Check at the known data location (after code)
      // data should be at 0x002A (after the 3 instructions: 0x20-0x23, 0x24-0x27, 0x28-0x29)
      expect(mem.readByte(0x002A)).toBe(0xCD)
    })

    it('should assemble and execute MOV CL, [BX+offset]', () => {
      const asm = `
        .MEMORY 1K

        buffer: DB 10 DUP(0)

        main:
          MOV BX, buffer
          MOV AX, 0x1122
          MOV [BX+3], AL    ; Store byte at buffer[3]
          MOV CL, [BX+3]    ; Load it back
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV BX, buffer
      cpu.step()  // MOV AX, 0x1122
      cpu.step()  // MOV [BX+3], AL
      cpu.step()  // MOV CL, [BX+3]

      expect(cpu.registers.get('CL')).toBe(0x22)
    })

    it('should handle byte loads/stores in loops', () => {
      const asm = `
        .MEMORY 1K

        src: DB 1, 2, 3, 4, 5
        dst: DB 5 DUP(0)

        main:
          MOV BX, src
          MOV CX, dst
          MOV DX, 5      ; counter

        loop:
          MOV AL, [BX]   ; Load byte from source
          MOV [CX], AL   ; Store to destination
          INC BX
          INC CX
          DEC DX
          JNE loop
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      // Run the entire loop
      let steps = 0
      while (!cpu.halted && steps < 100) {
        cpu.step()
        steps++
      }

      // Check that bytes were copied at dst location
      // Based on debug output: dst starts at 0x0045
      const dstAddr = 0x0045
      expect(mem.readByte(dstAddr)).toBe(1)
      expect(mem.readByte(dstAddr + 1)).toBe(2)
      expect(mem.readByte(dstAddr + 2)).toBe(3)
      expect(mem.readByte(dstAddr + 3)).toBe(4)
      expect(mem.readByte(dstAddr + 4)).toBe(5)
    })

    it('should zero-extend byte values', () => {
      const asm = `
        .MEMORY 1K

        data: DB 0x80

        main:
          MOV AX, 0xFFFF
          MOV AL, [data]
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV AX, 0xFFFF
      expect(cpu.registers.get('AX')).toBe(0xFFFF)

      cpu.step()  // MOV AL, [data]
      // Should be zero-extended (0x0080), not sign-extended (0xFF80)
      expect(cpu.registers.get('AX')).toBe(0x0080)
    })

    it('should work with all byte registers', () => {
      const asm = `
        .MEMORY 1K

        data1: DB 0x11
        data2: DB 0x22
        data3: DB 0x33
        data4: DB 0x44

        main:
          MOV AL, [data1]
          MOV BL, [data2]
          MOV CL, [data3]
          MOV DL, [data4]
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV AL, [data1]
      cpu.step()  // MOV BL, [data2]
      cpu.step()  // MOV CL, [data3]
      cpu.step()  // MOV DL, [data4]

      expect(cpu.registers.get('AL')).toBe(0x11)
      expect(cpu.registers.get('BL')).toBe(0x22)
      expect(cpu.registers.get('CL')).toBe(0x33)
      expect(cpu.registers.get('DL')).toBe(0x44)
    })

    it('should handle byte register to register moves', () => {
      const asm = `
        .MEMORY 1K

        main:
          MOV AX, 0x1234
          MOV BL, AL
          MOV CL, BL
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV AX, 0x1234
      cpu.step()  // MOV BL, AL
      expect(cpu.registers.get('BL')).toBe(0x34)

      cpu.step()  // MOV CL, BL
      expect(cpu.registers.get('CL')).toBe(0x34)
    })

    it('should handle negative offsets with byte operations', () => {
      const asm = `
        .MEMORY 1K

        main:
          MOV AX, 0x55
          MOV BX, 0x110
          MOV [BX-8], AL
          MOV CL, [BX-8]
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV AX, 0x55
      cpu.step()  // MOV BX, 0x110
      cpu.step()  // MOV [BX-8], AL
      cpu.step()  // MOV CL, [BX-8]

      expect(cpu.registers.get('CL')).toBe(0x55)
    })

    it('should handle byte immediate moves', () => {
      const asm = `
        .MEMORY 1K

        main:
          MOV AL, 0x42
          MOV BL, 0xFF
          HLT
      `

      const binary = assemble(asm)
      mem.loadBinary(binary)
      cpu.reset()

      cpu.step()  // MOV AL, 0x42
      expect(cpu.registers.get('AL')).toBe(0x42)

      cpu.step()  // MOV BL, 0xFF
      expect(cpu.registers.get('BL')).toBe(0xFF)
    })
  })
})
