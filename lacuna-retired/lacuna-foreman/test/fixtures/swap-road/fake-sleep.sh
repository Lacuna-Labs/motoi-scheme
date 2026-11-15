#!/bin/zsh
# fake-sleep.sh — the swap road's clock in a test: each sleep is written to $FAKE_STATE/sleeps.log and returns at once.
print -r -- "$1" >> $FAKE_STATE/sleeps.log
