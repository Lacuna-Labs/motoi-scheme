"""The gateway's words: Ollama's chat in, llama-server's chat out, and back — tools, schemas, grammar, thinking, the
channel mark, images."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gateway as g  # noqa: E402


def test_a_plain_turn_with_a_schema_and_a_grammar():
    r = g.to_openai({"model": "lacuna-worker-lite", "stream": False, "think": False, "format": {"type": "object"},
                     "grammar": "root ::= \"(\" \")\"", "options": {"num_predict": 600, "temperature": 0.1, "num_ctx": 65536},
                     "messages": [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}]})
    assert r["response_format"] == {"type": "json_schema", "json_schema": {"name": "answer", "schema": {"type": "object"}}}
    assert r["grammar"].startswith("root") and r["max_tokens"] == 600 and r["temperature"] == 0.1
    assert r["chat_template_kwargs"] == {"enable_thinking": False} and "num_ctx" not in r and r["cache_prompt"]


def test_tool_calls_round_trip_with_ids():
    r = g.to_openai({"model": "x", "messages": [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "", "tool_calls": [{"function": {"name": "health_check", "arguments": {"a": 1}}}]},
        {"role": "tool", "content": "{}"}], "tools": [{"type": "function", "function": {"name": "health_check"}}]})
    a = r["messages"][1]["tool_calls"][0]
    assert a["id"] == "call_0" and json.loads(a["function"]["arguments"]) == {"a": 1}
    assert r["messages"][2]["tool_call_id"] == "call_0" and r["tools"]


def test_an_answer_comes_back_in_ollamas_words_without_the_channel_mark():
    out = g.from_openai({"choices": [{"message": {"content": "<|channel>thought\n<channel|>(subscribe 'x 60)",
                                                  "tool_calls": [{"function": {"name": "f", "arguments": "{\"k\": 2}"}}]},
                                      "finish_reason": "stop"}], "usage": {"prompt_tokens": 9, "completion_tokens": 4}}, "m", 0)
    assert out["message"]["content"] == "(subscribe 'x 60)"
    assert out["message"]["tool_calls"] == [{"function": {"name": "f", "arguments": {"k": 2}}}]
    assert out["prompt_eval_count"] == 9 and out["eval_count"] == 4 and out["done"]


def test_images_become_image_parts_and_think_true_stays_on():
    r = g.to_openai({"model": "x", "think": True, "messages": [{"role": "user", "content": "what", "images": ["AAAA"]}]})
    parts = r["messages"][0]["content"]
    assert parts[0] == {"type": "text", "text": "what"} and parts[1]["image_url"]["url"].endswith("AAAA")
    assert r["chat_template_kwargs"] == {"enable_thinking": True}


def test_only_the_brain_goes_to_llama_server():
    assert g.is_brain("lacuna-worker-lite") and g.is_brain("lacuna-worker-lite:latest") and g.is_brain("gemma4:26b")
    assert g.is_brain("gemma4:e4b") and g.is_brain("gemma4:e4b-it-qat")
    assert not g.is_brain("nomic-embed-text") and not g.is_brain("lacuna-27b")


# ── small minds (minds.py, minds_words.py, gguf_mend.py) ────────────────────────────────────────────────────────────
import struct  # noqa: E402
import threading  # noqa: E402
import urllib.request  # noqa: E402
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer  # noqa: E402

import pytest  # noqa: E402

import gguf_mend  # noqa: E402
import minds  # noqa: E402
import minds_words as w  # noqa: E402


class FakeProc:
    _n = 100

    def __init__(self):
        FakeProc._n += 1
        self.pid, self.dead = FakeProc._n, False

    def poll(self):
        return 0 if self.dead else None

    def send_signal(self, _):
        self.dead = True

    def wait(self, timeout=None):
        return 0

    def kill(self):
        self.dead = True


@pytest.fixture
def store(tmp_path, monkeypatch):
    """A fixture Ollama store: functiongemma (model only) and gemma4:e2b (model + projector)."""
    def put(repo, tag, layers):
        d = tmp_path / "manifests" / "registry.ollama.ai" / "library" / repo
        d.mkdir(parents=True, exist_ok=True)
        (d / tag).write_text(json.dumps({"layers": [{"mediaType": f"application/vnd.ollama.image.{k}",
                                                     "digest": f"sha256:{k}{repo}", "size": n} for k, n in layers]}))
    put("functiongemma", "latest", [("model", 300 << 20), ("license", 10), ("params", 26)])
    put("gemma4", "e2b", [("model", 3 << 30), ("projector", 1 << 30), ("template", 13)])
    monkeypatch.setattr(minds, "OLLAMA_MODELS", str(tmp_path))
    return tmp_path


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def pool(clock=None, ready=True, memory=64 << 30):
    spawned = []

    def spawn(name, res, port):
        spawned.append((name, port))
        return FakeProc()
    p = minds.Pool(clock=clock or Clock(), spawn=spawn, ready=lambda proc, port: ready, memory=lambda: memory)
    p._free_port = lambda: 8092 + len(spawned)
    p._remember_pids = lambda extra=None: None
    return p, spawned


def test_blob_resolution_reads_ollamas_manifest(store, monkeypatch):
    monkeypatch.setattr(minds, "TEXT_ONLY", lambda: [])          # the resolver itself, not this box's text-only rule
    r = minds.resolve("functiongemma")
    assert r["model"]["path"].endswith("blobs/sha256-modelfunctiongemma") and "projector" not in r
    r = minds.resolve("gemma4:e2b")
    assert r["projector"]["path"].endswith("sha256-projectorgemma4") and r["model"]["size"] == 3 << 30
    assert minds.resolve("gemma3:1b") is None


def test_small_names_are_the_pulled_ones_and_never_a_brain_name(store, monkeypatch):
    monkeypatch.setattr(minds, "profile", lambda: {})             # the pulled ones, not this box's trained roles
    monkeypatch.setattr(minds, "SMALL_NAMES", "functiongemma,gemma4:e2b")
    names = minds.small_names(g.BRAIN_NAMES | {"gemma4:e2b"})
    assert names == ["functiongemma:latest"]
    assert "gemma4:e2b" in minds.small_names(set())


def test_routing_small_minds_vs_the_brain(store, monkeypatch):
    monkeypatch.setattr(g, "SMALL", {"functiongemma:latest"})
    assert g.is_small("functiongemma") and g.is_small("functiongemma:latest")
    assert not g.is_small("gemma4:e4b") and g.is_brain("gemma4:e4b")      # the owner's one-brain rule stands
    assert not g.is_small("nomic-embed-text") and not g.is_small(None)
    assert g.served_by("functiongemma").startswith("llama.cpp") and g.served_by("nomic-embed-text") == "ollama"


def test_grammar_and_googles_sampling_reach_a_small_mind():
    body = {"model": "gemma3:270m", "grammar": 'root ::= "a" | "b"', "options": {"temperature": 0},
            "messages": [{"role": "user", "content": "pick"}]}
    req = w.shape(g.to_openai(body), body, "gemma3:270m")
    assert req["grammar"] == 'root ::= "a" | "b"' and req["temperature"] == 0       # the caller's 0 stands
    assert req["top_k"] == 64 and req["top_p"] == 0.95 and req["model"] == "gemma3:270m"
    body = {"model": "gemma3:270m", "format": {"type": "string"}, "messages": [{"role": "user", "content": "x"}]}
    req = w.shape(g.to_openai(body), body, "gemma3:270m")
    assert req["temperature"] == 1.0 and req["response_format"]["json_schema"]["schema"] == {"type": "string"}


def test_functiongemma_prompt_and_calls_in_googles_format():
    tools = [{"type": "function", "function": {"name": "get_weather", "description": "Weather for a city",
              "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}]
    body = {"model": "functiongemma", "tools": tools, "messages": [
        {"role": "system", "content": "Be brief."}, {"role": "user", "content": "Paris?"},
        {"role": "assistant", "content": "", "tool_calls": [{"function": {"name": "get_weather", "arguments": {"city": "Paris"}}}]},
        {"role": "tool", "content": "{\"temp\": 15}"}]}
    req = w.shape(g.to_openai(body), body, "functiongemma:latest")
    dev = req["messages"][0]["content"]
    assert "tools" not in req and dev.startswith("Be brief.\n" + w.ESSENTIAL + "<start_function_declaration>")
    assert "declaration:get_weather{description:<escape>Weather for a city<escape>,parameters:{type:<escape>OBJECT<escape>" in dev
    assert req["messages"][2]["content"] == "<start_function_call>call:get_weather{city:<escape>Paris<escape>}<end_function_call>"
    assert req["messages"][3]["content"] == "<start_function_response>response:get_weather{temp:15}<end_function_response>"
    out = w.finish({"message": {"role": "assistant", "content": "<start_function_call>call:get_weather{city:<escape>Paris<escape>,"
                                "days:3,deep:{on:true}}<end_function_call><start_function_response>"}}, "functiongemma")
    assert out["message"]["tool_calls"] == [{"function": {"name": "get_weather",
                                                          "arguments": {"city": "Paris", "days": 3, "deep": {"on": True}}}}]
    assert out["message"]["content"] == ""
    assert w.finish({"message": {"content": "(report 'ok)<end_of_turn>"}}, "functiongemma")["message"]["content"] == "(report 'ok)"


def test_a_mind_llama_cpp_cannot_load_falls_back_to_ollama(store):
    p, spawned = pool(ready=False)
    p._why = lambda name, proc: f"llama.cpp could not load {name}: unknown architecture"
    with pytest.raises(minds.CannotLoad, match="unknown architecture"):
        p.acquire("functiongemma")
    with pytest.raises(minds.CannotLoad):                    # remembered: never retried on every request
        p.acquire("functiongemma")
    assert len(spawned) == 1 and "functiongemma:latest" in p.cannot


def test_the_memory_guard_refuses_in_a_sentence(store):
    p, spawned = pool(memory=800 << 20)                    # 300 MB weights + margin would leave < the floor
    with pytest.raises(minds.Refused, match=r"needs about \d+ MB and only 800 MB is free"):
        p.acquire("functiongemma")
    assert spawned == [] and not p.pending


def test_idle_minds_stop_on_the_clock_and_busy_ones_do_not(store):
    assert minds.IDLE_S == 600                                # 10m idle unload (polish pass 4.1)
    clock = Clock()
    p, spawned = pool(clock=clock)
    m = p.acquire("functiongemma")
    clock.t += minds.IDLE_S + 1
    assert p.reap() == []                                     # still answering: never stopped mid-request
    p.release(m)
    clock.t += minds.IDLE_S - 1
    assert p.reap() == []
    clock.t += 2
    assert p.reap() == ["functiongemma:latest"] and m.proc.dead and not p.minds
    assert p.acquire("functiongemma") is not m and len(spawned) == 2       # the next request starts it again


def test_never_more_than_the_budget(store, monkeypatch):
    monkeypatch.setattr(minds, "mind_budget", lambda: 4.5)
    monkeypatch.setattr(minds, "weight", lambda n: 4.0 if "e2b" in n else 0.6)
    clock = Clock()
    p, spawned = pool(clock=clock)
    a = p.acquire("functiongemma")
    with pytest.raises(minds.Refused, match="budget"):
        p.acquire("gemma4:e2b")
    p.release(a)
    b = p.acquire("gemma4:e2b")                               # the idle one makes room
    assert a.proc.dead and list(p.minds) == ["gemma4:e2b"] and b.port != a.port


def _gguf(path, n_tokens, rows):
    def s(b):
        return struct.pack("<Q", len(b)) + b
    kv = s(b"general.architecture") + struct.pack("<I", 8) + s(b"gemma3")
    kv += s(b"tokenizer.ggml.tokens") + struct.pack("<IIQ", 9, 8, n_tokens) + b"".join(s(b"t%d" % i) for i in range(n_tokens))
    kv += s(b"tokenizer.ggml.scores") + struct.pack("<IIQ", 9, 6, n_tokens) + struct.pack("<%df" % n_tokens, *range(n_tokens))
    ti = s(b"token_embd.weight") + struct.pack("<I", 2) + struct.pack("<QQ", 4, rows) + struct.pack("<IQ", 0, 0)
    head = b"GGUF" + struct.pack("<IQQ", 3, 1, 3) + kv + ti
    head += b"\0" * (-len(head) % 32)
    path.write_bytes(head + b"WEIGHTS!" * 8)
    return len(head)


def test_the_mend_trims_the_vocabulary_and_moves_no_tensor(tmp_path):
    src, dst = tmp_path / "blob", tmp_path / "mended.gguf"
    _gguf(src, 12, 5)
    assert gguf_mend.mend(str(src), str(dst)).startswith("trimmed 12 tokens to 5 (t5, t6,")
    a, b = src.read_bytes(), dst.read_bytes()
    assert len(a) == len(b) and a.endswith(b"WEIGHTS!" * 8) and b.endswith(b"WEIGHTS!" * 8)
    lay = gguf_mend.read_layout(str(dst))
    toks = next(kv for kv in lay["kvs"] if kv["key"] == "tokenizer.ggml.tokens")["array"][1]
    assert len(toks) == 5 and not gguf_mend.needs_mend(lay) and -(-lay["header_end"] // 32) == -(-gguf_mend.read_layout(str(src))["header_end"] // 32)
    _gguf(src, 5, 5)
    assert gguf_mend.mend(str(src), str(dst)) == "no mend needed"


def test_the_door_serves_a_small_mind_and_names_its_server(store, monkeypatch):
    """End to end through the gateway: a fake llama-server answers in FunctionGemma's words."""
    seen = {}

    class Mind(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            seen["req"] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            data = json.dumps({"choices": [{"message": {"content": "(stop 'mem-watch)<end_of_turn>"}, "finish_reason": "stop"}],
                               "usage": {"prompt_tokens": 5, "completion_tokens": 3}}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
    fake = ThreadingHTTPServer(("127.0.0.1", 0), Mind)
    threading.Thread(target=fake.serve_forever, daemon=True).start()
    p, _ = pool()
    p._free_port = lambda: fake.server_address[1]
    monkeypatch.setattr(g, "POOL", p)
    monkeypatch.setattr(g, "SMALL", {"functiongemma:latest"})
    door = ThreadingHTTPServer(("127.0.0.1", 0), g.Door)
    threading.Thread(target=door.serve_forever, daemon=True).start()
    try:
        body = {"model": "functiongemma", "stream": False, "grammar": "root ::= \"(stop 'mem-watch)\" | \"(report 'ok)\"",
                "options": {"temperature": 0}, "messages": [{"role": "user", "content": "memory at 2%"}]}
        r = urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{door.server_address[1]}/api/chat",
                                                          data=json.dumps(body).encode()), timeout=10)
        out = json.load(r)
        assert out["message"]["content"] == "(stop 'mem-watch)" and out["done"]
        assert r.headers["X-Lacuna-Served-By"] == f"llama.cpp :{fake.server_address[1]} (functiongemma:latest)"
        assert seen["req"]["grammar"].startswith("root") and seen["req"]["temperature"] == 0
        listing = json.load(urllib.request.urlopen(f"http://127.0.0.1:{door.server_address[1]}/lacuna/minds", timeout=10))
        assert listing["minds"][0]["name"] == "functiongemma:latest" and listing["minds"][0]["in_flight"] == 0
    finally:
        door.shutdown()
        fake.shutdown()


