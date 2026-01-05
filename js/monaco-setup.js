// Monaco Editor setup and x366-asm language definition

let monacoEditor = null;
let breakpointChangeCallback = null;

export function getEditor() {
  return monacoEditor;
}

export function isEditorReady() {
  return monacoEditor !== null;
}

export function initializeMonaco() {
  return new Promise((resolve, reject) => {
    // Clear any existing execution line on init
    executionLineDecoration = []

    require(['vs/editor/editor.main'], function() {
      // Register x366-asm language
      monaco.languages.register({ id: 'x366-asm' });

      // Define tokens for x366-asm
      monaco.languages.setMonarchTokensProvider('x366-asm', {
        keywords: [
          'MOV', 'MOVB', 'ADD', 'SUB', 'MUL', 'DIV', 'INC', 'DEC',
          'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR',
          'CMP', 'TEST',
          'JMP', 'JE', 'JNE', 'JZ', 'JNZ', 'JG', 'JGE', 'JL', 'JLE', 'JA', 'JAE', 'JB', 'JBE',
          'PUSH', 'POP', 'CALL', 'RET',
          'SYSCALL', 'NOP', 'HLT',
          'DB', 'DW', 'DUP'
        ],

        registers: [
          'AX', 'BX', 'CX', 'DX', 'EX', 'FX', 'SP', 'FP',
          'AL', 'BL', 'CL', 'DL', 'EL', 'FL'
        ],

        syscalls: [
          'EXIT', 'PRINT_CHAR', 'PRINT_INT', 'PRINT_STRING',
          'READ_CHAR', 'READ_INT', 'READ_STRING',
          'CLEAR_SCREEN', 'DRAW_PIXEL', 'DRAW_RECT', 'DRAW_LINE',
          'READ_PIXEL', 'FLUSH_SCREEN',
          'SBRK', 'MALLOC', 'FREE',
          'ATOI', 'SLEEP', 'OPEN_FILE', 'READ_FILE', 'WRITE_FILE', 'CLOSE_FILE'
        ],

        tokenizer: {
          root: [
            // Comments
            [/;.*$/, 'comment'],

            // Strings
            [/"([^"\\]|\\.)*"/, 'string'],

            // Numbers
            [/0x[0-9A-Fa-f]+/, 'number.hex'],
            [/0b[01]+/, 'number.binary'],
            [/\b\d+\b/, 'number'],

            // Labels (identifier followed by colon)
            [/[a-zA-Z_]\w*:/, 'type.identifier'],

            // Syscalls
            [/\b(?:EXIT|PRINT_CHAR|PRINT_INT|PRINT_STRING|READ_CHAR|READ_INT|READ_STRING|CLEAR_SCREEN|DRAW_PIXEL|DRAW_RECT|DRAW_LINE|READ_PIXEL|FLUSH_SCREEN|SBRK|MALLOC|FREE|ATOI|SLEEP|OPEN_FILE|READ_FILE|WRITE_FILE|CLOSE_FILE)\b/i, 'keyword.syscall'],

            // Instructions
            [/\b(?:MOV|MOVB|ADD|SUB|MUL|DIV|INC|DEC|AND|OR|XOR|NOT|SHL|SHR|CMP|TEST|JMP|JE|JNE|JZ|JNZ|JG|JGE|JL|JLE|JA|JAE|JB|JBE|PUSH|POP|CALL|RET|SYSCALL|NOP|HLT|DB|DW|DUP)\b/i, 'keyword'],

            // Registers
            [/\b(?:AX|BX|CX|DX|EX|FX|SP|FP|AL|BL|CL|DL|EL|FL)\b/i, 'variable.predefined'],

            // Memory addressing [...]
            [/\[/, { token: 'delimiter.bracket', next: '@memoryAccess' }],

            // Identifiers
            [/[a-zA-Z_]\w*/, 'identifier'],

            // Delimiters
            [/[,\[\]]/, 'delimiter'],
          ],

          memoryAccess: [
            [/0x[0-9A-Fa-f]+/, 'number.hex'],
            [/\b\d+\b/, 'number'],
            [/\b(?:AX|BX|CX|DX|EX|FX|SP|FP)\b/i, 'variable.predefined'],
            [/\+/, 'operator'],
            [/\]/, { token: 'delimiter.bracket', next: '@pop' }],
          ]
        }
      });

      // Define completion provider for x366-asm
      monaco.languages.registerCompletionItemProvider('x366-asm', {
        provideCompletionItems: (model, position) => {
          const suggestions = [
            // Instructions
            ...['MOV', 'MOVB', 'ADD', 'SUB', 'MUL', 'DIV', 'INC', 'DEC',
                'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR',
                'CMP', 'TEST',
                'JMP', 'JE', 'JNE', 'JZ', 'JNZ', 'JG', 'JGE', 'JL', 'JLE', 'JA', 'JAE', 'JB', 'JBE',
                'PUSH', 'POP', 'CALL', 'RET',
                'SYSCALL', 'NOP', 'HLT'].map(kw => ({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
            })),

            // Registers
            ...['AX', 'BX', 'CX', 'DX', 'EX', 'FX', 'SP', 'FP',
                'AL', 'BL', 'CL', 'DL', 'EL', 'FL'].map(reg => ({
              label: reg,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: reg,
            })),

            // Syscalls
            ...['EXIT', 'PRINT_CHAR', 'PRINT_INT', 'PRINT_STRING',
                'READ_CHAR', 'READ_INT', 'READ_STRING',
                'CLEAR_SCREEN', 'DRAW_PIXEL', 'DRAW_RECT', 'DRAW_LINE',
                'READ_PIXEL', 'FLUSH_SCREEN',
                'SBRK', 'MALLOC', 'FREE',
                'ATOI', 'SLEEP', 'OPEN_FILE', 'READ_FILE', 'WRITE_FILE', 'CLOSE_FILE'].map(sys => ({
              label: sys,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: sys,
            })),
          ];

          return { suggestions };
        }
      });

      // Define dark theme for x366-asm
      monaco.editor.defineTheme('x366-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955' },
          { token: 'keyword', foreground: 'C586C0' },
          { token: 'keyword.syscall', foreground: 'DCDCAA' },
          { token: 'string', foreground: 'CE9178' },
          { token: 'number', foreground: 'B5CEA8' },
          { token: 'number.hex', foreground: 'B5CEA8' },
          { token: 'number.binary', foreground: 'B5CEA8' },
          { token: 'variable.predefined', foreground: '4FC1FF' },
          { token: 'type.identifier', foreground: '4EC9B0' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editor.lineHighlightBackground': '#2a2a2a',
          'editorLineNumber.foreground': '#858585',
          'editorLineNumber.activeForeground': '#c6c6c6',
          'editorCursor.foreground': '#aeafad',
        }
      });

      // Create the editor instance
      monacoEditor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: 'x366-asm',
        theme: 'x366-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        glyphMargin: true,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        lineDecorationsWidth: 0,
      });

      // Add breakpoint click handler
      monacoEditor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          toggleBreakpoint(e.target.position.lineNumber);
        }
      });

      // Add keyboard shortcuts
      monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        document.getElementById('btn-save')?.click();
      });

      monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        document.getElementById('btn-load-program')?.click();
      });

      monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
        document.getElementById('btn-run-program')?.click();
      });

      monacoEditor.addCommand(monaco.KeyCode.F7, () => {
        // F7: Step backward
        const event = new CustomEvent('f7-pressed');
        document.dispatchEvent(event);
      });

      monacoEditor.addCommand(monaco.KeyCode.F8, () => {
        // F8: Load program if not loaded, otherwise step
        const loadBtn = document.getElementById('btn-load-program');
        const stepBtn = document.getElementById('btn-step');

        // Check if program is loaded by looking at current file
        if (loadBtn && stepBtn) {
          // Dispatch custom event to check if program is loaded
          const event = new CustomEvent('f8-pressed');
          document.dispatchEvent(event);
        }
      });

      // Register definition provider for label navigation
      monaco.languages.registerDefinitionProvider('x366-asm', {
        provideDefinition: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          const labelName = word.word;
          const lineCount = model.getLineCount();

          // Search for label definition (identifier followed by colon)
          for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
            const lineContent = model.getLineContent(lineNumber);
            const labelMatch = lineContent.match(/^\s*([a-zA-Z_]\w*):/)
            if (labelMatch && labelMatch[1] === labelName) {
              return {
                uri: model.uri,
                range: new monaco.Range(lineNumber, 1, lineNumber, 1)
              };
            }
          }

          return null;
        }
      });

      console.log('Monaco Editor initialized successfully');
      resolve(monacoEditor);
    });
  });
}

