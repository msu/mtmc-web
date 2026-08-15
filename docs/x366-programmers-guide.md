# X366 Programmer's Guide

This is a practical guide to assembly programming for the MTMC-16.

## Introduction

This guide teaches x366 assembly through working examples that run in the MTMC-16 emulator. We'll build from simple 
programs to more complex ones, introducing concepts progressively.

For complete instruction reference, see [x366-arch.md](x366-arch.md).

## Understanding The Machine

Programming in assembly differs to a large extent from high level programming in that you need to understand
the machine you are programming for, in particular

- What its components are
- What instructions it understands

The MTMC is a simplified computer with the following components:

- A set of _registers_, memory locations located in the CPU where work is done
- A large block of _memory_ that holds instructions & data
- A _console_ that can be used to write output to and read input from
- A _display_ that can be used to draw on

We are going to mainly focus on the first three components of the system and ignore the display.

One thing to know about the MTMC is that it is _16 bit_, which means that all registers, memory locations, etc. hold
16 bits.  This is in contrast with most computers today that are 64 bit.  By sticking with a 16 bit architecture it
is easier to understand what's going on in the MTMC.

The registers in the MTMC are split between general purpose and special registers.  There are six general purpose
registers: `AX`, `BX`, `CX`, `DX`, `SI` & `DI`.  These registers are what you will use for writing programs and you
can think of them as something like variables.  Imagine if you had to program with only six variables total?  Not 
easy!  But we will learn techniques for managing them.

There are also some special registers, `SP`, `BP`, etc that are used for managing something called a stack, or th
heap, etc.  We will talk about them later, they aren't super important right now.

The instructions that the MTMC understands are the x366 instruction set.  This is a simplified version
of the ubiquitous x86 instruction set, designed to be simpler to work with but close enough that you can
map concepts to x86 assembly later.

Let's get into it.

## Your First Program

Let's start with the simplest possible program:

```asm
HALT
```

This single instruction stops the CPU. 

Not very useful, but it demonstrates that programs are just sequences of instructions.

## Printing Output

Now let's print something out.  We will start with a character, using the `SYSCALL` instruction, which is our
mechanism for telling the Operating System to do something.

Let's start by printing a single character, `h`

```asm
MOV AX, 104
SYSCALL PRINT_CHAR
HALT
```

The first line moves (MOV) a value of 104 into the AX register, one of six general purpose registers in the MTMC.

The second line invokes the `PRINT_CHAR` system call.  That tells the operating system "Look in AX and print the
character you find there to the console"

Finally, we exit the program.

This program will print the letter 'h' (ASCII code 104) to the console. 

Now, using a number here is a bit difficult to understand, so let's use a character literal in our assembly instead:

```asm
MOV AX, 'h'
SYSCALL PRINT_CHAR
HALT
```

This produces the exact same instructions, but is easier to read.

### Hello World

OK, let's write "Hello World" in assembly now:

```asm
message: DB "Hello, World!\n\0"

MOV AX, message
SYSCALL PRINT_STRING
HALT
```

We've got a few new things going on it.

First, what is that `message:` thing?  That's a _label_, that is a _name_ for a _memory location_.

Labels are very important in assembly programming and are used to, well, label data (like in this case) or to 
label locations of instructions we want to jump to, etc.  They give us a handy way to give a "symbolic" name to 
a location, so we don't have to hard code numbers.

Now, what's that `DB` thing?  `DB` means "Define Byte", which is a little obscure, but basically says "Here are some
bytes I want you to store in memory somewhere."  You can see what follows the `DB` is a string like you might see
in a more familiar programming language.  You may know that a string (at least a simple string) is a collection of 
bytes, so each character is a byte, and the string is written to memory.  Note that it includes a newline '\n' and a
null terminator '\0' character!

OK, now, we want to write "Hello, World!" to the console and, like with a single character, we will want to make
a system call to do so.  But how can we pass a string that is made up of 15 characters, or 15 bytes, to it?

Previously we put a single character in `AX` and asked the operating system to print it, but we can't fit 15 bytes
into a two byte/16 bit register!

We are going to use a different syscall: `PRINT_STRING`.  This syscall doesn't expect a _string_ in `AX` (most strings
wouldn't fit!) it instead expects a _pointer_ to a string!  Conceptually this is a `char*`, if you are coming from C!

So, how do we get a _pointer_ to that string in memory?

That label we put in earlier!

The _value_ of that label is the _address_ of the first character, `H`, in memory!

