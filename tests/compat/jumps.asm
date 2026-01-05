; Cross-Platform Test 09: Conditional Jumps
; Tests all conditional jump instructions
; Expected output: PASS for all tests

; Test 1: JE (Jump if Equal)
MOV AX, 5
MOV BX, 5
CMP AX, BX
JE test1_pass
MOV AX, fail1
SYSCALL PRINT_STRING
SYSCALL EXIT
test1_pass:

; Test 2: JNE (Jump if Not Equal)
MOV AX, 5
MOV BX, 7
CMP AX, BX
JNE test2_pass
MOV AX, fail2
SYSCALL PRINT_STRING
SYSCALL EXIT
test2_pass:

; Test 3: JL (Jump if Less)
MOV AX, 3
MOV BX, 8
CMP AX, BX
JL test3_pass
MOV AX, fail3
SYSCALL PRINT_STRING
SYSCALL EXIT
test3_pass:

; Test 4: JG (Jump if Greater)
MOV AX, 10
MOV BX, 5
CMP AX, BX
JG test4_pass
MOV AX, fail4
SYSCALL PRINT_STRING
SYSCALL EXIT
test4_pass:

; Test 5: JLE (Jump if Less or Equal)
MOV AX, 5
MOV BX, 5
CMP AX, BX
JLE test5_pass
MOV AX, fail5
SYSCALL PRINT_STRING
SYSCALL EXIT
test5_pass:

; Test 6: JGE (Jump if Greater or Equal)
MOV AX, 8
MOV BX, 8
CMP AX, BX
JGE test6_pass
MOV AX, fail6
SYSCALL PRINT_STRING
SYSCALL EXIT
test6_pass:

; All tests passed
MOV AX, success
SYSCALL PRINT_STRING
SYSCALL EXIT

success: DB "ALL TESTS PASSED", 10, 0
fail1: DB "FAIL: JE", 10, 0
fail2: DB "FAIL: JNE", 10, 0
fail3: DB "FAIL: JL", 10, 0
fail4: DB "FAIL: JG", 10, 0
fail5: DB "FAIL: JLE", 10, 0
fail6: DB "FAIL: JGE", 10, 0