def test_the_box_profile_caps_agent_minds_and_names_the_reserved(tmp_path, monkeypatch):
    import json
    import minds
    prof = tmp_path / "box-minds.json"
    prof.write_text(json.dumps({"agent_minds": ["functiongemma", "gemma3:1b"],
                                "reserved": {"gemma4:e4b": "4B: for experiments and Sakura training"}}))
    monkeypatch.setattr(minds, "PROFILE_PATH", str(prof))
    assert minds.profile()["agent_minds"] == ["functiongemma", "gemma3:1b"]
    assert minds.reserved_why("gemma4:e4b").startswith("4B")
    assert minds.reserved_why("functiongemma") is None


def test_the_current_brain_is_read_from_the_brain_profile_not_the_box_file(tmp_path, monkeypatch):
    # order §1.5: switch-brain.sh writes the brain to ~/.lacuna/brain-profile.json only; the box file is configuration
    import json
    import minds
    box = tmp_path / "box-minds.json"
    box.write_text(json.dumps({"agent_minds": ["functiongemma"], "reserved": {}, "brain": "old:tag", "brain_kv_gb": 3, "brain_files": ["/old"]}))
    blob = tmp_path / "blob"
    blob.write_bytes(b"x" * 2**20)
    bp = tmp_path / "brain-profile.json"
    bp.write_text(json.dumps({"brain": "gemma4:e4b-it-qat", "file": str(blob), "brain_kv_gb": 1.5}))
    monkeypatch.setattr(minds, "PROFILE_PATH", str(box))
    monkeypatch.setattr(minds, "BRAIN_PROFILE_PATH", str(bp))
    p = minds.profile()
    assert (p["brain"], p["brain_kv_gb"], p["brain_files"]) == ("gemma4:e4b-it-qat", 1.5, [str(blob)])
    assert abs(minds.brain_gb() - (1.5 + 1 / 1024)) < 1e-6
    monkeypatch.setattr(minds, "BRAIN_PROFILE_PATH", str(tmp_path / "none.json"))
    assert minds.profile()["brain"] == "old:tag"                  # no profile yet: the box's own word stands


