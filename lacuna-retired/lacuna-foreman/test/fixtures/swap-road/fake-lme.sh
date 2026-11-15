#!/bin/zsh
# fake-lme.sh — the engine's binary in the launcher's test: `fake-lme.sh serve <model> <marker>` writes its arguments to
# <marker>, so a test sees whether the launcher started it, and with which command line.
print -r -- "$*" > ${3:?}
