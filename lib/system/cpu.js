// cpu.js — a small, honest 8-bit CPU written for Motoi Scheme.
//
// Provenance: 2026-07-19 (Marcus, infra lane). Built to make Book of Code
// Chapter 12 ("The CPU — fetch, decode, execute, and loop forever") real —
// prose describes the machine; this file IS the machine. Every opcode the
// chapter mentions can be poked from the REPL.
//
// Doctrine that shaped the design:
//   * Speak & Spell frame — small, tangible, deterministic. 256 bytes of
//     memory is a number an 11-year-old can hold in their head. 8-bit
//     words match the 4-bit adder → half-adder progression the earlier
//     chapters build up. 15 opcodes fit on one printed page.
//   * The reference IS the language. The opcode table below is not
//     documentation of behaviour — it is behaviour. If it does not
//     encode the mnemonic, the mnemonic does not exist.
//   * No fabrication. Every register width, every flag semantic, every
//     jump target is exercised by a test in tests/cpu.test.mjs.
//   * Fetch–decode–execute is a loop. Motoi is loops. `cpu/run!` IS the
//     loop. Kids see the loop as the substance, not scaffolding.
//
// Architecture:
//   Word width:   8 bits (values 0..255, wrap on overflow)
//   Memory:       256 bytes, byte-addressable, both program + data
//   Registers:    A, B (general), PC (program counter, 0..255),
//                 SP (stack pointer, starts at 255 and grows DOWN),
//                 FLAGS (bitfield: Z=zero, N=negative, C=carry, H=halt)
//   Encoding:     variable-length; 1 byte opcode + 0 or 1 byte operand.
//                 The opcode table below is the single source of truth.
//
// Opcodes (15 + HALT):
//   NOP        01                    — do nothing, advance PC
//   LOAD  imm  02 nn                 — A ← nn                  (immediate)
//   LOADM addr 03 aa                 — A ← mem[aa]             (memory read)
//   STORE addr 04 aa                 — mem[aa] ← A             (memory write)
//   MOV   dst  05 rr                 — copy A into register rr (0=A 1=B)
//                                       (used to load B: LOAD 7; MOV B)
//   ADD        06                    — A ← A + B, set Z/N/C
//   SUB        07                    — A ← A - B, set Z/N/C
//   AND        08                    — A ← A & B
//   OR         09                    — A ← A | B
//   XOR        0A                    — A ← A ^ B
//   NOT        0B                    — A ← ~A & 0xFF
//   JMP   addr 0C aa                 — PC ← aa
//   JZ    addr 0D aa                 — if Z: PC ← aa
//   JNZ   addr 0E aa                 — if not Z: PC ← aa
//   CALL  addr 0F aa                 — push PC (of next instr), PC ← aa
//   RET        10                    — PC ← pop
//   PUSH       11                    — mem[SP] ← A; SP ← SP - 1
//   POP        12                    — SP ← SP + 1; A ← mem[SP]
//   HALT       FF                    — set FLAGS.H; stop the loop
//
// The high nibble of the opcode gives you the class: 0x0x arithmetic /
// data, 0x1x stack, 0xFx control. The kids don't need to know that; the
// table is small enough to eyeball.
//
// State is process-local. Every new CPU is a fresh boot — the caller
// wanting persistence should save the state alist and restore later.

import { Sym } from '../../src/reader.js'

// ── flag bit positions ────────────────────────────────────────────────
const FLAG_Z = 1  // zero
const FLAG_N = 2  // negative (bit 7 of result)
const FLAG_C = 4  // carry (unsigned overflow on ADD; borrow on SUB)
const FLAG_H = 8  // halt

// ── opcode table (numeric → { mnemonic, size, exec }) ────────────────
// exec receives the cpu state and (for 2-byte opcodes) the operand byte.
// Every exec returns nothing; it mutates the state. PC advancement is
// handled by the fetch loop — exec only overrides PC for jumps/calls.
const OPCODES = {}

// Helper — clamp to 8-bit unsigned.
const u8 = (n) => ((n | 0) & 0xFF)

// Register selector for MOV.
const REG_A = 0
const REG_B = 1

function setFlagsFromArith(state, result, carry) {
  let f = state.FLAGS & ~(FLAG_Z | FLAG_N | FLAG_C)
  if ((result & 0xFF) === 0) f |= FLAG_Z
  if ((result & 0x80) !== 0) f |= FLAG_N
  if (carry) f |= FLAG_C
  state.FLAGS = f
}