def test_the_shipped_profile_keeps_agents_at_2b_or_under():
    import minds
    p = minds.profile()
    assert p["max_params_b"] in (2, 4) and "gemma4:e4b" in p["reserved"] and "gemma4:e4b" not in p["agent_minds"]
    assert p["workhorse"] in (None, "gemma4:e4b", "gemma4:e4b-it-q8_0")


def test_a_person_always_finds_a_brain_slot():
    import gateway

    class H:                                      # just enough of the request handler for _person
        def __init__(self, path, lane=None):
            self.path, self.headers = path, ({"X-Lacuna-Lane": lane} if lane else {})
    person = gateway.Door._person
    assert person(H("/api/chat", "person")) is True
    assert person(H("/api/chat")) is False                 # agents, workers, benches: background by default
    assert person(H("/v1/chat/completions")) is False       # Pi's terminal is background: the person's slot is the chat's
    assert person(H("/v1/chat/completions", "background")) is False
    assert gateway.BACKGROUND._initial_value == max(1, gateway.BRAIN_SLOTS - 1)


# ── certainty (design §40.1, the first lens) ───────────────────────────────────────────────────────────────────────
def _lp(tok, p, alts=()):
    import math
    return {"token": tok, "logprob": math.log(p), "top_logprobs": [{"token": t, "logprob": math.log(q)} for t, q in alts]}


