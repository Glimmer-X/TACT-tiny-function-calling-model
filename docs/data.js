// Demo devices (from the Authored test set) and the results of the ten models.
export const DEVICES = [
 {
  "name": "Lamp",
  "functions": [
   {
    "name": "switch_lamp",
    "description": "Switch the lamp in a room on or off.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      },
      "state": {
       "type": "string",
       "description": "new state",
       "enum": [
        "on",
        "off"
       ]
      }
     },
     "required": [
      "room",
      "state"
     ]
    }
   },
   {
    "name": "dim_lamp",
    "description": "Set how bright the lamp in a room is.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      },
      "percent": {
       "type": "integer",
       "description": "brightness from 0 to 100"
      }
     },
     "required": [
      "room",
      "percent"
     ]
    }
   },
   {
    "name": "tint_lamp",
    "description": "Change the colour of the lamp in a room.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      },
      "colour": {
       "type": "string",
       "description": "colour name"
      }
     },
     "required": [
      "room",
      "colour"
     ]
    }
   }
  ],
  "examples": [
   "Turn on the lamp in the kitchen.",
   "Set the bedroom lamp to 30 percent.",
   "I want warm white in the bathroom.",
   "Switch on the garage lamp and set it to half brightness."
  ]
 },
 {
  "name": "Climate",
  "functions": [
   {
    "name": "read_thermometer",
    "description": "Read the temperature sensor of a room in degrees Celsius.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      }
     },
     "required": [
      "room"
     ]
    }
   },
   {
    "name": "read_hygrometer",
    "description": "Read the relative humidity sensor of a room.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      }
     },
     "required": [
      "room"
     ]
    }
   },
   {
    "name": "set_thermostat",
    "description": "Set the target temperature of a room.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      },
      "celsius": {
       "type": "number",
       "description": "target temperature"
      }
     },
     "required": [
      "room",
      "celsius"
     ]
    }
   },
   {
    "name": "set_blower",
    "description": "Set the fan speed of the air unit in a room.",
    "parameters": {
     "type": "object",
     "properties": {
      "room": {
       "type": "string",
       "description": "room name"
      },
      "speed": {
       "type": "string",
       "description": "fan speed",
       "enum": [
        "low",
        "medium",
        "high"
       ]
      }
     },
     "required": [
      "room",
      "speed"
     ]
    }
   }
  ],
  "examples": [
   "How warm is it in the bedroom?",
   "Is the basement damp? Check the humidity.",
   "Set the office to 21 degrees.",
   "Tell me the temperature and the humidity in the kitchen."
  ]
 },
 {
  "name": "Car",
  "functions": [
   {
    "name": "cabin_temperature",
    "description": "Set the cabin temperature.",
    "parameters": {
     "type": "object",
     "properties": {
      "celsius": {
       "type": "number",
       "description": "target temperature"
      }
     },
     "required": [
      "celsius"
     ]
    }
   },
   {
    "name": "window",
    "description": "Move a window.",
    "parameters": {
     "type": "object",
     "properties": {
      "seat": {
       "type": "string",
       "description": "which window",
       "enum": [
        "driver",
        "passenger",
        "rear left",
        "rear right"
       ]
      },
      "open_percent": {
       "type": "integer",
       "description": "0 is closed, 100 is fully open"
      }
     },
     "required": [
      "seat",
      "open_percent"
     ]
    }
   },
   {
    "name": "seat_heating",
    "description": "Set the heating level of a seat.",
    "parameters": {
     "type": "object",
     "properties": {
      "seat": {
       "type": "string",
       "description": "which seat",
       "enum": [
        "driver",
        "passenger"
       ]
      },
      "level": {
       "type": "integer",
       "description": "0 is off, 3 is the highest"
      }
     },
     "required": [
      "seat",
      "level"
     ]
    }
   },
   {
    "name": "trunk",
    "description": "Open or close the trunk.",
    "parameters": {
     "type": "object",
     "properties": {
      "action": {
       "type": "string",
       "description": "what to do",
       "enum": [
        "open",
        "close"
       ]
      }
     },
     "required": [
      "action"
     ]
    }
   },
   {
    "name": "tyre_pressure",
    "description": "Read the pressure of all four tyres.",
    "parameters": {
     "type": "object",
     "properties": {},
     "required": []
    }
   }
  ],
  "examples": [
   "Set the cabin to 22 degrees.",
   "Roll down the driver window.",
   "Driver seat heating to level 2."
  ]
 },
 {
  "name": "Robot arm",
  "functions": [
   {
    "name": "move_joint",
    "description": "Rotate one joint of the arm to an angle.",
    "parameters": {
     "type": "object",
     "properties": {
      "joint": {
       "type": "integer",
       "description": "joint number"
      },
      "degrees": {
       "type": "number",
       "description": "target angle"
      }
     },
     "required": [
      "joint",
      "degrees"
     ]
    }
   },
   {
    "name": "gripper",
    "description": "Open or close the gripper.",
    "parameters": {
     "type": "object",
     "properties": {
      "action": {
       "type": "string",
       "description": "what to do",
       "enum": [
        "open",
        "close"
       ]
      }
     },
     "required": [
      "action"
     ]
    }
   },
   {
    "name": "go_home",
    "description": "Move the arm to its home position.",
    "parameters": {
     "type": "object",
     "properties": {},
     "required": []
    }
   },
   {
    "name": "set_speed",
    "description": "Set the arm speed as a share of the maximum.",
    "parameters": {
     "type": "object",
     "properties": {
      "percent": {
       "type": "integer",
       "description": "speed from 1 to 100"
      }
     },
     "required": [
      "percent"
     ]
    }
   }
  ],
  "examples": [
   "Rotate joint 2 to 45 degrees.",
   "Close the gripper.",
   "Send the arm home.",
   "Open the gripper and then go home."
  ]
 },
 {
  "name": "Dev board",
  "functions": [
   {
    "name": "write_pin",
    "description": "Drive a digital output pin of the board.",
    "parameters": {
     "type": "object",
     "properties": {
      "pin": {
       "type": "integer",
       "description": "pin number"
      },
      "level": {
       "type": "string",
       "description": "logic level",
       "enum": [
        "high",
        "low"
       ]
      }
     },
     "required": [
      "pin",
      "level"
     ]
    }
   },
   {
    "name": "sample_adc",
    "description": "Take one reading from an analogue input channel.",
    "parameters": {
     "type": "object",
     "properties": {
      "channel": {
       "type": "integer",
       "description": "channel number"
      }
     },
     "required": [
      "channel"
     ]
    }
   },
   {
    "name": "set_pwm",
    "description": "Set the duty cycle of a PWM output.",
    "parameters": {
     "type": "object",
     "properties": {
      "channel": {
       "type": "integer",
       "description": "channel number"
      },
      "duty_percent": {
       "type": "integer",
       "description": "duty cycle from 0 to 100"
      }
     },
     "required": [
      "channel",
      "duty_percent"
     ]
    }
   },
   {
    "name": "blink",
    "description": "Blink an LED a number of times.",
    "parameters": {
     "type": "object",
     "properties": {
      "led": {
       "type": "integer",
       "description": "LED number"
      },
      "times": {
       "type": "integer",
       "description": "how many blinks"
      }
     },
     "required": [
      "led",
      "times"
     ]
    }
   }
  ],
  "examples": [
   "Drive pin 7 high.",
   "Read ADC channel 3.",
   "Set PWM channel 2 to 75 percent duty.",
   "Set pin 5 high, then sample channel 1."
  ]
 },
 {
  "name": "Greenhouse",
  "functions": [
   {
    "name": "soil_moisture",
    "description": "Read the soil moisture sensor of a plant bed.",
    "parameters": {
     "type": "object",
     "properties": {
      "bed": {
       "type": "string",
       "description": "bed name"
      }
     },
     "required": [
      "bed"
     ]
    }
   },
   {
    "name": "grow_light",
    "description": "Switch the grow light over a bed on or off.",
    "parameters": {
     "type": "object",
     "properties": {
      "bed": {
       "type": "string",
       "description": "bed name"
      },
      "state": {
       "type": "string",
       "description": "new state",
       "enum": [
        "on",
        "off"
       ]
      }
     },
     "required": [
      "bed",
      "state"
     ]
    }
   },
   {
    "name": "roof_vent",
    "description": "Open the roof vent by a given amount.",
    "parameters": {
     "type": "object",
     "properties": {
      "open_percent": {
       "type": "integer",
       "description": "0 is shut, 100 is fully open"
      }
     },
     "required": [
      "open_percent"
     ]
    }
   },
   {
    "name": "mist",
    "description": "Run the misting nozzles for a number of seconds.",
    "parameters": {
     "type": "object",
     "properties": {
      "seconds": {
       "type": "integer",
       "description": "duration"
      }
     },
     "required": [
      "seconds"
     ]
    }
   }
  ],
  "examples": [
   "How wet is the soil in the tomato bed?",
   "Turn on the grow light over the seedlings.",
   "Open the roof vent halfway.",
   "Open the vent fully and mist for 10 seconds."
  ]
 }
];

