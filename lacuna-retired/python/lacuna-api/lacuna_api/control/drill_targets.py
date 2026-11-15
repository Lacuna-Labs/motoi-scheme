"""THE DiRT PICKER'S WORDS (the owner, 2026-10-18: "DiRT: a drill picker, targets, a rehearsal, the history, the recovery
graph — no destructive key"): what goes dark when each of our services is down, and the customer side that is never a
target. GET /api/drills/targets is the door's (lacuna-node/frontend/drill-targets.mjs, 2026-11-06, finale §3.12); these tables
stay for the card verbs (card_verbs.py).
"""
from __future__ import annotations

# label suffix → (the drill's service name, what goes dark while it is down)
DARK = {
    "lacuna": ("lacuna", "the desk, the phone, the watcher, every card and alert — Lacuna itself (launchd brings it back)"),
    "brain": ("brain", "the 26B: chat answers, the cart generator, the forge's grading; the desk stays up and says the brain is out"),
    "brain-gateway": ("brain-gateway", "every call to a mind (11434): chat, carts that need a brain, embeddings by the gateway"),
    "ollama": ("ollama", "EmbeddingGemma and the small minds: recall, the vote, new memories wait"),
    "foreman": ("foreman", "carts: no trial, no worker; running workers stop and resume from the mailbox"),
    "world-broker": ("world-broker", "the graph cortex (the only writer) and the jail's errands: new memories and graph reads wait"),
    "desk-https": ("desk-https", "the phone's https door (:8443): the phone cannot reach the desk; the Mac's desk still works"),
    "dev-api": ("dev-api", "the dev API (:5051): the simulator and the dev carts"),
    "vite": ("vite", "the dev web (:3000): the simulator's page"),
    "curator-speech-helper": ("speech-helper", "speech on the dev side (:8765)"),
    "painter": ("painter", "pictures by the painter"),
    "wikipedia": ("wikipedia", "the local Wikipedia reads"),
    "loam-dev": ("loam-dev", "loam on dev"),
    "curator-dev-tunnel": ("tunnel", "the tunnel the shops call back on: sign-ins and webhooks stop arriving"),
    "l2-daemon-dev": ("l2-daemon-dev", "the dev cart queue"),
}
NEVER = ("qa-api", "l2-daemon-qa", "curator-dev-tunnel")      # the customer side and her doors: never a drill target