So we can simply move (MOV) the label into `AX` and boom, we've got the address (the `char*` if you like) in there.

Now, of course we don't _really_ move the label.  The label is just a convenient way to refer to where the string
ends up in memory.

So we move the string's address into `AX`, invoke `PRINT_STRING` and exit.

Hello, World!

## Working with Numbers

A lot of introductory assembly is going to be working with numbers, which, after all, is one of the core functions
of computers.  Let's take a look at how to work with numbers in the MTMC

### Printing Integers

First off, printing numbers is pretty simple:

```asm
MOV AX, 42
SYSCALL PRINT_INT
HALT
```

You can also read numbers from the console for user input:

```asm
prompt: DB "Enter a number:\0"
you_entered: DB "You entered \0"

MOV AX, prompt
SYSCALL PRINT_STRING
SYSCALL READ_INT
MOV BX, AX
MOV AX, you_entered
SYSCALL PRINT_STRING
MOV AX, BX
SYSCALL PRINT_INT

HALT
```

In this program we prompt the user for a number, then read it using the `READ_INT` sys call.  This sys call will
leave the value the user entered in `AX`.  Why do we move/copy it from `AX` into `BX`?

Well, because we want to print out another string, the "You entered " string, and we need to move that into `AX` so
we can invoke the `PRINT_STRING` sys call.  But if we didn't move the value from the `READ_INT` sys call somewhere else
we'd lose it!

Programming with only six variables is hard!

So we move the integer the user entered into `BX`, print out the string, then move the value back into `AX` and print
it out.

Annoying, but that's assembly for you.

### Basic Arithmetic

Next let's look at adding two numbers together:

```asm
MOV AX, 10
MOV BX, 32
ADD AX, BX
SYSCALL PRINT_INT
HALT
```

This prints 42.

Note that `ADD` takes two arguments: `ADD AX, BX`.  The way to read this is as `AX = AX + BX`

This takes some getting used to and is an artifact of the MTMC using x86 conventions.  Other architectures don't have
this somewhat strange convention.

Anyway, `SUB` works exactly the same way:

```asm
MOV AX, 50
MOV BX, 8
SUB AX, BX          ; AX = AX - BX, so AX is 42
```

You also have `INC` and `DEC` as shorthand for adding or subtracting one.  

You will see these used frequently once we get to loops:

```asm
INC AX              ; AX = AX + 1
DEC CX              ; CX = CX - 1
```

Multiplication and division are even stranger than `ADD` and `SUB`: they take only a _single_ operand!

This is because they _always_ use `AX` as the first argument and destination whether you like it or not:

```asm
MOV AX, 6
MOV BX, 7
MUL BX              ; AX = AX * BX, so AX is 42
```

If you want to multiply two numbers, one of them has to be sitting in `AX` first.  

Again, this is inherited from x86, which has the same restrictions for the same historical reasons.

`DIV` is does something even crazier:

```asm
MOV AX, 47
MOV BX, 10
DIV BX              ; AX = 4 (the quotient), DX = 7 (the remainder)
```

Integer division throws away the fraction, so 47 / 10 is 4, not 4.7.  But the remainder isn't lost, it
lands in `DX` automatically.

That means you better not have anything you need to keep around in `DX` if you do a division.

### Example: Computing an Average

Let's average two numbers using the instructions we know now:

```asm
MOV AX, 15
MOV BX, 25
ADD AX, BX          ; AX = 40
MOV BX, 2
DIV BX              ; AX = 20
SYSCALL PRINT_INT
HALT
```

This will print out `20`.

Notice that `BX` does double duty here.  It holds one of the numbers we are adding, and then, once we
are done with it, we reuse it to hold the divisor.  

With only six registers you end up doing this sort of thing.

What happens when the numbers don't divide evenly?

```asm
MOV AX, 15
MOV BX, 26
ADD AX, BX          ; AX = 41
MOV BX, 2
DIV BX              ; AX = 20, DX = 1
SYSCALL PRINT_INT
HALT
```

This still prints 20, but the real average is 20.5.

The half is sitting over in `DX` as a remainder of 1 and it's up to us to decide if we care.  

## Accessing Memory

So far we've worked mostly directly with registers, but as programs get more serious we are going to have to work
with memory as well.  Let's look at how to access memory in assembly.

### Reserving Memory

In our earlier programs we used `DB` to declare bytes, using a label to refer to the location they ended up in 
memory at.  There is also `DW` which means "Define Word".  A word in the MTMC is 16 bits (this is true in x86 as well)

