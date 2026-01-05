#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { assemble } from './assembler.js'

// Get command line arguments
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error('Usage: node js/assemble-cli.js <input.asm> <output.bin>')
  console.error('Example: node js/assemble-cli.js disk/examples/gol.asm bin/gol.bin')
  process.exit(1)
}

const inputPath = args[0]
const outputPath = args[1]

try {
  // Read assembly source
  const source = fs.readFileSync(inputPath, 'utf-8')

  // Assemble to binary
  const binary = assemble(source)

  // Create output directory if needed
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write binary output
  const buffer = Buffer.from(binary)
  fs.writeFileSync(outputPath, buffer)

  console.log(`✓ Assembled ${inputPath} → ${outputPath} (${binary.length} bytes)`)

} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exit(1)
}
