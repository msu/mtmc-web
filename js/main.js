// MTMC-16 x366 Emulator
// Main entry point

import { initUI } from './ui.js'

// Initialize UI when DOM is ready
async function init() {
  await initUI()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}