So we can use `DW` to declare a 16-bit number and then refer to it like we did with a string:

```asm
count: DW 7
```

One way to think of this is as a global variable: you now have an additional place you can keep data that isn't in
one of the six registers!

Now, unlike with the string examples, here we _are_ going to be interested in loading the *value* at the location
labeled `count`.  With the strings we only wanted the address.

How do we load the value, given the address?

```asm
count: DW 7
MOV AX, [count]
SYSCALL PRINT_INT
HALT
```

Here's the code to do that.  There is one small and subtle difference from the string example: the square brackets around
the `count` label in the `MOV` instruction.

Those square brackets mean "load from the memory location pointed to by count".

From C, this is something like if we had an `int* count` and we said `*count` to dereference it.  

(I hate that C used `*` for both declaring and dereferencing, by the way.  So confusing.)

Whenever you see `[]` in x366 assembly, think "accessing memory".

If you think of memory as a giant array of bytes (which is what it is) the syntax starts to make more sense.

### Storing Values

Brackets can be on the left-hand side too, allowing you to write data to memory

```asm
count: DW 0

MOV AX, 42
MOV [count], AX     ; write AX into memory
MOV AX, 0           ; clobber AX
MOV AX, [count]     ; read it back
SYSCALL PRINT_INT
HALT
```

### Loading & Storing Bytes

Sometimes you want to load or store a byte, rather than a whole word.  This is common when, for example, you are
working with string data.

In this case you can use a special form for the register names by replacing the `X` with `L`.  So, for example,
if you want to read a single 8-bit byte from memory into `AX`, you would use `AL`.

The `L` stands for "lower", that is, the lower 8 bits of the 16-bit `AX` register.

Here's an example that prints the first byte in a string stored in memory:

```asm
letters: DB "abc\0"

MOV AL, [letters]   ; AL = 'a', zero-extended into AX
SYSCALL PRINT_CHAR
HALT
```

If you used `AX` rather than `AL` you'd move 16 bits into `AX`, so both `a` AND `b`, which would not be what you want!

### Accessing Arrays

OK, we've looked at strings, which you maybe recognize as just arrays of bytes (that is, a sequence of ASCII values
laid out in memory terminated by a null value).

Let's look at an array of numbers.  We can declare one by using `DW`, just like `DB` works for strings:

```asm
nums: DW 10, 20, 30
```
So that's an array in memory, kind of like `{10, 20, 30}` in C.

Now, here comes a cool part.  `nums` is just a symbolic value for an address.  An address (or, if you like pointer) is
just a number corresponding to where those word values ended up in memory.  The cool thing is we can do math on that 
number:

```asm
nums: DW 10, 20, 30
MOV BX, nums        ; move the array base address into BX
MOV AX, [BX]        ; first word, 10
SYSCALL PRINT_INT
MOV AX, '\n'
SYSCALL PRINT_CHAR
MOV AX, [BX+2]      ; second word, 20
SYSCALL PRINT_INT
HALT
```

So what's new here?  Note that we moved the base address of the array into `BX`.  We then use the _register_ (rather
than a label) to refer to the memory location.

We print out the first value in the array using `[BX]`, which works because the value of the label `nums` is sitting 
in the register.  Pretty cool.

Now, a few lines down you can see we can do math on that value.  We load the second integer into `AX` by referring to
`[BX+2]`.  Why `+ 2`?  Well, memory addresses are always in terms of _bytes_: we say that memory is _byte addressed_.
These integers are _word_ sized, that is, 16 bits or, yep, two bytes.  So we increment by 2 to get the second value.

Now, there's nothing preventing us from only adding 1 and reading the value into `AX`.  We'll get a garbage value: the
lower byte of the first value and the upper value of the second value, but there's nothing preventing you from doing that.

Welcome to assembly, please be careful.

OK, now, something even more useful: let's use _two_ register for accessing the last value array:

```asm
nums: DW 10, 20, 30

MOV BX, nums        ; base
MOV CX, 4           ; index: element 2, times 2 bytes
MOV AX, [BX+CX]     ; 30
SYSCALL PRINT_INT
HALT
```

OK, it's hard to see why the `[BX+CX]` notation is so useful here, but what this lets us do is maintain a base address
(`BX`) and then an offset (`CX`) as we access the array.  This is like `nums[i]` in C, where `BX` is holding `nums` and
`CX` is holding `i`.  Of course, we need to scale `i` by the size of the data in the array, which is probably confusing
to you right now, but it'll make more sense after a while.