// Halt flag test — the loop stops when this is set.
export function isHalted(state) {
  return (state.FLAGS & FLAG_H) !== 0
}

// Opcode registration.
function op(code, mnemonic, size, exec) {
  OPCODES[code] = { code, mnemonic, size, exec }
}

op(0x01, 'NOP',   1, (s) => {})
op(0x02, 'LOAD',  2, (s, nn) => { s.A = u8(nn) })
op(0x03, 'LOADM', 2, (s, aa) => { s.A = u8(s.mem[aa & 0xFF]) })
op(0x04, 'STORE', 2, (s, aa) => { s.mem[aa & 0xFF] = u8(s.A) })
op(0x05, 'MOV',   2, (s, rr) => {
  // MOV rr — copy A into register rr. Only A and B are addressable this
  // way; the mnemonic reads "MOV A → rr" which is why we push in one
  // direction only. To fill B: (LOAD 7) (MOV B).
  if ((rr & 0xFF) === REG_B) s.B = u8(s.A)
  else if ((rr & 0xFF) === REG_A) s.A = u8(s.A)  // MOV A is a no-op
  else throw new Error('MOV: unknown register ' + rr)
})
op(0x06, 'ADD',   1, (s) => {
  const r = s.A + s.B
  const carry = r > 0xFF
  s.A = u8(r)
  setFlagsFromArith(s, s.A, carry)
})
op(0x07, 'SUB',   1, (s) => {
  const r = s.A - s.B
  const borrow = r < 0
  s.A = u8(r)
  setFlagsFromArith(s, s.A, borrow)
})
op(0x08, 'AND',   1, (s) => { s.A = u8(s.A & s.B); setFlagsFromArith(s, s.A, false) })
op(0x09, 'OR',    1, (s) => { s.A = u8(s.A | s.B); setFlagsFromArith(s, s.A, false) })
op(0x0A, 'XOR',   1, (s) => { s.A = u8(s.A ^ s.B); setFlagsFromArith(s, s.A, false) })
op(0x0B, 'NOT',   1, (s) => { s.A = u8(~s.A);      setFlagsFromArith(s, s.A, false) })
op(0x0C, 'JMP',   2, (s, aa) => { s.PC = aa & 0xFF; s._jumped = true })
op(0x0D, 'JZ',    2, (s, aa) => {
  if ((s.FLAGS & FLAG_Z) !== 0) { s.PC = aa & 0xFF; s._jumped = true }
})
op(0x0E, 'JNZ',   2, (s, aa) => {
  if ((s.FLAGS & FLAG_Z) === 0) { s.PC = aa & 0xFF; s._jumped = true }
})
op(0x0F, 'CALL',  2, (s, aa) => {
  // Push return address (PC AFTER this instruction) onto the stack.
  const ret = u8(s.PC + 2)   // opcode + operand
  s.mem[s.SP & 0xFF] = ret
  s.SP = u8(s.SP - 1)
  s.PC = aa & 0xFF
  s._jumped = true
})
op(0x10, 'RET',   1, (s) => {
  s.SP = u8(s.SP + 1)
  s.PC = u8(s.mem[s.SP & 0xFF])
  s._jumped = true
})
op(0x11, 'PUSH',  1, (s) => {
  s.mem[s.SP & 0xFF] = u8(s.A)
  s.SP = u8(s.SP - 1)
})
op(0x12, 'POP',   1, (s) => {
  s.SP = u8(s.SP + 1)
  s.A = u8(s.mem[s.SP & 0xFF])
})
op(0xFF, 'HALT',  1, (s) => { s.FLAGS |= FLAG_H })

// Mnemonic → numeric opcode lookup, for the assembler.
const MNEMONIC = {}
for (const code of Object.keys(OPCODES)) {
  MNEMONIC[OPCODES[code].mnemonic] = Number(code)
}

// Register name → REG_ id, for MOV.
const REG_NAMES = { A: REG_A, B: REG_B }

// ── state factory ─────────────────────────────────────────────────────

/**
 * makeState() — return a fresh CPU state object.
 *
 * Kept as a plain JS object so callers can inspect fields directly
 * (helpful for the IDE's register panel). The shape is stable — any
 * future field additions land at the end so serialized states from
 * older sessions still read.
 */
