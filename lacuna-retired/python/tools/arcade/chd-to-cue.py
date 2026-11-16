#!/usr/bin/env python3
# chd-to-cue.py — Zero-dependency CHD v5 -> CUE/BIN extractor for standalone ARM64 Mednafen (design §13).
# Owns: extracting Sega Saturn `.chd` images into `<stem>.cue` + `<stem>.bin` using installed `chdman` when present,
# or the local `mednafen_saturn_libretro.dylib` CHD reader (`rchd_*`) with CD-DA byte-order normalization.
# Refuses: network calls, writing outside the `.chd` parent directory, or overwriting existing `.cue/.bin` pairs.
# Implements: LACUNA-WORK-ORDER-2026-11-11-ARCADE (ARC-1: standalone Mednafen Saturn stability).
# Invariants (§18): none. Faults (§16): none.

import ctypes
import os
import shutil
import subprocess
import sys


def fmt_msf(frames: int) -> str:
    minutes = frames // (60 * 75)
    rem = frames % (60 * 75)
    seconds = rem // 75
    frac = rem % 75
    return f"{minutes:02d}:{seconds:02d}:{frac:02d}"


def find_rchd_dylib(saturn_dir: str) -> str:
    candidates = [
        os.path.join(saturn_dir, "cores", "mednafen_saturn_libretro.dylib"),
        os.path.expanduser("~/Library/Application Support/RetroArch/cores/mednafen_saturn_libretro.dylib"),
    ]
    for path in candidates:
        if os.path.isfile(path) and not os.path.islink(path):
            return path
    return ""


class Need(ctypes.Structure):
    _fields_ = [
        ("offset", ctypes.c_uint64),
        ("length", ctypes.c_uint32),
        ("which", ctypes.c_int),
        ("pad", ctypes.c_uint64),
    ]


def extract_with_rchd(chd_path: str, cue_path: str, bin_path: str, dylib_path: str) -> bool:
    lib = ctypes.CDLL(dylib_path)
    lib.rchd_new.restype = ctypes.c_void_p
    lib.rchd_free.argtypes = [ctypes.c_void_p]
    lib.rchd_open_step.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    lib.rchd_open_step.restype = ctypes.c_int
    lib.rchd_feed_borrow.argtypes = [ctypes.c_void_p, ctypes.c_uint64, ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t]
    lib.rchd_feed_borrow.restype = ctypes.c_int
    lib.rchd_track_count.argtypes = [ctypes.c_void_p]
    lib.rchd_track_count.restype = ctypes.c_uint32
    lib.rchd_track.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    lib.rchd_track.restype = ctypes.c_void_p
    lib.rchd_read_hunk_begin.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_void_p]
    lib.rchd_read_hunk_begin.restype = ctypes.c_int
    lib.rchd_read_step.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    lib.rchd_read_step.restype = ctypes.c_int

    chd = lib.rchd_new()
    if not chd:
        return False

    tmp_bin = f"{bin_path}.part"
    tmp_cue = f"{cue_path}.part"
    try:
        with open(chd_path, "rb") as src:
            need = Need()
            while True:
                rc = lib.rchd_open_step(chd, ctypes.byref(need))
                if rc == 0:
                    break
                if rc != 1:
                    return False
                src.seek(need.offset)
                chunk = src.read(need.length)
                cbuf = ctypes.create_string_buffer(chunk, len(chunk))
                if lib.rchd_feed_borrow(chd, need.offset, need.which, cbuf, len(chunk)) < 0:
                    return False

            hdr = list((ctypes.c_uint32 * 8).from_address(chd))
            hunk_bytes = hdr[3]
            unit_bytes = hdr[4] or 2448
            total_hunks = hdr[5]
            frames_per_hunk = hunk_bytes // unit_bytes
            if frames_per_hunk <= 0 or total_hunks <= 0:
                return False

            tc = lib.rchd_track_count(chd)
            if tc <= 0:
                return False

            tracks = []
            for idx in range(tc):
                tp = lib.rchd_track(chd, idx)
                vals = list((ctypes.c_uint32 * 14).from_address(tp))
                tracks.append({
                    "num": vals[2],
                    "type": vals[3],
                    "datasize": vals[5] or 2352,
                    "frames": vals[7],
                    "pad_frames": vals[8],
                    "pregap": vals[9],
                    "pregap_in_chd": vals[10],
                    "chd_frame": vals[12],
                })

            hunk_buf = ctypes.create_string_buffer(hunk_bytes)
            cached_hunk = -1

            def read_chd_sector(chd_frame: int, is_audio: bool) -> bytes:
                nonlocal cached_hunk
                hidx = chd_frame // frames_per_hunk
                slot = chd_frame % frames_per_hunk
                if hidx != cached_hunk:
                    if lib.rchd_read_hunk_begin(chd, hidx, hunk_buf) != 0:
                        raise RuntimeError(f"hunk_begin failed at {hidx}")
                    while True:
                        step = lib.rchd_read_step(chd, ctypes.byref(need))
                        if step == 0:
                            break
                        if step != 1:
                            raise RuntimeError(f"read_step failed ({step}) at hunk {hidx}")
                        src.seek(need.offset)
                        chunk = src.read(need.length)
                        cbuf = ctypes.create_string_buffer(chunk, len(chunk))
                        if lib.rchd_feed_borrow(chd, need.offset, need.which, cbuf, len(chunk)) < 0:
                            raise RuntimeError(f"feed failed at hunk {hidx}")
                    cached_hunk = hidx
                off = slot * unit_bytes
                raw = bytearray(hunk_buf.raw[off : off + 2352])
                if is_audio:
                    # CHD `cdfl`/`cdlz` stores CD-DA 16-bit PCM big-endian; Redbook `.bin` expects little-endian PCM.
                    raw[0::2], raw[1::2] = raw[1::2], raw[0::2]
                return bytes(raw)

            cue_lines = [f'FILE "{os.path.basename(bin_path)}" BINARY']
            bin_sector = 0
            zero_sector = b"\x00" * 2352

            with open(tmp_bin, "wb") as out:
                for tr in tracks:
                    is_audio = tr["type"] == 7
                    mode_str = "AUDIO" if is_audio else ("MODE2/2352" if tr["type"] in (3, 4, 5, 6) else "MODE1/2352")
                    cue_lines.append(f'  TRACK {tr["num"]:02d} {mode_str}')
                    pregap = tr["pregap"]
                    if pregap > 0:
                        cue_lines.append(f"    INDEX 00 {fmt_msf(bin_sector)}")
                        if tr["pregap_in_chd"]:
                            for f_i in range(pregap):
                                out.write(read_chd_sector(tr["chd_frame"] + f_i, is_audio))
                        else:
                            for _ in range(pregap):
                                out.write(zero_sector)
                        bin_sector += pregap
                    cue_lines.append(f"    INDEX 01 {fmt_msf(bin_sector)}")
                    data_start = tr["chd_frame"] + (pregap if tr["pregap_in_chd"] else 0)
                    for f_i in range(tr["frames"]):
                        out.write(read_chd_sector(data_start + f_i, is_audio))
                    bin_sector += tr["frames"]

            with open(tmp_cue, "w", encoding="utf-8") as cf:
                cf.write("\n".join(cue_lines) + "\n")

            os.replace(tmp_bin, bin_path)
            os.replace(tmp_cue, cue_path)
            return True
    except Exception as exc:
        for p in (tmp_bin, tmp_cue):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except OSError:
                pass
        sys.stderr.write(f"[chd-to-cue] {exc}\n")
        return False
    finally:
        lib.rchd_free(chd)