## Conditionals

OK, now let's take a look at conditional logic.  In C or Python or whatever you are used to using `if` statements or
maybe a `switch` for this sort of thing.

Well, x366 assembly doesn't have any of that.  

It's got one thing: jumps.

### Jumping

The simplest jump instruction is `JMP`, an _unconditional_ jump.

It takes a label, yes, the same sort of label we used for data, except now the label is
naming an _instruction_ instead of a _value_.  

In both cases, the label resolves to a memory location, so it's all the same as far as the computer is concerned.

Here's a simple program that just skips over a `MOV` instruction.

```asm
MOV AX, 'a'
JMP skip
MOV AX, 'b'         ; never runs
skip:
SYSCALL PRINT_CHAR
HALT
```

This prints `a`, because the `MOV AX, 'b'` instruction is skipped over by the `JMP` instruction.

### Conditional Jumps

OK, that's all fine but life wouldn't be very interesting if we just unconditionally jumped every time.  To
really make things fun we need to jump _conditionally_.

The mechanism for doing this in x366 is a two-instruction process that begins with the `CMP` (Compare) instruction.

The `CMP` instruction compares (really, subtracts) two values and the sets bits in a special register called `FLAGS`:
if the result of the subtraction was zero, negative, etc.

You can then use conditional jump instructions like `JLE` (jump if less than or equal) to make a jump only if the
condition holds.

Note that this two-step process is another thing x366 takes from x86, other architectures can do this in a single 
instruction, but we are trying to prepare you for an x86 world.

### Building an If

OK, let's write a program that reads an integer, and _if_ the integer is greater than 10, print out "big".

Here's the code

```asm
big: DB "big\n\0"

SYSCALL READ_INT
CMP AX, 10
JLE done            ; 10 or less, so skip the body
MOV AX, big
SYSCALL PRINT_STRING
done:
HALT
```

So we read an integer into `AX`, then `CMP` it with 10.  This will set the `FLAGS` register values depending on 
what number the user entered.  If the user entered a number less than or equal to 10, we jump to the `done` label
and just halt.

If not, we move the address of the string "big" into `AX` and print the string out, then `HALT`.

Notice that after the computer executes `SYSCALL PRINT_STRING` it just keeps on going and executes `HALT`.  It just keeps
marching ahead executing instructions until it hits a jump or the machine halts.

### If and Else

Now let's add an else branch to the program that prints "small" if the number is less than or equal to 10:

```asm
big:   DB "big\n\0"
small: DB "small\n\0"

SYSCALL READ_INT
CMP AX, 10
JLE is_small
MOV AX, big
SYSCALL PRINT_STRING
JMP done            ; skip the else
is_small:
MOV AX, small
SYSCALL PRINT_STRING
done:
HALT
```

Very similar to our original program except now we have a second "branch" that prints "small".  Look at the labels
and the pattern it uses:

- If the user entered data is less than or equal to 10, jump to `is_small`
- Otherwise, print `big` _then_ unconditionally jump to `end` and `HALT`
- In the `is_small` branch, print "small" and then fall through to the `HALT`

You can see how the two branches of an if/else from C are here, but you are responsible for managing the whole thing
yourself via jumps.

C isn't looking so bad now, is it?!

### The Conditional Jumps

Here are all the conditional jumps in x366:

| Jump         | Taken when       |
|--------------|------------------|
| `JE` / `JZ`  | equal            |
| `JNE`/ `JNZ` | not equal        |
| `JL`         | less             |
| `JLE`        | less or equal    |
| `JG`         | greater          |
| `JGE`        | greater or equal |

## Loops

OK, cool, so we know how to conditionally and unconditionally jump and implement if/else with that.  What about the other
major control flow feature you are used to: loops (for, while, etc)?

A loop is the same stuff repeating over and over again, right?  So in machine terms, the same instructions executing
over and over again.  

So, if you think about it, a loop at the machine level is just a jump *backwards* to some instructions we've already
executed.

Let's look at how to implement that idea.

### Counting Up

Here is a simple loop that prints 1 to 10:

```asm
MOV CX, 1

count_loop:
    MOV AX, CX
    SYSCALL PRINT_INT
    MOV AX, '\n'
    SYSCALL PRINT_CHAR

    INC CX
    CMP CX, 10
    JLE count_loop

HALT
```