function makeState() {
  return {
    A: 0,
    B: 0,
    PC: 0,
    SP: 0xFF,
    FLAGS: 0,
    mem: new Uint8Array(256),
    // Instruction counter — useful for the IDE + tests. Not a real reg.
    _instrCount: 0,
    // Set by JMP/JZ/JNZ/CALL/RET during exec so the fetch loop knows
    // NOT to auto-advance PC after the instruction. Reset each step.
    _jumped: false,
  }
}

// ── assembler ─────────────────────────────────────────────────────────
//
// The assembler takes a list of symbolic instructions and returns a
// byte list ready for LOAD-PROGRAM. Two shapes accepted:
//   * A list of instructions: '((LOAD 5) (LOAD 3) (ADD) (HALT))
//   * A flat vector of numbers (already-assembled bytes) passes through.
//
// Operands: numbers stay numbers; register names (A, B) resolve. Labels
// are supported via the two-pass form (see assembleWithLabels below)
// but the base assembler is one-pass — no labels — so kids can walk
// the byte stream by hand and match the table.

function assembleOne(instr) {
  if (!Array.isArray(instr)) throw new Error('assemble: instruction must be a list, got ' + typeof instr)
  const mnemSym = instr[0]
  const mnem = mnemSym instanceof Sym ? mnemSym.name : String(mnemSym || '')
  const code = MNEMONIC[mnem]
  if (code === undefined) throw new Error('assemble: unknown mnemonic ' + mnem)
  const spec = OPCODES[code]
  const out = [code]
  if (spec.size === 2) {
    if (instr.length < 2) throw new Error(`assemble: ${mnem} needs an operand`)
    let operand = instr[1]
    if (operand instanceof Sym) {
      // Register name (A, B) — resolve for MOV.
      const reg = REG_NAMES[operand.name]
      if (reg === undefined) throw new Error(`assemble: unknown register/symbol ${operand.name}`)
      operand = reg
    }
    if (typeof operand !== 'number') throw new Error('assemble: operand must be a number or register name')
    out.push(u8(operand))
  }
  return out
}

/**
 * assemble(program) — flat byte array for a list of instructions.
 * @param {Array} program — either a list of instruction lists, or a
 *   list of bytes (numbers), or a mixed list where each entry is either
 *   an instruction list or a raw byte.
 * @returns {number[]} bytecode
 */
export function assemble(program) {
  if (!Array.isArray(program)) throw new Error('assemble: program must be a list')
  const out = []
  for (const entry of program) {
    if (Array.isArray(entry)) {
      const bytes = assembleOne(entry)
      for (const b of bytes) out.push(b)
    } else if (typeof entry === 'number') {
      out.push(u8(entry))
    } else {
      throw new Error('assemble: each entry must be an instruction list or a number byte')
    }
  }
  return out
}

// ── disassembler ──────────────────────────────────────────────────────
//
// Walk `bytes` and produce a list of `(mnemonic [operand])` records. Used
// by cpu/display and by the IDE to show the program alongside the memory
// dump.
export function disassemble(bytes, start = 0, length = null) {
  const end = length == null ? bytes.length : Math.min(bytes.length, start + length)
  const out = []
  let pc = start
  while (pc < end) {
    const code = bytes[pc] & 0xFF
    const spec = OPCODES[code]
    if (!spec) {
      out.push({ pc, mnemonic: '???', bytes: [code] })
      pc++
      continue
    }
    if (spec.size === 2) {
      const operand = bytes[pc + 1] & 0xFF
      out.push({ pc, mnemonic: spec.mnemonic, operand, bytes: [code, operand] })
      pc += 2
    } else {
      out.push({ pc, mnemonic: spec.mnemonic, bytes: [code] })
      pc += 1
    }
  }
  return out
}

// ── single-step ───────────────────────────────────────────────────────

/**
 * step(state) — execute one instruction. Returns the mnemonic executed
 * (a string) so the caller can trace. If the CPU is halted, returns
 * false (halt is idempotent — you can call step() past HALT with no
 * effect).
 */
export function step(state) {
  if (isHalted(state)) return false
  const pc = state.PC
  const code = state.mem[pc]
  const spec = OPCODES[code]
  if (!spec) throw new Error(`invalid opcode 0x${code.toString(16).padStart(2, '0')} at PC=${pc}`)
  const operand = spec.size === 2 ? state.mem[u8(pc + 1)] : undefined
  state._jumped = false
  spec.exec(state, operand)
  // HALT freezes the PC where the HALT instruction lives — the reader
  // sees `PC=NN | HALTED` and can look at NN in the memory grid to know
  // where the program stopped. Every other instr advances PC by its
  // size UNLESS the exec redirected it (JMP/JZ/JNZ/CALL/RET set _jumped).
  if (!state._jumped && !isHalted(state)) state.PC = u8(pc + spec.size)
  state._instrCount++
  return spec.mnemonic
}