def test_certainty_is_the_lowest_and_mean_over_content_tokens_only():
    entries = [_lp("real", 0.9), _lp("-", 0.05), _lp("error", 0.31), _lp("\n", 0.2), _lp("<end_of_turn>", 0.01)]
    c = w.certainty(entries)
    assert c["certainty"] == 0.31 and c["certainty_weakest"] == "error" and c["certainty_tokens"] == 2
    assert c["certainty_mean"] == round((0.9 + 0.31) / 2, 4)
    assert w.certainty([]) == {} and w.certainty(None) == {}


def test_a_token_the_grammar_steered_counts_its_share_of_what_was_allowed():
    # raw: the mind wanted "error" (0.6); the grammar allowed "noise" (0.3): at least 0.3 / (1 - 0.6) of what was left
    c = w.certainty([_lp("noise", 0.3, [("error", 0.6), ("noise", 0.3), ("ok", 0.05)])])
    assert c["certainty"] == 0.75


def test_under_a_json_schema_only_the_values_count():
    entries = [_lp("{", 0.9), _lp("\n", 1.0), _lp("  ", 0.9), _lp('"', 1.0), _lp("label", 0.2, [("metric", 0.7)]),
               _lp('":', 1.0), _lp(' "', 1.0), _lp("noise", 0.95), _lp('"', 0.2, [('",', 0.8)]), _lp("}", 1.0)]
    c = w.certainty(entries, json_values=True)
    assert c["certainty"] == 0.95 and c["certainty_weakest"] == "noise" and c["certainty_tokens"] == 1
    assert w.certainty(entries)["certainty_weakest"] == "label"                     # without the schema the key counts