We start with 1 in `CX` then enter the loop body.  The loop body moves `CX` into `AX` to print it, then prints out
a new line character.  We then increment `CX` and compare it with 10.  If `CX` is less than or equal to 10 we jump
back to the start of the loop and do it all again.

Pretty simple, right?  That's it, that's a loop!

### Looping Over an Array

OK, now let's look at looping over an array, taking advantage of the `[BX + CX]` form we saw earlier, but now
with a loop to print out every value in the array:

```asm
nums: DW 10, 20, 30, 40, 50

MOV BX, nums        ; base address
MOV CX, 0           ; offset in bytes

print_loop:
    MOV AX, [BX+CX]
    SYSCALL PRINT_INT
    MOV AX, '\n'
    SYSCALL PRINT_CHAR

    ADD CX, 2       ; next word, so 2 bytes
    CMP CX, 10      ; 5 elements times 2 bytes
    JL print_loop

HALT
```

This prints 10, 20, 30, 40, 50, one per line.  

You can see in the loop we are using `BX` as the "base" (that is, starting point) of the array and then `CX` to "index"
into it at a certain point to load the number into `AX`.

Note that we are hard-coding the length of the array in the `CMP` as 5 elements * 2 bytes per element = 10.  This is like
how you have to know the length of arrays in C when you are iterating over them.  Lower level, obviously, but same idea.

### Looping Until a Sentinel

Another looping pattern is common with strings: looping until a _sentinel value_.  A sentinel value is a value that
signals (sentinel) that you are at the end.  In the case of strings, this value is `null` or just `0`.

Let's rework the "Hello, World!" program to print the string one character at a time using `PRINT_CHAR` instead of the
(admittedly more convenient) `PRINT_STRING`:

```asm
message: DB "Hello, World!\n\0"

MOV BX, message

print_loop:
    MOV AL, [BX]        ; grab one byte
    CMP AL, 0           ; null terminator?
    JE print_done
    SYSCALL PRINT_CHAR
    INC BX              ; next character
    JMP print_loop

print_done:
HALT
```

This prints `Hello, World!`, same as the original, but now we are doing the work `PRINT_STRING` was doing
for us by iterating until we run into a null character.

A few things to note about this loop:

- The check is at the start of the loop rather than the end (common with sentinel-based iterator)
- We only increment `BX` by one, since each character is one byte
- We don't bother maintaining a separate base and offset register (this is more like using a pointer and incrementing it in C)

### Fibonacci

Here is an iterative loop that prints the first 10 Fibonacci numbers, storing the current number in the `DI` register 
and the previous number in the `SI` register:

```asm
MOV SI, 0           ; previous
MOV DI, 1           ; current
MOV CX, 0           ; counter

fib_loop:
    MOV AX, SI
    SYSCALL PRINT_INT
    MOV AX, '\n'
    SYSCALL PRINT_CHAR

    MOV AX, SI
    ADD AX, DI
    MOV SI, DI
    MOV DI, AX

    INC CX
    CMP CX, 10
    JL fib_loop

HALT
```

Prints 0, 1, 1, 2, 3, 5, 8, 13, 21, 34.

Note that we need to use `AX` in the loop so we have enough space to avoid stomping on values we need.

## Command Line Arguments

A nice feature of x366 assembly is that you can pass arguments into it very easily, like you can with C's `main(int argc, char** argv)` function
or Java's `public static void main(String[] args)`.

The mechanism in x366 is very simple: anything passed to a program is captured as a single string and then a pointer
to that string is left in `AX`.

That means you can implement `echo.asm` with only two instructions:

```asm
SYSCALL PRINT_STRING
HALT
```

We never set `AX` at all here: the operating system puts whatever came after the program name into a string and left
a pointer to it in `AX`.  We then invoke `PRINT_STRING` and the OS prints out whatever it put into that register.

Easy peasy.

Again, this is a very simplified version of  `main(int argc, char** argv)`, with only one char* instead of a variable
number.

If no argument is passed then `AX` will be set to null/`0`

### Text To Numbers

A common pattern in programming in x366 assembly is taking input as a string and converting the string into numbers.

The argument to the program is a string, so how do we convert to numbers?

As luck would have it, there is a system call for this: `ATOI` or "ASCII to integer", the same name C uses.  The
`ATOI` in our system, however, is set up to make things really easy on people who need to parse a string of space
separated numbers into an array.

Here's how it works:

`ATOI` expects a pointer to a string in `AX`.  It returns two things:

* `AX` holds the number it parsed
* `BX` holds a pointer to the rest of the string, just past the digits it consumed

