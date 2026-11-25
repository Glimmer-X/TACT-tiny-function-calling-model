# TACT: a 2.39 MB function-calling language model, more accurate than open models up to 700 times its size

TACT (Ternary Action-Calling Transformer) reads a request in natural language and the list of functions a device offers, and returns the function calls that carry out the request. It has 7.4 million parameters and its weights occupy 2.39 MB.

```
request     lock the garage and switch off the bedroom light
functions   set_light(room, state, brightness)   set_thermostat(temperature)   lock_door(door, locked)

output      [{"name": "lock_door", "arguments": {"door": "garage", "locked": true}},
             {"name": "set_light", "arguments": {"room": "bedroom", "state": "off"}}]
```

The function list is given at run time. TACT is not tied to a fixed set of commands: a new device only needs its own list.

Weights: [Glimmer-X/TACT-tiny-function-calling-model](https://huggingface.co/Glimmer-X/TACT-tiny-function-calling-model) on Hugging Face.

## Use

```bash
pip install git+https://github.com/Glimmer-X/TACT-tiny-function-calling-model
```

```python
import tact

functions = [
    {"name": "set_light",
     "description": "Turn a light on or off and set its brightness.",
     "parameters": {"type": "object",
                    "properties": {"room": {"type": "string"},
                                   "state": {"type": "string", "enum": ["on", "off"]},
                                   "brightness": {"type": "integer"}},
                    "required": ["room", "state"]}},
]

model = tact.load()                 # downloads the weights on first use
device = model.bind(functions)      # encodes the function list once
device("turn on the kitchen light at 40 percent")
# [{'name': 'set_light', 'arguments': {'room': 'kitchen', 'state': 'on', 'brightness': 40}}]
```

Functions are described in the JSON Schema form used by most function-calling interfaces. `device(request)` returns a list of calls, or `None` when the output is not a list of calls. `device.batch(requests)` answers several requests at once. The model runs on a CPU; pass `device="cuda"` to `tact.load` for a GPU.

[examples/quickstart.py](examples/quickstart.py) is a complete script.

## Model

| | |
|---|---|
| Parameters | 7.4 million |
| Weights | 2.39 MB |
| Structure | encoder-decoder Transformer, width 512, 8 heads |
| Depth | one encoder block applied 6 times, one decoder block applied 4 times |
| Linear weights | ternary, 2 bits each |
| Embedding | 4096 tokens, 4 bits per value, shared with the output layer |
| Activations | 8 bits at the input of every linear layer |
| Language | English |

Three choices give the size. All weights of the linear layers are ternary. Each stack has one block whose weights are reused at every iteration. The function list is encoded separately from the request, so the list of a device is encoded once and its encoding is reused for every request.

The weight file stores the ternary values at 2 bits and the embedding at 4 bits. [tact/weights.py](tact/weights.py) reads it and [tact/model.py](tact/model.py) is the whole model.

## Results

Accuracy on four device-control test sets, in percent. A request counts as correct when the output calls equal the reference calls in names and in every argument value. The numbers for TACT are the mean of three training runs.

| Model | Parameters | Size | Held-out | Authored | External-A | External-B | Mean |
|---|---|---|---|---|---|---|---|
| **TACT** | 7.4M | 2.39 MB | 76.5 | 82.8 | 83.1 | 78.9 | 80.3 |
| Needle 2 | 45M | 14 MB | 68.2 | 76.7 | 86.5 | 76.5 | 77.0 |
| Needle 3 | 121M | 35 MB | 69.6 | 68.3 | 83.1 | 79.9 | 75.3 |
| Needle 1 | 30M | 61 MB | 35.7 | 39.2 | 46.1 | 37.7 | 39.7 |
| FunctionGemma 270M | 268M | 536 MB | 42.7 | 58.3 | 62.9 | 53.4 | 54.3 |
| LFM2.5-350M | 354M | 709 MB | 53.2 | 67.5 | 77.5 | 68.1 | 66.6 |
| Hammer2.1-0.5B | 494M | 988 MB | 65.1 | 80.8 | 83.1 | 70.1 | 74.8 |
| Qwen3-0.6B | 752M | 1.5 GB | 60.6 | 65.0 | 57.3 | 65.2 | 62.0 |
| Qwen3.5-0.8B | 873M | 1.7 GB | 71.7 | 84.2 | 69.7 | 77.9 | 75.9 |
| xLAM-2-1B | 1.54B | 3.1 GB | 79.5 | 86.7 | 91.0 | 90.2 | 86.8 |

The four sets are in [eval_sets/](eval_sets/), one scenario per line. A scenario is the function list of one device with its requests and reference calls.

| Set | Written by | Scenarios | Functions | Requests |
|---|---|---|---|---|
| `held_out` | DeepSeek-V4.1-Flash, set aside before training | 150 | 692 | 1601 |
| `authored` | the authors | 12 | 51 | 120 |
| `external_a` | Qwen3.5 | 10 | 50 | 89 |
| `external_b` | Qwen3.8-27B | 24 | 115 | 204 |

The released weights are one of the three runs. This command evaluates them:

```bash
python scripts/evaluate.py
```

```
held_out      1203 /  1601   75.1%
authored       100 /   120   83.3%
external_a      76 /    89   85.4%
external_b     161 /   204   78.9%
mean                         80.7%
```

It takes about three minutes on a laptop CPU. A count can move by one request between machines.

## Scope

TACT is built for device control with requests in English. It returns function calls and does not hold a conversation.

## Citation

```bibtex
@article{xu2026tact,
  title  = {TACT: A Weight-Shared Ternary Transformer Language Model for Function Calling in a Few Megabytes},
  author = {Xu, Dongkun and Wang, Runlong and Ni, Xianpo and Arslan, Tughrul},
  year   = {2026}
}
```

## License

MIT, for the code and the weights.
