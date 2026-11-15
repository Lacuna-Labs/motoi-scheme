// THE OWNER'S PRESS from a browser (2026-10-18, control/owner.py): a yes or a no on a petition is signed with this
// device's own secret, paired once with the six words `lacuna pair` prints at the owner's terminal. The secret lives in this
// browser's localStorage (one per device, revocable: `lacuna pair --revoke <device>`); it never signs anything else.
// SHA-256 and HMAC are written out here: the desk is often opened over plain http on the LAN, where crypto.subtle is absent.
const STORE = 'lacuna.owner.device'
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb,
  0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
  0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2])

export function sha256(bytes) {
  const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6
  const m = new Uint8Array(total); m.set(bytes); m[n] = 0x80
  const dv = new DataView(m.buffer)
  dv.setUint32(total - 4, (n * 8) >>> 0); dv.setUint32(total - 8, Math.floor(n / 0x20000000))
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const r = (x, k) => (x >>> k) | (x << (32 - k))
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh
  }
  const out = new Uint8Array(32)
  h.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v))
  return out
}

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (s) => new Uint8Array((s.match(/../g) || []).map((x) => parseInt(x, 16)))

export function hmacHex(keyHex, text) {
  let key = unhex(keyHex)
  if (key.length > 64) key = sha256(key)
  const k = new Uint8Array(64); k.set(key)
  const msg = new TextEncoder().encode(text)
  const inner = new Uint8Array(64 + msg.length), outer = new Uint8Array(96)
  for (let i = 0; i < 64; i++) { inner[i] = k[i] ^ 0x36; outer[i] = k[i] ^ 0x5c }
  inner.set(msg, 64); outer.set(sha256(inner), 64)
  return hex(sha256(outer))
}

export function device() {
  try { return JSON.parse(localStorage.getItem(STORE) || 'null') } catch { return null }
}

export function forget() { try { localStorage.removeItem(STORE) } catch { /* private window */ } }

/** The six words → this device's own secret (kept in localStorage). Throws with the server's words when refused. */
export async function pair(phrase, name) {
  const guess = /iPhone|Android/.test(navigator.userAgent) ? 'phone' : /iPad/.test(navigator.userAgent) ? 'ipad' : 'desk'
  const r = await fetch('/api/owner/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase, device: name || guess }) })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(j.why || 'pairing was refused')
  try { localStorage.setItem(STORE, JSON.stringify({ name: j.device, secret: j.secret })) } catch { throw new Error('this browser cannot keep the pairing (storage is off)') }
  return j.device
}

/** Headers proving the owner's press on one petition, or null when this device is not paired yet. */
export function pressHeaders(pid, approve) {
  const d = device()
  if (!d || !d.secret) return null
  const t = Math.floor(Date.now() / 1000)
  return { 'X-Lacuna-Owner': hmacHex(d.secret, `${pid}:${approve ? 'yes' : 'no'}:${t}`), 'X-Lacuna-Owner-T': String(t), 'X-Lacuna-Device': d.name }
}

/** The console's and the phone's press: pairs on the first one (a prompt for the six words), then signs. */
export async function decide(pid, approve) {
  let h = pressHeaders(pid, approve)
  if (!h) {
    const words = window.prompt('This device is not paired for the owner\'s press yet.\nAt the owner\'s terminal run `lacuna pair` and type its six words here:')
    if (!words) return { ok: false, why: 'not paired — nothing was decided' }
    try { await pair(words) } catch (e) { return { ok: false, why: e.message } }
    h = pressHeaders(pid, approve)
  }
  const r = await fetch(`/api/petitions/${pid}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lacuna-Who': 'alfred', ...h },
    body: JSON.stringify({ approve }) })
  const j = await r.json().catch(() => ({}))
  if (r.status === 403 && j.pair) forget()                 // revoked or re-keyed: the next press pairs again
  return j
}