// Breakpoint management
const breakpoints = new Set();
let breakpointDecorations = [];

export function setBreakpointChangeCallback(callback) {
  breakpointChangeCallback = callback;
}

export function toggleBreakpoint(lineNumber) {
  if (breakpoints.has(lineNumber)) {
    breakpoints.delete(lineNumber);
  } else {
    breakpoints.add(lineNumber);
  }
  updateBreakpointDecorations();
  if (breakpointChangeCallback) breakpointChangeCallback();
  return breakpoints.has(lineNumber);
}

export function clearAllBreakpoints() {
  breakpoints.clear();
  updateBreakpointDecorations();
  if (breakpointChangeCallback) breakpointChangeCallback();
}

export function getBreakpoints() {
  return Array.from(breakpoints);
}

export function setBreakpoints(lines) {
  breakpoints.clear();
  lines.forEach(line => breakpoints.add(line));
  updateBreakpointDecorations();
  if (breakpointChangeCallback) breakpointChangeCallback();
}

function updateBreakpointDecorations() {
  if (!monacoEditor) return;

  const newDecorations = Array.from(breakpoints).map(line => ({
    range: new monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      glyphMarginClassName: 'breakpoint-glyph',
      glyphMarginHoverMessage: { value: 'Breakpoint' }
    }
  }));

  breakpointDecorations = monacoEditor.deltaDecorations(breakpointDecorations, newDecorations);
}

// Execution line highlighting
let executionLineDecoration = [];

export function setExecutionLine(lineNumber) {
  if (!monacoEditor) return;

  if (lineNumber === null) {
    executionLineDecoration = monacoEditor.deltaDecorations(executionLineDecoration, []);
    return;
  }

  const newDecorations = [{
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      isWholeLine: true,
      className: 'execution-line'
    }
  }];

  executionLineDecoration = monacoEditor.deltaDecorations(executionLineDecoration, newDecorations);

  // Scroll to the line
  monacoEditor.revealLineInCenter(lineNumber);
}

export function clearExecutionLine() {
  setExecutionLine(null);
}
