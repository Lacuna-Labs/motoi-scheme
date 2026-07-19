// tests/cpu.test.mjs
//
// The 8-bit Motoi CPU — 12 verbs + assembler + fetch-decode-execute
// loop. Author: Marcus (2026-07-19).
//
// Blocks:
//   (1) boot + state-shape.
//   (2) assembler round-trip: (LOAD 5) (LOAD 3) (ADD) (HALT) → bytes.
//   (3) LOAD/STORE round-trip.
//   (4) Arithmetic — ADD + SUB with flag semantics.
//   (5) Logic — AND, OR, XOR, NOT.
//   (6) Jumps — JMP + JZ + JNZ.
//   (7) Subroutine — CALL + RET.
//   (8) Stack — PUSH + POP.
//   (9) Small program: sum 5 + 3 → A=8, HALT set.
//  (10) Step mode returns mnemonic, halted CPU returns #f.
//  (11) Display renders A/B/PC/SP/FLAGS + 16×16 mem grid.
//  (12) Disassembler round-trip.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse, Sym } from '../src/reader.js'
import {
  makeState, stepState, assemble, disassemble, displayState, OPCODES,
  FLAG_Z, FLAG_N, FLAG_C, FLAG_H,
} from '../lib/system/cpu.js'

function evalSrc(src, envOpt) {
  const fuel = { n: 1_000_000 }
  const env = envOpt || makeCoreEnv({ fuel })
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return { out, env }
}

function alistGet(alist, key) {
  if (!Array.isArray(alist)) return undefined
  for (const pair of alist) {
    if (Array.isArray(pair) && pair.length === 2 && pair[0] instanceof Sym) {
      if (pair[0].name === key) return pair[1]
    }
  }
  return undefined
}

// ── (1) boot + state shape ────────────────────────────────────────────

test('cpu/boot! — returns state alist with A B PC SP FLAGS', () => {
  const { out } = evalSrc('(cpu/boot!)')
  assert.equal(alistGet(out, ':A'), 0)
  assert.equal(alistGet(out, ':B'), 0)
  assert.equal(alistGet(out, ':PC'), 0)
  assert.equal(alistGet(out, ':SP'), 0xFF)
  assert.equal(alistGet(out, ':FLAGS'), 0)
  assert.equal(alistGet(out, ':halted?'), false)
})

// ── (2) assembler round-trip ──────────────────────────────────────────

test('assemble — (LOAD 5) (LOAD 3) (ADD) (HALT) → correct bytes', () => {
  const bytes = assemble([
    [new Sym('LOAD'), 5],
    [new Sym('LOAD'), 3],
    [new Sym('ADD')],
    [new Sym('HALT')],
  ])
  // Opcodes: LOAD=0x02, ADD=0x06, HALT=0xFF
  assert.deepEqual(bytes, [0x02, 5, 0x02, 3, 0x06, 0xFF])
})

// ── (3) LOAD / STORE / LOADM ──────────────────────────────────────────

test('LOAD imm + STORE addr + LOADM addr — round-trip', () => {
  const s = makeState()
  // (LOAD 42) (STORE 0x80) (LOAD 0) (LOADM 0x80) (HALT)
  const bytes = assemble([
    [new Sym('LOAD'),  42],
    [new Sym('STORE'), 0x80],
    [new Sym('LOAD'),  0],
    [new Sym('LOADM'), 0x80],
    [new Sym('HALT')],
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]

  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 42, 'A round-tripped through mem[0x80]')
  assert.equal(s.mem[0x80], 42, 'mem[0x80] persisted')
})

// ── (4) ADD / SUB with flags ──────────────────────────────────────────

