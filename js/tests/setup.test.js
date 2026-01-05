import { describe, it, expect } from 'vitest'

describe('Test Environment', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should support ES modules', () => {
    const obj = { name: 'x366' }
    expect(obj.name).toBe('x366')
  })
})