It also skips leading whitespace on the way in, which makes it really easy to parse multiple numbers.

### Adding Several Numbers

Let's write a small program, `add.asm` that takes numbers and adds them up, printing the sum:

```asm
MOV CX, 0           ; our sum
CMP AX, 0       
JE done             ; no arg, jump to end

parse_loop:
    SYSCALL ATOI        ; AX = number, BX = the rest
    ADD CX, AX
    MOV AL, [BX]        ; Move the next character in the string into AL
    CMP AL, 0           ; See if it's the null terminator
    JE done             ; Exit if so
    MOV AX, BX          ; Point AX at the rest of the string and go again
    JMP parse_loop

done:
MOV AX, CX
SYSCALL PRINT_INT
HALT
```

Run this program with `"30 10 20"` and it prints `60`.

You will see this pattern quite a bit in assignments.

## The Stack

OK, a few more things you should know.

Remember those special registers I mentioned at the very beginning, `SP` and `BP`?  Let's look at `SP`.

The _stack_ is a chunk of memory at the far end of memory that grows _downward_, back toward your code.  `SP`, the
stack pointer, holds the address of the top of it.

Two instructions use it: `PUSH` puts the value of a register on top of the stack, and `POP` takes it back off.

```asm
MOV AX, 42
PUSH AX             ; stash it away
MOV AX, 99          ; clobber AX
POP AX              ; get it back
SYSCALL PRINT_INT
HALT
```

This prints 42.

So now you have somewhere to put things when you run out of registers, and you didn't have to reserve a spot for it
ahead of time with `DW`.

The catch is right there in the name.  It's a _stack_: last thing in, first thing out.

```asm
MOV AX, 1
MOV BX, 2
PUSH AX
PUSH BX
POP AX              ; AX = 2, the last thing we pushed
POP BX              ; BX = 1
SYSCALL PRINT_INT
HALT
```

That prints 2, not 1.  If you push two things, you have to pop them in the _opposite_ order for them to end up in the
same places:

```asm
MOV AX, 1
MOV BX, 2
PUSH AX
PUSH BX
POP BX              ; BX = 2
POP AX              ; AX = 1
SYSCALL PRINT_INT
HALT
```

One way to think of the stack is as one global data structure that is available to you in assembly.

## Functions

Related to the stack is the idea of functions.  This is a big topic, but let's cover it at a high level.

To support function calls, x366 has two instructions:

* `CALL` jumps to a label and "remembers" where it came from
* `RET` goes back to the instruction just after the `CALL` that called the function it is in

So `CALL` is kind of like an unconditional jump.  OK, cool, but where does it keep the address to return to?

On the stack!  

`CALL` pushes the address of the next instruction, and `RET` pops it back off and jumps there.

```asm
MOV AX, 21
CALL double
SYSCALL PRINT_INT
HALT

double:
    ADD AX, AX
    RET
```

This prints 42: 

- `21` is loaded into `AX`
- `CALL` jumps down to `ADD AX, AX` and pushes the address of `SYSCALL PRINT_INT` onto the stack
- `ADD AX, AX` doubles the value
- `RET` jumps back to `SYSCALL PRINT_INT`, popping its address off the stack

The "argument" to the double function was passed in `AX`.  This is the standard on x366: arguments are passed
in `AX`, `BX`, etc.

Also note that the value was returned in `AX`.  This is also the standard: return values are left in `AX`

One last thing to know about function calls: the function you call can clobber your registers.

```asm
MOV AX, 21
MOV BX, 7
CALL double
SYSCALL PRINT_INT
MOV AX, '\n'
SYSCALL PRINT_CHAR
MOV AX, BX
SYSCALL PRINT_INT
HALT

double:
    MOV BX, 2
    MUL BX
    RET
```

This prints 42, and then 2.  We wanted 7!  `double` grabbed `BX` for scratch space and never gave it back.

To deal with this, we should push all registers we want to survive a function call onto the stack:

```asm
double:
    PUSH BX         ; we are about to clobber BX
    MOV BX, 2
    MUL BX
    POP BX          ; put it back
    RET
```

Now it prints 42 and then 7, and the caller never notices that `BX` was borrowed.

This is the calling convention on x366 and we'll talk more about it later.

## Conclusion

OK, that's your guide to programming in x366 for the MTMC.  You can look at [x366-arch.md](x366-arch.md) for the full 
instruction set.  Don't forget to install the plugin so you can step through programs.