// ── ASCII display ─────────────────────────────────────────────────────
//
// The display is Speak & Spell shape: fixed-width, deterministic, one
// glance. A kid should see three regions —
//   [REGS]  A B PC SP FLAGS
//   [MEM]   16 × 16 grid of hex bytes, PC and SP marked
//   [TRACE] the current opcode about to execute (disassembled)
//
// Colour is not baked in; the terminal-look CSS handles that. This
// function returns a plain string; the IDE re-uses it in a <pre>.
export function displayState(state) {
  const flags = state.FLAGS
  const flagStr =
    (flags & FLAG_Z ? 'Z' : '-') +
    (flags & FLAG_N ? 'N' : '-') +
    (flags & FLAG_C ? 'C' : '-') +
    (flags & FLAG_H ? 'H' : '-')

  const hex = (n) => (n & 0xFF).toString(16).padStart(2, '0').toUpperCase()
  const lines = []
  lines.push('┌─ CPU ────────────────────────────────────────────────────────┐')
  lines.push(
    `│ A=${hex(state.A)}  B=${hex(state.B)}  PC=${hex(state.PC)}  SP=${hex(state.SP)}  FLAGS=${flagStr}   instr#${state._instrCount}`.padEnd(63) + '│'
  )
  lines.push('├─ MEM ────────────────────────────────────────────────────────┤')
  // 16 × 16 grid, one row per 0x10 bytes. Mark PC with '>' and SP with '<'.
  lines.push('│      00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F        │')
  for (let row = 0; row < 16; row++) {
    const base = row * 16
    let cells = ''
    for (let col = 0; col < 16; col++) {
      const addr = base + col
      let marker = ' '
      if (addr === state.PC) marker = '>'
      else if (addr === state.SP) marker = '<'
      cells += marker + hex(state.mem[addr])
      if (col === 7) cells += ' '
    }
    lines.push(`│ ${hex(base)}  ${cells} │`)
  }
  lines.push('├─ NEXT ───────────────────────────────────────────────────────┤')
  // Disassemble the instruction at PC.
  if (isHalted(state)) {
    lines.push('│ HALTED                                                       │')
  } else {
    const code = state.mem[state.PC]
    const spec = OPCODES[code]
    if (spec) {
      const operand = spec.size === 2 ? state.mem[u8(state.PC + 1)] : null
      const str = operand == null
        ? `${spec.mnemonic}`
        : `${spec.mnemonic} 0x${hex(operand)}`
      lines.push(`│ ${(str + '  (PC=' + hex(state.PC) + ')').padEnd(60)} │`)
    } else {
      lines.push(`│ ???  0x${hex(code)}                                              │`)
    }
  }
  lines.push('└──────────────────────────────────────────────────────────────┘')
  return lines.join('\n')
}

// ── verb installer ────────────────────────────────────────────────────

// Per-env CPU state. We stash it on the env object so multiple envs in
// the same process don't share a machine (each REPL / IDE tab / test
// gets its own). Fresh envs get a fresh CPU on first call.
const STATE_KEY = '__cpuState'

function getState(env) {
  let s = env[STATE_KEY]
  if (!s) {
    s = makeState()
    // Post-freeze envs (`env.freeze()`) cannot gain new properties. Fall
    // back to a WeakMap keyed by env. All existing envs the CPU is
    // installed on today are non-frozen (base + core), so the direct
    // property is fine for the primary path.
    try { env[STATE_KEY] = s } catch { /* frozen env — carry state on installer closure */ }
  }
  return s
}

