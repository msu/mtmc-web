// Client-side File System using IndexedDB
// Hierarchical file system with directory support

const DB_NAME = 'mtmc-filesystem'
const DB_VERSION = 1
const FILES_STORE = 'files'
const META_STORE = 'metadata'

export class FileSystem {
  constructor() {
    this.db = null
    this.cwd = '/'  // current working directory
    this.cache = new Map()  // In-memory cache for synchronous access
    this.ready = this.init()
  }

  // Initialize IndexedDB
  async init() {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Create files store (indexed by path)
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE, { keyPath: 'path' })
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' })
        }
      }
    })

    // Pre-populate cache with all files
    await this.populateCache()

    // Check disk version
    await this.checkDiskVersion()
  }

  // Load all files from IndexedDB into memory cache
  async populateCache() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result
        for (const entry of entries) {
          if (entry.type === 'file') {
            this.cache.set(entry.path, entry.content)
          }
        }
        console.log(`File system cache populated with ${this.cache.size} files`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Check if disk version has been updated
  async checkDiskVersion() {
    try {
      // Fetch current manifest from server
      const response = await fetch('disk/manifest.json')
      if (!response.ok) return

      const manifest = await response.json()
      const currentVersion = manifest._version

      if (!currentVersion) return

      // Get stored version from metadata
      const storedVersion = await this.getMeta('disk_version')

      if (!storedVersion) {
        // First time - store current version
        await this.setMeta('disk_version', currentVersion)
        return
      }

      // Compare versions
      if (storedVersion !== currentVersion) {
        // Notify via callback if available
        if (this.onVersionUpdate) {
          this.onVersionUpdate(storedVersion, currentVersion)
        }
      }
    } catch (err) {
      console.error('Error checking disk version:', err)
    }
  }

  // Metadata operations
  async getMeta(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(META_STORE, 'readonly')
      const store = tx.objectStore(META_STORE)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result?.value)
      request.onerror = () => reject(request.error)
    })
  }

  async setMeta(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Path utilities
  normalizePath(path) {
    // Convert to absolute path
    if (!path.startsWith('/')) {
      path = this.joinPath(this.cwd, path)
    }

    // Split into parts and resolve . and ..
    const parts = path.split('/').filter(p => p !== '' && p !== '.')
    const resolved = []

    for (const part of parts) {
      if (part === '..') {
        resolved.pop()
      } else {
        resolved.push(part)
      }
    }

    return '/' + resolved.join('/')
  }

  joinPath(...parts) {
    return this.normalizePath(parts.join('/'))
  }

  dirname(path) {
    path = this.normalizePath(path)
    if (path === '/') return '/'
    const parts = path.split('/')
    parts.pop()
    return parts.join('/') || '/'
  }

  basename(path) {
    path = this.normalizePath(path)
    if (path === '/') return '/'
    const parts = path.split('/')
    return parts[parts.length - 1]
  }

  // Core file operations
  async readFile(path) {
    await this.ready
    path = this.normalizePath(path)

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.get(path)

      request.onsuccess = () => {
        const entry = request.result
        if (!entry) {
          reject(new Error(`File not found: ${path}`))
        } else if (entry.type !== 'file') {
          reject(new Error(`Not a file: ${path}`))
        } else {
          // Update cache
          this.cache.set(path, entry.content)
          resolve(entry.content)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Synchronous read from cache only
  readFileSync(path) {
    path = this.normalizePath(path)

    if (!this.cache.has(path)) {
      throw new Error(`File not in cache: ${path}`)
    }

    return this.cache.get(path)
  }

  async writeFile(path, content) {
    await this.ready
    path = this.normalizePath(path)

    // Ensure parent directory exists
    const dir = this.dirname(path)
    if (dir !== '/') {
      const dirExists = await this.exists(dir)
      if (!dirExists) {
        throw new Error(`Directory does not exist: ${dir}`)
      }
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readwrite')
      const store = tx.objectStore(FILES_STORE)

      const entry = {
        path,
        type: 'file',
        content,
        modified: Date.now()
      }

      const request = store.put(entry)
      request.onsuccess = () => {
        // Update cache
        this.cache.set(path, content)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteFile(path) {
    await this.ready
    path = this.normalizePath(path)

    const entry = await this.stat(path)
    if (entry.type === 'directory') {
      throw new Error(`Is a directory: ${path}`)
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readwrite')
      const store = tx.objectStore(FILES_STORE)
      const request = store.delete(path)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Directory operations
  async mkdir(path) {
    await this.ready
    path = this.normalizePath(path)

    // Check if already exists
    if (await this.exists(path)) {
      throw new Error(`Path already exists: ${path}`)
    }

    // Ensure parent exists
    const dir = this.dirname(path)
    if (dir !== '/') {
      const dirExists = await this.exists(dir)
      if (!dirExists) {
        throw new Error(`Parent directory does not exist: ${dir}`)
      }
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readwrite')
      const store = tx.objectStore(FILES_STORE)

      const entry = {
        path,
        type: 'directory',
        created: Date.now(),
        modified: Date.now()
      }

      const request = store.put(entry)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async rmdir(path) {
    await this.ready
    path = this.normalizePath(path)

    if (path === '/') {
      throw new Error('Cannot remove root directory')
    }

    const entry = await this.stat(path)
    if (entry.type !== 'directory') {
      throw new Error(`Not a directory: ${path}`)
    }

    // Check if directory is empty
    const children = await this.readdir(path)
    if (children.length > 0) {
      throw new Error(`Directory not empty: ${path}`)
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readwrite')
      const store = tx.objectStore(FILES_STORE)
      const request = store.delete(path)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async readdir(path = this.cwd) {
    await this.ready
    path = this.normalizePath(path)

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result
        const children = []

        for (const entry of entries) {
          // Check if this entry is a direct child of path
          const entryDir = this.dirname(entry.path)
          if (entryDir === path) {
            children.push({
              name: this.basename(entry.path),
              type: entry.type,
              path: entry.path
            })
          }
        }

        children.sort((a, b) => {
          // Directories first, then alphabetical
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

        resolve(children)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // File system queries
  async exists(path) {
    await this.ready
    path = this.normalizePath(path)

    if (path === '/') return true

    return new Promise((resolve) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.get(path)

      request.onsuccess = () => resolve(!!request.result)
      request.onerror = () => resolve(false)
    })
  }

  async stat(path) {
    await this.ready
    path = this.normalizePath(path)

    if (path === '/') {
      return { path: '/', type: 'directory' }
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.get(path)

      request.onsuccess = () => {
        const entry = request.result
        if (!entry) {
          reject(new Error(`Path not found: ${path}`))
        } else {
          resolve(entry)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Navigation
  async cd(path) {
    await this.ready
    path = this.normalizePath(path)

    if (path !== '/') {
      const entry = await this.stat(path)
      if (entry.type !== 'directory') {
        throw new Error(`Not a directory: ${path}`)
      }
    }

    this.cwd = path
    await this.setMetadata('cwd', path)
  }

  pwd() {
    return this.cwd
  }

  // Get full directory tree
  async getTree(path = '/') {
    await this.ready
    path = this.normalizePath(path)

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result
        const tree = {
          path: '/',
          name: '/',
          type: 'directory',
          children: []
        }

        // Build tree structure
        const buildNode = (nodePath) => {
          const node = {
            path: nodePath,
            name: this.basename(nodePath),
            type: 'directory',
            children: []
          }

          for (const entry of entries) {
            if (this.dirname(entry.path) === nodePath) {
              if (entry.type === 'directory') {
                node.children.push(buildNode(entry.path))
              } else {
                node.children.push({
                  path: entry.path,
                  name: this.basename(entry.path),
                  type: 'file'
                })
              }
            }
          }

          node.children.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1
            }
            return a.name.localeCompare(b.name)
          })

          return node
        }

        resolve(buildNode('/'))
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Metadata operations
  async getMetadata(key) {
    await this.ready

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(META_STORE, 'readonly')
      const store = tx.objectStore(META_STORE)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry = request.result
        resolve(entry ? entry.value : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async setMetadata(key, value) {
    await this.ready

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Load manifest from server
  async loadManifest(manifestUrl) {
    await this.ready

    try {
      const response = await fetch(manifestUrl)
      const manifest = await response.json()

      // Create directory structure
      const dirs = new Set()
      for (const path of Object.keys(manifest)) {
        // Skip metadata keys
        if (path.startsWith('_')) continue

        let dir = this.dirname(path)
        while (dir !== '/') {
          dirs.add(dir)
          dir = this.dirname(dir)
        }
      }

      // Create all directories
      const sortedDirs = Array.from(dirs).sort()
      for (const dir of sortedDirs) {
        const exists = await this.exists(dir)
        if (!exists) {
          await this.mkdir(dir)
        }
      }

      // Load all files
      const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'))
      for (const [path, relativeUrl] of Object.entries(manifest)) {
        // Skip metadata keys
        if (path.startsWith('_')) continue
        const fileUrl = `${baseUrl}/${relativeUrl}`
        const response = await fetch(fileUrl)

        // Determine if this is a binary file
        const isBinary = path.match(/\.(png|jpg|jpeg|gif|bin|x366|exe)$/i)

        const content = isBinary ? await response.arrayBuffer() : await response.text()
        await this.writeFile(path, content)
      }

      console.log('File system loaded from manifest')
    } catch (err) {
      console.error('Failed to load manifest:', err)
      throw err
    }
  }

  // Compatibility methods for existing code
  async getCurrentFile() {
    return await this.getMetadata('currentFile') || '/examples/hello.asm'
  }

  async setCurrentFile(path) {
    path = this.normalizePath(path)
    await this.setMetadata('currentFile', path)
  }

  async getCurrentContent() {
    const path = await this.getCurrentFile()
    return await this.readFile(path)
  }

  async saveCurrentContent(content) {
    const path = await this.getCurrentFile()
    await this.writeFile(path, content)
  }

  async listFiles() {
    await this.ready

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result
        const files = entries
          .filter(e => e.type === 'file')
          .map(e => e.path)
          .sort()
        resolve(files)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async createFile(path, content = '') {
    path = this.normalizePath(path)
    if (await this.exists(path)) {
      throw new Error(`File already exists: ${path}`)
    }
    await this.writeFile(path, content)
  }

  async renameFile(oldPath, newPath) {
    oldPath = this.normalizePath(oldPath)
    newPath = this.normalizePath(newPath)

    const content = await this.readFile(oldPath)
    await this.writeFile(newPath, content)
    await this.deleteFile(oldPath)

    const currentFile = await this.getCurrentFile()
    if (currentFile === oldPath) {
      await this.setCurrentFile(newPath)
    }
  }

  // Get all entries under a path (recursively)
  async getAllEntriesUnder(path) {
    await this.ready
    path = this.normalizePath(path)

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readonly')
      const store = tx.objectStore(FILES_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result
        const result = []

        for (const entry of entries) {
          // Check if entry is under path (starts with path/)
          if (entry.path === path || entry.path.startsWith(path + '/')) {
            result.push(entry)
          }
        }

        resolve(result)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Recursively delete directory and all contents
  async rmdirRecursive(path) {
    await this.ready
    path = this.normalizePath(path)

    if (path === '/') {
      throw new Error('Cannot remove root directory')
    }

    // Get all entries under this path
    const entries = await this.getAllEntriesUnder(path)

    // Delete all entries
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(FILES_STORE, 'readwrite')
      const store = tx.objectStore(FILES_STORE)

      let completed = 0
      const total = entries.length

      if (total === 0) {
        resolve()
        return
      }

      for (const entry of entries) {
        const request = store.delete(entry.path)
        request.onsuccess = () => {
          // Remove from cache if it's a file
          if (entry.type === 'file') {
            this.cache.delete(entry.path)
          }
          completed++
          if (completed === total) {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      }
    })
  }
}
