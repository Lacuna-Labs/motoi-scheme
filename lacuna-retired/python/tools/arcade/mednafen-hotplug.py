#!/usr/bin/env python3
# mednafen-hotplug.py — Live SDL2 DualSense Hotplug & Wake Daemon for Mednafen (design §13).
# Owns: polling libSDL2 while a Mednafen PID runs and triggering macOS CGEvent F3+Shift (`command.reinit_joysticks`)
# whenever a PS5 DualSense wakes from sleep or connects mid-session.
# Refuses: network calls, writing files, or outliving the parent Mednafen PID.
# Implements: design §13 and docs/eng/LACUNA-ARCADE-1.0.md §4.6 (Mednafen Bluetooth hotplug parity).
# Invariants (§18): none. Faults (§16): none.

import ctypes
import os
import signal
import sys
import time

SDL2_PATHS = [
    "/opt/homebrew/opt/sdl2/lib/libSDL2-2.0.0.dylib",
    "/usr/local/opt/sdl2/lib/libSDL2-2.0.0.dylib",
]
APP_SERVICES = "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices"

KVK_F3 = 0x63
KVK_SHIFT = 0x38
KCG_EVENT_FLAG_MASK_SHIFT = 0x00020000
KCG_HID_EVENT_TAP = 0


def pid_alive(pid):
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def post_shift_f3(cg):
    if not cg:
        return
    try:
        for keycode, down in ((KVK_SHIFT, True), (KVK_F3, True), (KVK_F3, False), (KVK_SHIFT, False)):
            ev = cg.CGEventCreateKeyboardEvent(None, keycode, down)
            if ev:
                if keycode == KVK_F3:
                    cg.CGEventSetFlags(ev, KCG_EVENT_FLAG_MASK_SHIFT)
                cg.CGEventPost(KCG_HID_EVENT_TAP, ev)
                cg.CFRelease(ev)
            time.sleep(0.025)
    except Exception:
        pass


def main():
    if len(sys.argv) < 2:
        return 1
    watch_pid = int(sys.argv[1])
    dylib = next((p for p in SDL2_PATHS if os.path.exists(p)), None)
    if not dylib or not pid_alive(watch_pid):
        return 0

    sdl = ctypes.CDLL(dylib)
    sdl.SDL_SetHint.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
    sdl.SDL_SetHint(b"SDL_JOYSTICK_HIDAPI_PS5", b"1")
    sdl.SDL_SetHint(b"SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", b"1")
    if sdl.SDL_Init(0x00000200) != 0:
        return 0

    cg = None
    if os.path.exists(APP_SERVICES):
        try:
            cg = ctypes.CDLL(APP_SERVICES)
            cg.CGEventCreateKeyboardEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint16, ctypes.c_bool]
            cg.CGEventCreateKeyboardEvent.restype = ctypes.c_void_p
            cg.CGEventSetFlags.argtypes = [ctypes.c_void_p, ctypes.c_uint64]
            cg.CGEventPost.argtypes = [ctypes.c_uint32, ctypes.c_void_p]
            cg.CFRelease.argtypes = [ctypes.c_void_p]
        except Exception:
            cg = None

    running = True
    def handle_stop(_s, _f):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    prev_count = sdl.SDL_NumJoysticks()
    try:
        while running and pid_alive(watch_pid):
            time.sleep(0.45)
            sdl.SDL_JoystickUpdate()
            cur = sdl.SDL_NumJoysticks()
            if cur > prev_count:
                time.sleep(0.35)
                post_shift_f3(cg)
            prev_count = cur
    finally:
        sdl.SDL_Quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
