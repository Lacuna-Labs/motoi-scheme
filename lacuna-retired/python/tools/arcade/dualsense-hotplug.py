#!/usr/bin/env python3
# dualsense-hotplug.py — Live SDL3 DualSense 1P+2P Hotplug & Sleep/Wake Daemon (design §13).
# Owns: polling libSDL3 for late-joining or waking 1P/2P gamepads and writing fixed-width state frames.
# Refuses: network calls, writing outside the MAME state file path, or outliving the parent MAME PID.
# Implements: design §13 and docs/eng/LACUNA-ARCADE-1.0.md §4.6 (live Bluetooth hotplug & sleep recovery).
# Invariants (§18): none. Faults (§16): none.

import ctypes
import os
import signal
import sys
import time

SDL_PATHS = [
    "/opt/homebrew/opt/sdl3/lib/libSDL3.0.dylib",
    "/opt/homebrew/lib/libSDL3.dylib",
    "/usr/local/opt/sdl3/lib/libSDL3.0.dylib",
    "/usr/local/lib/libSDL3.dylib",
]

SDL_INIT_JOYSTICK = 0x00000200
SDL_INIT_GAMEPAD = 0x00002000

# SDL_GamepadButton enum (SDL3/SDL_gamepad.h)
BTN_SOUTH = 0       # Cross
BTN_EAST = 1        # Circle
BTN_WEST = 2        # Square
BTN_NORTH = 3       # Triangle
BTN_BACK = 4        # Create / Select
BTN_START = 6       # Options / Start
BTN_LSTICK = 7      # L3
BTN_RSTICK = 8      # R3
BTN_LSHOULDER = 9   # L1
BTN_RSHOULDER = 10  # R1
BTN_DPAD_UP = 11
BTN_DPAD_DOWN = 12
BTN_DPAD_LEFT = 13
BTN_DPAD_RIGHT = 14
BTN_MISC1 = 15      # Mute button on DualSense
BTN_TOUCHPAD = 20   # Clickable Touchpad on DualSense

# SDL_GamepadAxis enum (SDL3/SDL_gamepad.h)
AXIS_LEFTX = 0
AXIS_LEFTY = 1
AXIS_LTRIGGER = 4
AXIS_RTRIGGER = 5

STICK_DEADZONE = 10500
TRIGGER_DEADZONE = 5500


def load_sdl3():
    for p in SDL_PATHS:
        if os.path.exists(p):
            sdl = ctypes.CDLL(p)
            sdl.SDL_SetHint.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
            sdl.SDL_SetHint.restype = ctypes.c_bool
            sdl.SDL_Init.argtypes = [ctypes.c_uint32]
            sdl.SDL_Init.restype = ctypes.c_bool
            sdl.SDL_Quit.argtypes = []
            sdl.SDL_PumpEvents.argtypes = []
            sdl.SDL_UpdateGamepads.argtypes = []
            sdl.SDL_GetGamepads.argtypes = [ctypes.POINTER(ctypes.c_int)]
            sdl.SDL_GetGamepads.restype = ctypes.POINTER(ctypes.c_uint32)
            sdl.SDL_OpenGamepad.argtypes = [ctypes.c_uint32]
            sdl.SDL_OpenGamepad.restype = ctypes.c_void_p
            sdl.SDL_GamepadConnected.argtypes = [ctypes.c_void_p]
            sdl.SDL_GamepadConnected.restype = ctypes.c_bool
            sdl.SDL_CloseGamepad.argtypes = [ctypes.c_void_p]
            sdl.SDL_GetGamepadButton.argtypes = [ctypes.c_void_p, ctypes.c_int]
            sdl.SDL_GetGamepadButton.restype = ctypes.c_bool
            sdl.SDL_GetGamepadAxis.argtypes = [ctypes.c_void_p, ctypes.c_int]
            sdl.SDL_GetGamepadAxis.restype = ctypes.c_int16
            sdl.SDL_free.argtypes = [ctypes.c_void_p]
            return sdl
    return None


