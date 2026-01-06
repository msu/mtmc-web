// Display - Game Boy style graphics
// 160x144 resolution, 2-bit color depth (4 colors)

export const DISPLAY_WIDTH = 160
export const DISPLAY_HEIGHT = 144

// Game Boy color palette (grayscale)
const PALETTE = [
  '#0f380f', // Darkest green (0)
  '#306230', // Dark green (1)
  '#8bac0f', // Light green (2)
  '#9bbc0f', // Lightest green (3)
]

export class Display {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId)
    this.ctx = this.canvas.getContext('2d')

    // Set canvas size
    this.canvas.width = DISPLAY_WIDTH
    this.canvas.height = DISPLAY_HEIGHT

    // VRAM - pack 4 pixels per byte (2 bits each)
    this.vram = new Uint8Array((DISPLAY_WIDTH * DISPLAY_HEIGHT) / 4)

    // Current drawing color
    this.currentColor = 3

    // Image data for fast rendering
    this.imageData = this.ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT)

    this.clear()
  }

  // Clear screen to color 0
  clear() {
    this.vram.fill(0)
    this.refresh()
  }

  // Set current drawing color (0-3)
  setColor(color) {
    this.currentColor = color & 0x03
  }

  // Draw a pixel at (x, y) with current color
  drawPixel(x, y) {
    if (x >= 0 && x < DISPLAY_WIDTH && y >= 0 && y < DISPLAY_HEIGHT) {
      const pixelIndex = y * DISPLAY_WIDTH + x
      const byteIndex = Math.floor(pixelIndex / 4)
      const bitOffset = (pixelIndex % 4) * 2

      // Clear 2 bits and set new color
      this.vram[byteIndex] = (this.vram[byteIndex] & ~(0x03 << bitOffset)) |
                              (this.currentColor << bitOffset)
    }
  }

  // Draw a line from (x1, y1) to (x2, y2)
  drawLine(x1, y1, x2, y2) {
    // Bresenham's line algorithm
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx - dy

    while (true) {
      this.drawPixel(x1, y1)

      if (x1 === x2 && y1 === y2) break

      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x1 += sx
      }
      if (e2 < dx) {
        err += dx
        y1 += sy
      }
    }
  }

  // Draw a rectangle
  drawRect(x, y, width, height, filled = false) {
    if (filled) {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          this.drawPixel(x + dx, y + dy)
        }
      }
    } else {
      // Draw outline
      this.drawLine(x, y, x + width - 1, y)                    // Top
      this.drawLine(x, y + height - 1, x + width - 1, y + height - 1) // Bottom
      this.drawLine(x, y, x, y + height - 1)                   // Left
      this.drawLine(x + width - 1, y, x + width - 1, y + height - 1)  // Right
    }
  }

  // Draw a circle
  drawCircle(cx, cy, radius, filled = false) {
    if (filled) {
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if (x * x + y * y <= radius * radius) {
            this.drawPixel(cx + x, cy + y)
          }
        }
      }
    } else {
      // Midpoint circle algorithm
      let x = radius
      let y = 0
      let err = 0

      while (x >= y) {
        this.drawPixel(cx + x, cy + y)
        this.drawPixel(cx + y, cy + x)
        this.drawPixel(cx - y, cy + x)
        this.drawPixel(cx - x, cy + y)
        this.drawPixel(cx - x, cy - y)
        this.drawPixel(cx - y, cy - x)
        this.drawPixel(cx + y, cy - x)
        this.drawPixel(cx + x, cy - y)

        if (err <= 0) {
          y += 1
          err += 2 * y + 1
        }
        if (err > 0) {
          x -= 1
          err -= 2 * x + 1
        }
      }
    }
  }

  // Refresh display - copy VRAM to canvas
  refresh() {
    const data = this.imageData.data
    const totalPixels = DISPLAY_WIDTH * DISPLAY_HEIGHT

    for (let i = 0; i < totalPixels; i++) {
      const byteIndex = Math.floor(i / 4)
      const bitOffset = (i % 4) * 2
      const color = (this.vram[byteIndex] >> bitOffset) & 0x03
      const rgb = this.hexToRgb(PALETTE[color])

      const idx = i * 4
      data[idx] = rgb.r
      data[idx + 1] = rgb.g
      data[idx + 2] = rgb.b
      data[idx + 3] = 255  // Alpha
    }

    this.ctx.putImageData(this.imageData, 0, 0)
  }

  // Helper to convert hex color to RGB
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  // Get VRAM address for memory-mapped graphics
  getVRAM() {
    return this.vram
  }

  // Load an image from URL or data URL and draw it to the display
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'  // Enable CORS for external images

      img.onload = () => {
        // Clear the display first
        this.clear()

        // Create temporary canvas to process the image
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = DISPLAY_WIDTH
        tempCanvas.height = DISPLAY_HEIGHT
        const tempCtx = tempCanvas.getContext('2d')

        // Draw image scaled to fit display
        const scale = Math.min(
          DISPLAY_WIDTH / img.width,
          DISPLAY_HEIGHT / img.height
        )
        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale
        const offsetX = (DISPLAY_WIDTH - scaledWidth) / 2
        const offsetY = (DISPLAY_HEIGHT - scaledHeight) / 2

        tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight)

        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
        const pixels = imageData.data

        // Convert to 2-bit grayscale and write to VRAM
        const totalPixels = DISPLAY_WIDTH * DISPLAY_HEIGHT
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const a = pixels[idx + 3]

          let color = 0

          // Skip transparent pixels
          if (a >= 128) {
            // Convert to grayscale
            const gray = (r + g + b) / 3

            // Map to 2-bit color (0-3)
            if (gray < 64) {
              color = 0  // Darkest
            } else if (gray < 128) {
              color = 1  // Dark
            } else if (gray < 192) {
              color = 2  // Light
            } else {
              color = 3  // Lightest
            }
          }

          // Write packed pixel
          const byteIndex = Math.floor(i / 4)
          const bitOffset = (i % 4) * 2
          this.vram[byteIndex] = (this.vram[byteIndex] & ~(0x03 << bitOffset)) |
                                  (color << bitOffset)
        }

        // Refresh display
        this.refresh()
        resolve()
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = src
    })
  }
}
