# capture-qwen-renders.py — captures jinja2's render of Qwen3.6's own chat template (from its GGUF) for the conversations
# the Gemma 4 fixtures hold, into fixtures/qwen-renders.json, once; qwen-chat.test.mjs compares ours against it.
# The environment is Hugging Face's: trim_blocks, lstrip_blocks, tojson = json.dumps(ensure_ascii=False).
# Usage: <forge python> capture-qwen-renders.py <qwen.gguf>
import json, os, sys
from jinja2.sandbox import ImmutableSandboxedEnvironment
from gguf import GGUFReader
FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'test', 'fixtures')
f = GGUFReader(sys.argv[1]).fields['tokenizer.chat_template']
tpl = bytes(f.parts[f.data[0]]).decode()
env = ImmutableSandboxedEnvironment(trim_blocks=True, lstrip_blocks=True)
def raise_exception(m): raise ValueError(m)
env.filters['tojson'] = lambda x, indent=None, separators=None, sort_keys=False: json.dumps(x, ensure_ascii=False, indent=indent, separators=separators, sort_keys=sort_keys)
env.globals['raise_exception'] = raise_exception
t = env.from_string(tpl)
cases = json.load(open(os.path.join(FIX, 'gemma4-renders.json')))
out = []
for c in cases:
    body = c['body']
    msgs = []
    for m in body['messages']:
        m = dict(m)
        if m.get('tool_calls'):
            m['tool_calls'] = [{**tc, 'function': {**tc['function'], 'arguments': json.loads(tc['function']['arguments']) if isinstance(tc['function']['arguments'], str) else tc['function']['arguments']}} for tc in m['tool_calls']]
        msgs.append(m)
    think = body.get('chat_template_kwargs', {}).get('enable_thinking', False)
    prompt = t.render(messages=msgs, tools=body.get('tools'), add_generation_prompt=True, enable_thinking=think)
    out.append({'name': c['name'], 'body': body, 'prompt': prompt})
json.dump(out, open(os.path.join(FIX, 'qwen-renders.json'), 'w'), indent=1, ensure_ascii=False)
print(len(out), 'cases')