def pid_alive(pid):
    if pid <= 0:
        return True
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def read_pad_mask(sdl, gp):
    if not gp:
        return 0
    lx = sdl.SDL_GetGamepadAxis(gp, AXIS_LEFTX)
    ly = sdl.SDL_GetGamepadAxis(gp, AXIS_LEFTY)
    lt = sdl.SDL_GetGamepadAxis(gp, AXIS_LTRIGGER)
    rt = sdl.SDL_GetGamepadAxis(gp, AXIS_RTRIGGER)

    mask = 0
    if sdl.SDL_GetGamepadButton(gp, BTN_DPAD_UP) or ly < -STICK_DEADZONE:
        mask |= 1
    if sdl.SDL_GetGamepadButton(gp, BTN_DPAD_DOWN) or ly > STICK_DEADZONE:
        mask |= 2
    if sdl.SDL_GetGamepadButton(gp, BTN_DPAD_LEFT) or lx < -STICK_DEADZONE:
        mask |= 4
    if sdl.SDL_GetGamepadButton(gp, BTN_DPAD_RIGHT) or lx > STICK_DEADZONE:
        mask |= 8
    if sdl.SDL_GetGamepadButton(gp, BTN_SOUTH):
        mask |= 16
    if sdl.SDL_GetGamepadButton(gp, BTN_EAST):
        mask |= 32
    if sdl.SDL_GetGamepadButton(gp, BTN_WEST):
        mask |= 64
    if sdl.SDL_GetGamepadButton(gp, BTN_NORTH):
        mask |= 128
    if sdl.SDL_GetGamepadButton(gp, BTN_LSHOULDER):
        mask |= 256
    if sdl.SDL_GetGamepadButton(gp, BTN_RSHOULDER):
        mask |= 512
    if lt > TRIGGER_DEADZONE:
        mask |= 1024
    if rt > TRIGGER_DEADZONE:
        mask |= 2048
    if sdl.SDL_GetGamepadButton(gp, BTN_BACK):
        mask |= 4096
    if sdl.SDL_GetGamepadButton(gp, BTN_START):
        mask |= 8192
    if sdl.SDL_GetGamepadButton(gp, BTN_TOUCHPAD) or sdl.SDL_GetGamepadButton(gp, BTN_MISC1):
        mask |= 16384
    if sdl.SDL_GetGamepadButton(gp, BTN_LSTICK):
        mask |= 32768
    if sdl.SDL_GetGamepadButton(gp, BTN_RSTICK):
        mask |= 65536
    return mask


def format_frame(p1, p2, conn, seq, msg):
    clean = msg.replace("\n", " ").replace("\r", " ")[:40]
    line = f"{p1:06d} {p2:06d} {conn:01d} {seq:04d} {clean:<40}\n"
    return line.encode("ascii", errors="replace")


def main():
    if len(sys.argv) < 3:
        print("Usage: dualsense-hotplug.py <mame_pid|--once> <state_file>", file=sys.stderr)
        return 1

    once = sys.argv[1] == "--once"
    watch_pid = 0 if once else int(sys.argv[1])
    state_path = os.path.abspath(sys.argv[2])

    sdl = load_sdl3()
    if not sdl:
        return 0

    sdl.SDL_SetHint(b"SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", b"1")
    if not sdl.SDL_Init(SDL_INIT_JOYSTICK | SDL_INIT_GAMEPAD):
        return 0

    os.makedirs(os.path.dirname(state_path), exist_ok=True)
    fd = os.open(state_path, os.O_CREAT | os.O_RDWR | os.O_TRUNC, 0o600)

    running = True
    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    # Player slots: [slot0_p1, slot1_p2] -> dict(iid, gp, ever_seen)
    slots = [None, None]
    had_slot = [False, False]
    event_seq = 0
    event_msg = "ready"
    last_written = None
    tick = 0

    try:
        while running:
            if tick % 60 == 0 and not pid_alive(watch_pid):
                break

            sdl.SDL_PumpEvents()
            sdl.SDL_UpdateGamepads()

            if tick % 30 == 0:
                cnt = ctypes.c_int(0)
                ids_ptr = sdl.SDL_GetGamepads(ctypes.byref(cnt))
                live_ids = [ids_ptr[i] for i in range(cnt.value)] if ids_ptr and cnt.value > 0 else []
                if ids_ptr:
                    sdl.SDL_free(ids_ptr)

                live_set = set(live_ids)
                for idx in (0, 1):
                    cur = slots[idx]
                    if cur and (cur["iid"] not in live_set or not sdl.SDL_GamepadConnected(cur["gp"])):
                        sdl.SDL_CloseGamepad(cur["gp"])
                        slots[idx] = None
                        event_seq = (event_seq + 1) % 10000
                        event_msg = f"{idx + 1}P DualSense Asleep"

                bound_ids = {s["iid"] for s in slots if s is not None}
                for iid in live_ids:
                    if iid in bound_ids:
                        continue
                    free_idx = 0 if slots[0] is None else (1 if slots[1] is None else -1)
                    if free_idx < 0:
                        break
                    gp = sdl.SDL_OpenGamepad(iid)
                    if gp:
                        slots[free_idx] = {"iid": iid, "gp": gp}
                        bound_ids.add(iid)
                        if tick > 0:
                            event_seq = (event_seq + 1) % 10000
                            verb = "Reconnected" if had_slot[free_idx] else ("Connected" if free_idx == 0 else "Joined")
                            event_msg = f"{free_idx + 1}P DualSense {verb}"
                        had_slot[free_idx] = True

            p1_mask = read_pad_mask(sdl, slots[0]["gp"] if slots[0] else None)
            p2_mask = read_pad_mask(sdl, slots[1]["gp"] if slots[1] else None)
            conn_mask = (1 if slots[0] else 0) | (2 if slots[1] else 0)

            sig_tuple = (p1_mask, p2_mask, conn_mask, event_seq)
            if sig_tuple != last_written:
                os.pwrite(fd, format_frame(p1_mask, p2_mask, conn_mask, event_seq, event_msg), 0)
                last_written = sig_tuple

            if once:
                break
            tick += 1
            time.sleep(0.008)
    finally:
        for s in slots:
            if s and s["gp"]:
                sdl.SDL_CloseGamepad(s["gp"])
        try:
            os.close(fd)
        except OSError:
            pass
        if not once:
            try:
                os.unlink(state_path)
            except OSError:
                pass
        sdl.SDL_Quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