def convert_one(chd_path: str) -> bool:
    chd_abs = os.path.abspath(os.path.expanduser(chd_path))
    if not os.path.isfile(chd_abs) or os.path.islink(chd_abs) or not chd_abs.lower().endswith(".chd"):
        return False
    saturn_dir = os.path.dirname(chd_abs)
    stem = os.path.splitext(os.path.basename(chd_abs))[0]
    cue_path = os.path.join(saturn_dir, f"{stem}.cue")
    bin_path = os.path.join(saturn_dir, f"{stem}.bin")
    if os.path.isfile(cue_path) and os.path.getsize(cue_path) > 16:
        return True

    chdman = shutil.which("chdman") or (
        "/opt/homebrew/bin/chdman" if os.path.isfile("/opt/homebrew/bin/chdman") else ""
    )
    if chdman:
        res = subprocess.run([chdman, "extractcd", "-i", chd_abs, "-o", cue_path, "-ob", bin_path], capture_output=True)
        if res.returncode == 0 and os.path.isfile(cue_path):
            return True

    dylib = find_rchd_dylib(saturn_dir)
    if not dylib:
        return False
    return extract_with_rchd(chd_abs, cue_path, bin_path, dylib)


def main() -> int:
    targets = sys.argv[1:]
    if not targets:
        sat_dir = os.path.expanduser("~/lacuna-world/arcade/roms/mame/saturn")
        if os.path.isdir(sat_dir):
            targets = [os.path.join(sat_dir, f) for f in sorted(os.listdir(sat_dir)) if f.lower().endswith(".chd")]
    ok_all = True
    for t in targets:
        if convert_one(t):
            stem = os.path.splitext(os.path.basename(t))[0]
            print(f"[arcade] ✓ prepared standalone Mednafen disc {stem}.cue + {stem}.bin")
        else:
            ok_all = False
    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