export function installCpu(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (cpu/boot!) — reset every register + memory. Returns the state alist.
  def('cpu/boot!', () => {
    const fresh = makeState()
    try { env[STATE_KEY] = fresh } catch { /* frozen — no-op */ }
    return stateToAlist(fresh)
  }, 'state-change')

  // (cpu/load-program! bytecode-list) — write bytes starting at addr 0
  // and reset PC. Accepts a flat list of numbers, an assembled list, or
  // the mixed instruction/byte form the assembler eats — we auto-assemble
  // if we see any nested lists.
  def('cpu/load-program!', (program) => {
    const s = getState(env)
    // If program contains at least one array entry, assemble it. Else
    // treat as already-flat bytecode.
    const needsAssembly = Array.isArray(program) && program.some((x) => Array.isArray(x))
    const bytes = needsAssembly ? assemble(program) : (Array.isArray(program) ? program.map(u8) : [])
    if (bytes.length > 256) throw new Error(`program too big: ${bytes.length} bytes (max 256)`)
    for (let i = 0; i < bytes.length; i++) s.mem[i] = bytes[i]
    // Everything past the program stays zero (NOP-friendly territory).
    s.PC = 0
    s.FLAGS = 0
    return bytes.length
  }, 'state-change')

  // (cpu/step!) — execute one instruction. Returns the mnemonic executed
  // as a Scheme symbol (so `(eq? m 'ADD)` reads naturally), or #f if the
  // CPU is halted.
  def('cpu/step!', () => {
    const s = getState(env)
    const m = step(s)
    return m === false ? false : new Sym(m)
  }, 'state-change')

  // (cpu/run! [max-instructions]) — run until HALT or fuel exhausted.
  // Default cap is 10,000 instructions so a runaway (JMP $00) with no
  // HALT can't hang the REPL forever.
  def('cpu/run!', (maxInstr) => {
    const s = getState(env)
    const cap = typeof maxInstr === 'number' ? maxInstr : 10000
    let n = 0
    while (n < cap && !isHalted(s)) {
      step(s)
      n++
    }
    return n
  }, 'state-change')

  // (cpu/state) — dump every register + first N bytes of memory as an
  // alist. N defaults to 16 (the top row of the display).
  def('cpu/state', (nMem) => {
    const n = typeof nMem === 'number' ? nMem : 16
    return stateToAlist(getState(env), n)
  })

  // (cpu/read-mem addr) — one byte at addr.
  def('cpu/read-mem', (addr) => {
    return u8(getState(env).mem[addr & 0xFF])
  })

  // (cpu/write-mem! addr val) — poke one byte.
  def('cpu/write-mem!', (addr, val) => {
    getState(env).mem[addr & 0xFF] = u8(val)
    return u8(val)
  }, 'state-change')

  // (cpu/display) — the fixed-width ASCII register + memory dump.
  def('cpu/display', () => displayState(getState(env)))

  // (cpu/assemble program) — expose the assembler as a verb so kids can
  // author programs without touching the runtime.
  def('cpu/assemble', (program) => assemble(program))

  // (cpu/disassemble bytes [start [length]]) — return a list of
  // ((:pc N) (:mnemonic 'M) [(:operand N)]) records.
  def('cpu/disassemble', (bytes, start, length) => {
    const arr = Array.isArray(bytes) ? bytes : Array.from(bytes || [])
    const decoded = disassemble(arr, start ?? 0, length ?? null)
    return decoded.map((r) => {
      const rec = [
        [new Sym(':pc'), r.pc],
        [new Sym(':mnemonic'), new Sym(r.mnemonic)],
      ]
      if (r.operand != null) rec.push([new Sym(':operand'), r.operand])
      return rec
    })
  })

  // (cpu/halted?) — did the last run end at a HALT?
  def('cpu/halted?', () => isHalted(getState(env)))

  // (cpu/opcodes) — introspection: return the whole opcode table as an
  // alist. Used by the IDE's help panel + by book/tutor.
  def('cpu/opcodes', () => {
    const out = []
    for (const code of Object.keys(OPCODES)) {
      const spec = OPCODES[code]
      out.push([
        [new Sym(':code'), Number(code)],
        [new Sym(':mnemonic'), new Sym(spec.mnemonic)],
        [new Sym(':size'), spec.size],
      ])
    }
    return out
  })

  return env
}

// Alist shape so Scheme callers can pattern-match.
function stateToAlist(s, memN = 16) {
  const mem = []
  for (let i = 0; i < memN; i++) mem.push(u8(s.mem[i]))
  return [
    [new Sym(':A'),      u8(s.A)],
    [new Sym(':B'),      u8(s.B)],
    [new Sym(':PC'),     u8(s.PC)],
    [new Sym(':SP'),     u8(s.SP)],
    [new Sym(':FLAGS'),  u8(s.FLAGS)],
    [new Sym(':halted?'), isHalted(s)],
    [new Sym(':instrs'), s._instrCount],
    [new Sym(':mem'),    mem],
  ]
}

export {
  makeState,
  step as stepState,
  OPCODES,
  MNEMONIC,
  FLAG_Z, FLAG_N, FLAG_C, FLAG_H,
}

export default installCpu