export const SETS = ["Held-out", "Authored", "External-A", "External-B", "Mean"];

export const MODELS = [
 {
  "name": "TACT",
  "params": "7.4M",
  "mb": 2.39,
  "size": "2.39 MB",
  "scores": [
   76.5,
   82.8,
   83.1,
   78.9,
   80.3
  ]
 },
 {
  "name": "Needle 2",
  "params": "45M",
  "mb": 14,
  "size": "14 MB",
  "scores": [
   68.2,
   76.7,
   86.5,
   76.5,
   77.0
  ]
 },
 {
  "name": "Needle 3",
  "params": "121M",
  "mb": 35,
  "size": "35 MB",
  "scores": [
   69.6,
   68.3,
   83.1,
   79.9,
   75.3
  ]
 },
 {
  "name": "Needle 1",
  "params": "30M",
  "mb": 61,
  "size": "61 MB",
  "scores": [
   35.7,
   39.2,
   46.1,
   37.7,
   39.7
  ]
 },
 {
  "name": "FunctionGemma 270M",
  "params": "268M",
  "mb": 536,
  "size": "536 MB",
  "scores": [
   42.7,
   58.3,
   62.9,
   53.4,
   54.3
  ]
 },
 {
  "name": "LFM2.5-350M",
  "params": "354M",
  "mb": 709,
  "size": "709 MB",
  "scores": [
   53.2,
   67.5,
   77.5,
   68.1,
   66.6
  ]
 },
 {
  "name": "Hammer2.1-0.5B",
  "params": "494M",
  "mb": 988,
  "size": "988 MB",
  "scores": [
   65.1,
   80.8,
   83.1,
   70.1,
   74.8
  ]
 },
 {
  "name": "Qwen3-0.6B",
  "params": "752M",
  "mb": 1500,
  "size": "1.5 GB",
  "scores": [
   60.6,
   65.0,
   57.3,
   65.2,
   62.0
  ]
 },
 {
  "name": "Qwen3.5-0.8B",
  "params": "873M",
  "mb": 1700,
  "size": "1.7 GB",
  "scores": [
   71.7,
   84.2,
   69.7,
   77.9,
   75.9
  ]
 },
 {
  "name": "xLAM-2-1B",
  "params": "1.54B",
  "mb": 3100,
  "size": "3.1 GB",
  "scores": [
   79.5,
   86.7,
   91.0,
   90.2,
   86.8
  ]
 }
];