def test_every_small_mind_call_asks_for_its_probabilities_and_the_caller_may_ask_for_alternatives():
    body = {"model": "gemma3:270m", "messages": [{"role": "user", "content": "x"}]}
    req = w.shape(g.to_openai(body), body, "gemma3:270m")
    assert req["logprobs"] is True and req["top_logprobs"] == w.ALTERNATIVES      # to see what the grammar refused
    body = {**body, "logprobs": True, "top_logprobs": 99}
    assert w.shape(g.to_openai(body), body, "gemma3:270m")["top_logprobs"] == 20
    assert w.top_n({"options": {"n_probs": 3}}) == 3 and w.top_n({"top_logprobs": "x"}) == 0


def test_an_answer_carries_its_certainty_and_logprobs_only_when_asked():
    r = {"choices": [{"message": {"content": "noise"}, "finish_reason": "stop",
                      "logprobs": {"content": [_lp("noise", 0.42, [("noise", 0.42), ("real", 0.4)])]}}]}
    out = w.finish(g.from_openai(r, "gemma3:270m", 0), "gemma3:270m", {})
    assert out["certainty"] == 0.42 and "logprobs" not in out and "_logprobs" not in out
    out = w.finish(g.from_openai(r, "gemma3:270m", 0), "gemma3:270m", {"logprobs": True, "top_logprobs": 2})
    assert out["logprobs"][0]["token"] == "noise" and out["logprobs"][0]["top_logprobs"][1]["token"] == "real"
    plain = g.from_openai({"choices": [{"message": {"content": "x"}}]}, "lacuna-worker-lite", 0)
    assert "_logprobs" not in plain                          # the brain's answers are unchanged


