## C--

C-- is a minimal subset of C that targets the [x366 assembly language](x366-arch.md).  It supports
just enough of C to write simple programs with functions, arrays, and basic I/O.

### Types

C-- supports two core types:

* `int` — 16-bit signed integer (one word)
* `char` — 8-bit unsigned character (one byte)

Pointers to both types are supported:

* `int*` — pointer to an int (holds a 16-bit address)
* `char*` — pointer to a char (holds a 16-bit address)

Arrays of both types are supported:

* `int[]` — array of 16-bit integers
* `char[]` — array of 8-bit characters (i.e. a string)

There are no structs, unions, enums, floats, or unsigned types.

### Grammar

```
program = { global_declaration | function_definition }

// declarations
global_declaration = type, identifier, [ '[', number, ']' ], [ '=', initializer ], ';'
local_declaration  = type, identifier, [ '[', number, ']' ], [ '=', expression ], ';'

initializer = expression | string_literal | '{', expression, { ',', expression }, '}'

type = ( 'int' | 'char' ), [ '*' ]

// functions
function_definition = type, identifier, '(', [ param_list ], ')', block
param_list = type, identifier, { ',', type, identifier }

block = '{', { local_declaration | statement }, '}'

// statements
statement = expression_statement
          | if_statement
          | while_statement
          | return_statement
          | block

expression_statement = expression, ';'

if_statement = 'if', '(', expression, ')', statement, [ 'else', statement ]

while_statement = 'while', '(', expression, ')', statement

return_statement = 'return', [ expression ], ';'

// expressions (lowest to highest precedence)
expression = assignment | logical_or

assignment = [ '*' ], identifier, [ '[', expression, ']' ], '=', expression

logical_or  = logical_and, { '||', logical_and }
logical_and = equality,    { '&&', equality }
equality    = comparison,  { ( '==' | '!=' ), comparison }
comparison  = additive,    { ( '<' | '>' | '<=' | '>=' ), additive }
additive    = multiplicative, { ( '+' | '-' ), multiplicative }
multiplicative = unary,    { ( '*' | '/' | '%' ), unary }

unary = [ '-' | '!' | '*' | '&' ], primary

primary = number
        | char_literal
        | string_literal
        | identifier, [ '[', expression, ']' ]
        | identifier, '(', [ arg_list ], ')'
        | '(', expression, ')'

arg_list = expression, { ',', expression }

// lexical elements
identifier     = /[a-zA-Z_][a-zA-Z0-9_]*/
number         = /[0-9]+/
char_literal   = /'(\\.|[^'])'/
string_literal = /"(\\.|[^"])*"/
comment        = /\/\/.*/
```

### Code Generation Conventions

#### Globals

Global variables are placed at labels in the data section:

```c
int counter;          // counter: DW 0
int values[10];       // values: DW 10 DUP(0)
char msg[] = "hello"; // msg: DB "hello", 0
char letter;          // letter: DB 0
int* ptr;             // ptr: DW 0
```

Note that global `char` variables use `DB` (1 byte), not `DW`.  Global `int` and
pointer variables use `DW` (2 bytes).

#### Locals

Local variables live on the stack at negative offsets from BP.  All locals
use 2 bytes (one word) on the stack, including `char` — this simplifies
stack alignment:

```c
int foo(int a) {   // a arrives in AX
    int x;         // x is at [BP-2]
    int y;         // y is at [BP-4]
    x = a + 1;
    y = x * 2;
    return y;
}
```

Generates:

```asm
foo:
    PUSH BP
    MOV BP, SP
    SUB SP, 4          ; allocate x and y

    ADD AX, 1
    MOV [BP-2], AX     ; x = a + 1

    MOV AX, [BP-2]
    MOV BX, 2
    MUL BX
    MOV [BP-4], AX     ; y = x * 2

    MOV AX, [BP-4]     ; return y
    MOV SP, BP
    POP BP
    RET
```

#### Function Calls

C-- follows the x366 calling convention:

* Up to 6 parameters passed in AX, BX, CX, DX, SI, DI
* Return value in AX
* All registers are caller-saved
* Functions with more than 6 parameters are not supported

```c
int add(int a, int b) {  // a in AX, b in BX
    return a + b;
}

int main() {
    int result;
    result = add(3, 4);  // MOV AX, 3; MOV BX, 4; CALL add
    return 0;
}
```

#### Arrays

Arrays are accessed using indexed addressing:

```c
int arr[5];
arr[2] = 42;     // MOV AX, 42; MOV BX, 2; MOV [arr+BX*2], AX
char s[] = "hi";
char c = s[0];   // MOV AX, s; MOV AL, [AX]
```

Array index scaling:
* `int[]` — index is multiplied by 2 (word size)
* `char[]` — index is used directly (byte size)

#### Pointers

Pointers hold 16-bit addresses.  The `&` operator takes the address of a variable,
and `*` dereferences a pointer:

```c
int x;
int* p;
p = &x;      // MOV AX, x      (load address of x)
*p = 42;     // MOV BX, 42; MOV [AX], BX  (store through pointer)
int y;
y = *p;      // MOV AX, [AX]   (load through pointer)
```

Pointer arithmetic works in units of the pointed-to type:

```c
int arr[5];
int* p;
p = &arr[0];  // p points to arr[0]
p = p + 1;    // advances by 2 bytes (sizeof int)

char* s;
s = s + 1;    // advances by 1 byte (sizeof char)
```

Dereferencing a `char*` uses byte loads/stores (`MOV AL, [AX]` / `MOV [AX], BL`),
while dereferencing an `int*` uses word loads/stores (`MOV AX, [BX]` / `MOV [BX], AX`).

#### Strings

String literals are stored as null-terminated byte arrays in the data section:

```c
char greeting[] = "hello";  // greeting: DB "hello", 0
```

#### Control Flow

If statements and while loops use CMP and conditional jumps:

```c
if (x > 0) {     // CMP AX, 0; JLE else_label
    y = 1;
} else {
    y = 0;
}

while (i < 10) { // loop: CMP AX, 10; JGE end
    i = i + 1;    //   ADD AX, 1; JMP loop
}                 // end:
```

### Built-in Functions

C-- provides built-in functions that map directly to x366 syscalls:

* `print_int(n)` — print an integer (`SYSCALL PRINT_INT`)
* `print_char(c)` — print a character (`SYSCALL PRINT_CHAR`)
* `print_string(s)` — print a null-terminated string (`SYSCALL PRINT_STRING`)
* `read_int()` — read an integer from input (`SYSCALL READ_INT`)
* `read_char()` — read a character from input (`SYSCALL READ_CHAR`)
* `exit()` — halt the program (`SYSCALL EXIT`)

### Entry Point

Every C-- program must have a `main` function.  The compiler generates a `CALL main`
followed by `SYSCALL EXIT` as the program entry point.

### Limitations

* No structs, unions, or enums
* No floating point
* No preprocessor (`#include`, `#define`, etc.)
* No multi-file compilation
* No type casting
* Maximum 6 function parameters
* No `for` loops (use `while`)
* No `switch` statements
* No `do...while` loops
* `char` locals use a full word on the stack, but global/heap `char` values use a single byte
* No pointer-to-pointer (`int**`, etc.)

### Sample C-- Program

```c
// Compute factorial iteratively
int factorial(int n) {
    int result;
    result = 1;
    while (n > 1) {
        result = result * n;
        n = n - 1;
    }
    return result;
}

int main() {
    int n;
    int f;
    n = read_int();
    f = factorial(n);
    print_int(f);
    print_char('\n');
    return 0;
}
```
