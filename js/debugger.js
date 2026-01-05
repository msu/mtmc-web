// Assembly Debugger
// Provides syntax highlighting, breakpoints, and step debugging for .asm files

export class AsmDebugger {
  constructor(editor, cpu, memory) {
    this.editor = editor
    this.cpu = cpu
    this.memory = memory
    this.breakpoints = new Set()
    this.currentLine = null
    this.debugInfo = null
  }

  // Set debug information from compiled binary
  setDebugInfo(debugInfo) {
    this.debugInfo = debugInfo
  }

  // Toggle breakpoint at line
  toggleBreakpoint(line) {
    if (this.breakpoints.has(line)) {
      this.breakpoints.delete(line)
    } else {
      this.breakpoints.add(line)
    }
  }

  // Check if current PC is at a breakpoint
  isAtBreakpoint() {
    if (!this.debugInfo || !this.debugInfo.lineMap) return false

    const pc = this.cpu.registers.PC
    const lineInfo = this.debugInfo.lineMap.find(entry => entry.pc === pc)

    if (lineInfo && this.breakpoints.has(lineInfo.line)) {
      this.currentLine = lineInfo.line
      return true
    }
    return false
  }

  // Get current source line from PC
  getCurrentLine() {
    if (!this.debugInfo || !this.debugInfo.lineMap) return null

    const pc = this.cpu.registers.PC
    const lineInfo = this.debugInfo.lineMap.find(entry => entry.pc === pc)
    return lineInfo ? lineInfo.line : null
  }

  // Apply syntax highlighting to assembly code
  highlightSyntax(code) {
    const lines = code.split('\n')
    const highlighted = []

    const keywords = /\b(MOV|ADD|SUB|MUL|DIV|INC|DEC|AND|OR|XOR|NOT|SHL|SHR|CMP|JMP|JE|JNE|JG|JL|JGE|JLE|JZ|JNZ|CALL|RET|PUSH|POP|SYSCALL|NOP|HLT)\b/gi
    const registers = /\b(AX|BX|CX|DX|EX|FX|SP|FP|PC|IR|DR|BK|CB)\b/gi
    const numbers = /\b(0x[0-9A-Fa-f]+|\d+)\b/g
    const labels = /^([a-zA-Z_][a-zA-Z0-9_]*):$/gm
    const comments = /(;.*$)/gm
    const strings = /(["'].*?["'])/g

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]

      // Escape HTML
      line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      // Apply syntax highlighting
      line = line.replace(comments, '<span class="asm-comment">$1</span>')
      line = line.replace(strings, '<span class="asm-string">$1</span>')
      line = line.replace(labels, '<span class="asm-label">$1</span>')
      line = line.replace(keywords, '<span class="asm-keyword">$1</span>')
      line = line.replace(registers, '<span class="asm-register">$1</span>')
      line = line.replace(numbers, '<span class="asm-number">$1</span>')

      highlighted.push(line)
    }

    return highlighted.join('\n')
  }
}
