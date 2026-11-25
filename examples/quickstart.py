"""Bind TACT to the functions of a device and give it requests."""
import tact

functions = [
    {"name": "set_light",
     "description": "Turn a light on or off and set its brightness.",
     "parameters": {"type": "object",
                    "properties": {"room": {"type": "string", "description": "Room of the light."},
                                   "state": {"type": "string", "enum": ["on", "off"]},
                                   "brightness": {"type": "integer", "description": "Brightness in percent."}},
                    "required": ["room", "state"]}},
    {"name": "set_thermostat",
     "description": "Set the target temperature in degrees Celsius.",
     "parameters": {"type": "object",
                    "properties": {"temperature": {"type": "number"}},
                    "required": ["temperature"]}},
    {"name": "lock_door",
     "description": "Lock or unlock a door.",
     "parameters": {"type": "object",
                    "properties": {"door": {"type": "string", "enum": ["front", "back", "garage"]},
                                   "locked": {"type": "boolean"}},
                    "required": ["door", "locked"]}},
]

model = tact.load()
device = model.bind(functions)          # the function list is encoded once, here
for request in ["turn on the kitchen light at 40 percent",
                "it's a bit cold, make it 22 degrees",
                "lock the garage and switch off the bedroom light"]:
    print(request, "->", device(request))