test('ADD — 5 + 3 = 8; no flags set', () => {
  const s = makeState()
  const bytes = assemble([
    [new Sym('LOAD'), 5],
    [new Sym('MOV'),  new Sym('B')],
    [new Sym('LOAD'), 3],
    // now B=5, A=3 — ADD gives A + B = 8
    [new Sym('ADD')],
    [new Sym('HALT')],
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 8, '3 + 5 = 8')
  assert.equal(s.FLAGS & FLAG_Z, 0, 'Z clear on non-zero result')
  assert.equal(s.FLAGS & FLAG_C, 0, 'no carry on 8')
})

test('ADD — 0xFF + 1 = 0 with carry + zero flags', () => {
  const s = makeState()
  const bytes = assemble([
    [new Sym('LOAD'), 0xFF],
    [new Sym('MOV'),  new Sym('B')],
    [new Sym('LOAD'), 1],
    [new Sym('ADD')],
    [new Sym('HALT')],
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 0, '0xFF + 1 wraps to 0')
  assert.notEqual(s.FLAGS & FLAG_Z, 0, 'Z set on zero result')
  assert.notEqual(s.FLAGS & FLAG_C, 0, 'C set on overflow')
})

test('SUB — 5 - 3 = 2; borrow clear', () => {
  const s = makeState()
  const bytes = assemble([
    [new Sym('LOAD'), 3],
    [new Sym('MOV'),  new Sym('B')],
    [new Sym('LOAD'), 5],
    [new Sym('SUB')],
    [new Sym('HALT')],
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 2, '5 - 3 = 2')
  assert.equal(s.FLAGS & FLAG_C, 0, 'no borrow')
})

// ── (5) logic — AND / OR / XOR / NOT ──────────────────────────────────

test('AND OR XOR NOT — bitwise semantics', () => {
  // A=0b1100 (12), B=0b1010 (10)
  const runOp = (opName) => {
    const s = makeState()
    const bytes = assemble([
      [new Sym('LOAD'), 0b1010],
      [new Sym('MOV'),  new Sym('B')],
      [new Sym('LOAD'), 0b1100],
      [new Sym(opName)],
      [new Sym('HALT')],
    ])
    for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
    while (!(s.FLAGS & FLAG_H)) stepState(s)
    return s.A
  }
  assert.equal(runOp('AND'), 0b1000, 'AND: 12 & 10 = 8')
  assert.equal(runOp('OR'),  0b1110, 'OR : 12 | 10 = 14')
  assert.equal(runOp('XOR'), 0b0110, 'XOR: 12 ^ 10 = 6')

  const s = makeState()
  const bytes = assemble([
    [new Sym('LOAD'), 0x0F],
    [new Sym('NOT')],
    [new Sym('HALT')],
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 0xF0, 'NOT: ~0x0F & 0xFF = 0xF0')
})

// ── (6) JMP / JZ / JNZ ────────────────────────────────────────────────

test('JMP — unconditional jump skips over a HALT', () => {
  const s = makeState()
  // JMP 0x05, HALT (should be skipped), LOAD 99, HALT
  // Positions: 0x00 JMP 0x05, 0x02 HALT, 0x03 LOAD 99, 0x05 HALT
  //   Wait — 0x03 LOAD 99 takes 2 bytes; next instr is 0x05.
  s.mem[0x00] = 0x0C  // JMP
  s.mem[0x01] = 0x05
  s.mem[0x02] = 0xFF  // HALT (should be skipped)
  s.mem[0x03] = 0x02  // LOAD (should be skipped)
  s.mem[0x04] = 99
  s.mem[0x05] = 0xFF  // HALT
  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 0, 'A never touched; LOAD 99 was jumped OVER')
  assert.equal(s.PC, 0x05, 'PC at HALT target')
})

test('JZ / JNZ — flag-conditional', () => {
  // Program: LOAD 0, JZ 0x08, LOAD 99 (skipped), HALT, LOAD 42, HALT
  // Layout: 0x00 LOAD 0 (2), 0x02 JZ 0x08 (2), 0x04 LOAD 99 (2), 0x06 HALT (1),
  //         0x07 (pad), 0x08 LOAD 42 (2), 0x0A HALT (1)
  // BUT: A=0 doesn't set Z (only arithmetic ops do). We need SUB A,A first.
  // Simpler: LOAD 5, MOV B, LOAD 5, SUB → A=0, Z=1; JZ target.
  const s = makeState()
  const bytes = assemble([
    [new Sym('LOAD'), 5],
    [new Sym('MOV'),  new Sym('B')],
    [new Sym('LOAD'), 5],
    [new Sym('SUB')],          // A=0, Z set
    [new Sym('JZ'), 0x0C],     // jump forward
    [new Sym('LOAD'), 99],     // skipped
    [new Sym('HALT')],         // skipped
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
  s.mem[0x0C] = 0x02  // LOAD
  s.mem[0x0D] = 42
  s.mem[0x0E] = 0xFF  // HALT

  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 42, 'JZ jumped over the LOAD 99 branch, landed at LOAD 42')
})

// ── (7) CALL + RET ────────────────────────────────────────────────────

test('CALL + RET — subroutine returns to caller', () => {
  const s = makeState()
  // Main: LOAD 10, CALL 0x10, HALT (at 0x05).
  // Sub at 0x10: LOAD 20, RET.
  // After: A=20 (sub overwrote), HALT hit.
  s.mem[0x00] = 0x02  // LOAD
  s.mem[0x01] = 10
  s.mem[0x02] = 0x0F  // CALL
  s.mem[0x03] = 0x10  // sub address
  s.mem[0x04] = 0xFF  // HALT (return here)

  s.mem[0x10] = 0x02  // LOAD
  s.mem[0x11] = 20
  s.mem[0x12] = 0x10  // RET

  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 20, 'sub ran and set A=20')
  assert.equal(s.PC, 0x04, 'returned to the HALT at 0x04')
})

// ── (8) PUSH + POP ────────────────────────────────────────────────────

test('PUSH + POP — SP decrements/increments; A round-trips', () => {
  const s = makeState()
  const bytes = assemble([
    [new Sym('LOAD'), 77],
    [new Sym('PUSH')],
    [new Sym('LOAD'), 0],
    [new Sym('POP')],
    [new Sym('HALT')],
  ])
  for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
  while (!(s.FLAGS & FLAG_H)) stepState(s)
  assert.equal(s.A, 77, '77 round-tripped through the stack')
  assert.equal(s.SP, 0xFF, 'SP back where it started')
})

// ── (9) canonical "5 + 3" — the brief's smoke test ────────────────────

test('canonical program: 5 + 3 → A = 8 via the top-level verbs', () => {
  const { env, out: bootOut } = evalSrc('(cpu/boot!)')
  assert.equal(alistGet(bootOut, ':A'), 0, 'boot clean')

  // Assemble via the verb.
  evalSrc(`
    (cpu/load-program! '((LOAD 5) (MOV B) (LOAD 3) (ADD) (HALT)))
  `, env)
  evalSrc('(cpu/run!)', env)
  const state = evalSrc('(cpu/state)', env).out
  assert.equal(alistGet(state, ':A'), 8, 'A holds 5 + 3')
  assert.equal(alistGet(state, ':halted?'), true, 'CPU halted')
})

// ── (10) step / halted semantics ──────────────────────────────────────

test('cpu/step! returns mnemonic; #f once halted', () => {
  const { env } = evalSrc('(cpu/boot!)')
  evalSrc("(cpu/load-program! '((LOAD 1) (HALT)))", env)
  const step1 = evalSrc('(cpu/step!)', env).out
  assert.ok(step1 instanceof Sym, 'step returns a symbol mnemonic')
  assert.equal(step1.name, 'LOAD')
  const step2 = evalSrc('(cpu/step!)', env).out
  assert.equal(step2.name, 'HALT')
  const step3 = evalSrc('(cpu/step!)', env).out
  assert.equal(step3, false, 'halted CPU returns #f')
})

// ── (11) display ──────────────────────────────────────────────────────

test('cpu/display returns a fixed-width panel with A B PC SP FLAGS + mem grid', () => {
  const { env } = evalSrc('(cpu/boot!)')
  const disp = evalSrc('(cpu/display)', env).out
  assert.equal(typeof disp, 'string')
  assert.match(disp, /A=00/)
  assert.match(disp, /B=00/)
  assert.match(disp, /PC=00/)
  assert.match(disp, /SP=FF/)
  assert.match(disp, /FLAGS=/)
  // 16 memory rows.
  const rowCount = (disp.match(/^│ [0-9A-F]{2} /gm) || []).length
  assert.equal(rowCount, 16, 'display shows 16 memory rows')
})

// ── (12) disassembler round-trip ──────────────────────────────────────

test('disassemble — 2-byte instrs decode with pc, mnemonic, operand', () => {
  const bytes = assemble([
    [new Sym('LOAD'), 42],
    [new Sym('ADD')],
    [new Sym('HALT')],
  ])
  const decoded = disassemble(bytes)
  assert.equal(decoded.length, 3)
  assert.equal(decoded[0].mnemonic, 'LOAD')
  assert.equal(decoded[0].operand, 42)
  assert.equal(decoded[1].mnemonic, 'ADD')
  assert.equal(decoded[1].operand, undefined)
  assert.equal(decoded[2].mnemonic, 'HALT')
})

test('cpu/opcodes lists at least 16 opcodes with :mnemonic + :size', () => {
  const { out } = evalSrc('(cpu/opcodes)')
  assert.ok(Array.isArray(out))
  assert.ok(out.length >= 16, `expected ≥ 16 opcodes, got ${out.length}`)
  const first = out[0]
  assert.ok(alistGet(first, ':mnemonic') instanceof Sym)
  assert.equal(typeof alistGet(first, ':size'), 'number')
})