def test_the_door_returns_a_small_minds_certainty(store, monkeypatch):
    seen = {}

    class Mind(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            seen["req"] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            data = json.dumps({"choices": [{"message": {"content": "real-error"}, "finish_reason": "stop",
                                            "logprobs": {"content": [_lp("real", 0.8), _lp("-", 0.99), _lp("error", 0.6)]}}],
                               "usage": {}}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
    fake = ThreadingHTTPServer(("127.0.0.1", 0), Mind)
    threading.Thread(target=fake.serve_forever, daemon=True).start()
    p, _ = pool()
    p._free_port = lambda: fake.server_address[1]
    monkeypatch.setattr(g, "POOL", p)
    monkeypatch.setattr(g, "SMALL", {"functiongemma:latest"})
    door = ThreadingHTTPServer(("127.0.0.1", 0), g.Door)
    threading.Thread(target=door.serve_forever, daemon=True).start()
    try:
        body = {"model": "functiongemma", "stream": False, "messages": [{"role": "user", "content": "Traceback …"}]}
        out = json.load(urllib.request.urlopen(urllib.request.Request(
            f"http://127.0.0.1:{door.server_address[1]}/api/chat", data=json.dumps(body).encode()), timeout=10))
        assert seen["req"]["logprobs"] is True
        assert out["certainty"] == 0.6 and out["certainty_weakest"] == "error" and out["certainty_tokens"] == 2
    finally:
        door.shutdown()
        fake.shutdown()


def test_the_budget_fits_the_owners_configurations(tmp_path, monkeypatch):
    import json
    import minds
    prof = tmp_path / "box-minds.json"
    prof.write_text(json.dumps({"mind_budget_gb": 4.5, "weights_gb": {"gemma3:270m": 0.5, "functiongemma": 0.5,
                                                                      "gemma3:1b": 1.2, "gemma4:e2b": 4.0}}))
    monkeypatch.setattr(minds, "PROFILE_PATH", str(prof))
    w, b = minds.weight, minds.mind_budget()
    assert w("gemma3:270m") + w("functiongemma") + w("gemma3:1b") <= b        # two tiny and a 1B
    assert w("gemma3:1b") * 2 <= b                                            # two 1Bs
    assert w("gemma4:e2b") + w("gemma3:270m") <= b                            # an ear and a 270
    assert w("gemma4:e2b") + w("gemma3:1b") > b                               # not an E2B and a 1B


def test_a_role_serves_its_trained_gguf_and_family(store, tmp_path, monkeypatch):
    """A trained mind in service (box-minds.json `roles`, written by the forge's promote): the role's name resolves to its
    current version's own GGUF, weighed from that file, with its family's tokenizer fixes."""
    gg = tmp_path / "trained" / "sentry" / "v2" / "sentry.gguf"
    gg.parent.mkdir(parents=True)
    gg.write_bytes(b"\0" * 4096)
    prof = tmp_path / "box-minds.json"
    prof.write_text(json.dumps({"agent_minds": ["functiongemma"], "roles": {
        "sentry": {"model": str(gg), "version": "v2", "previous": "v1", "family": "gemma3"}}}))
    monkeypatch.setattr(minds, "PROFILE_PATH", str(prof))
    r = minds.resolve("sentry")
    assert r["model"]["path"] == str(gg) and r["model"]["size"] == 4096 and minds.resolve("sentry:latest") == r
    assert minds.family("sentry") == "gemma3" and minds.family("functiongemma") == "functiongemma"
    assert "sentry:latest" in minds.small_names(set()) and minds.weight("sentry") < 1
    assert minds.resolve(str(tmp_path / "missing.gguf")) is None
    gg.unlink()
    assert "sentry:latest" not in minds.small_names(set())          # a missing file is not served


def test_an_abandoned_request_is_hung_up_on():
    """The caller's socket closes → the watcher shuts the upstream connection (the brain stops generating for no one)."""
    import socket as so
    import threading
    import time as t
    import gateway

    a, b = so.socketpair()                           # a = the caller's side as the handler sees it; b = the caller
    up_a, up_b = so.socketpair()                     # the upstream connection to the brain

    class Raw:                                       # just the attribute path the watcher shuts: up.fp.raw._sock
        _sock = up_a

    class Up:
        class fp:
            raw = Raw

    class H:
        connection = a
    before = gateway.GONE[0]
    stop = gateway.hangup.when_gone(H.connection, Up(), gateway.GONE)
    b.close()                                        # the caller goes away
    for _ in range(30):
        if gateway.GONE[0] > before:
            break
        t.sleep(0.1)
    assert gateway.GONE[0] == before + 1
    assert up_b.recv(1) == b""                       # the brain's side sees the hang-up
    stop()


def test_a_malformed_call_fails_instead_of_spinning():
    """2026-10-18: a stray ']' inside {…} made decode loop forever (the forge's Worker writer sat at 100% CPU for 30 min)."""
    import pytest
    import minds_words
    import signal

    def never(*_):
        raise TimeoutError("decode spun")
    signal.signal(signal.SIGALRM, never)
    for bad in ('{a:]}', '{a:1,]', '[1,}', '{a:{b:]}}', '{:', '{,,,', '[[[', '{a:<escape>x'):
        signal.alarm(2)
        try:
            minds_words.decode(bad)                  # junk out is fine (the type check refuses it); a hang is not
        except (ValueError, IndexError):
            pass
        finally:
            signal.alarm(0)
    assert minds_words.decode('{a:1,b:[2,3]}')[0] == {"a": 1, "b": [2, 3]}


def test_a_text_only_mind_never_loads_its_projector(store, monkeypatch):
    monkeypatch.setattr(minds, "TEXT_ONLY", lambda: ["gemma4:e2b"])
    r = minds.resolve("gemma4:e2b")
    assert "projector" not in r and r["model"]["path"]
