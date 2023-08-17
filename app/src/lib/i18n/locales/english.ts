import { IOAddress, IOAddressLike, MemoryAddress, MemoryAddressLike } from "@vonsim/common/address";
import type { BaseLocale } from "@vonsim/common/i18n";

const maxAddress = MemoryAddress.from(MemoryAddress.MAX_ADDRESS).toString();

export const english = {
  generics: {
    clean: "Clean",
    "io-register": (name: string, address: IOAddressLike) =>
      `${name} register (${IOAddress.format(address)})`,
    "byte-representation": {
      hex: "Hexadecimal",
      bin: "Binary",
      uint: "Unsigned integer",
      int: "Signed integer",
      ascii: "ASCII",
    },
  },

  update: {
    "update-available": "There's a new version available!",
    reload: "Update",
  },

  messages: {
    "assemble-error": "Assemble error. Fix the errors and try again.",
    "invalid-action": "Invalid action.",
  },

  editor: {
    lintSummary: (n: number) =>
      n === 0 ? "Ready to compile" : n === 1 ? "There's an error" : `There're ${n} errors`,
  },

  control: {
    action: {
      start: "Start",
      continue: "Continue",
      run: {
        "cycle-change": "One cycle",
        "end-of-instruction": "One instruction",
        infinity: "Until stop",
      },
      stop: "Stop",
    },
    tabs: {
      editor: "Editor",
      computer: "Computer",
    },
    zoom: {
      in: "Zoom in",
      out: "Zoom out",
    },
  },

  computer: {
    cpu: {
      name: "CPU",
      register: (register: string) => `${register} register`,
      "control-unit": "Control unit",
      decoder: "Decoder",
      status: {
        fetching: "Fetching instruction...",
        "fetching-operands": "Fetching operands...",
        executing: "Executing...",
        writeback: "Saving results...",
        interrupt: "Handling interrupt...",
        stopped: "Stopped",
        "stopped-error": "Error",
        "waiting-for-input": "Waiting for input...",
      },
    },

    memory: {
      name: "Memory",
      cell: (address: MemoryAddressLike) => `Cell ${MemoryAddress.format(address)}`,
      "fix-address": "Fix address",
      "unfix-address": "Unfix address",
      "address-must-be-integer": "Start address must be an integer.",
      "address-out-of-range": `Start address must be less or equal to ${maxAddress}.`,
    },

    "chip-select": {
      name: "Chip select",
      mem: "mem",
      pic: "pic",
      timer: "timer",
      pio: "pio",
      handshake: "handshake",
    },

    f10: "F10 key",
    keyboard: "Keyboard",
    leds: "LEDs",
    printer: { name: "Printer", buffer: "Buffer" },
    screen: "Screen",
    switches: "Switches",

    handshake: { name: "Handshake", data: "Data", state: "State" },
    pic: "PIC",
    pio: { name: "PIO", port: (port: string) => `Port ${port}` },
    timer: "Timer",
  },

  settings: {
    title: "Settings",

    language: {
      label: "Language",
    },

    dataOnLoad: {
      label: "Data on load",
      description: "What to do with the memory when loading a new program.",

      randomize: "Randomize",
      clean: "Empty",
      unchanged: "Unchanged",
    },

    devices: {
      label: "Devices",
      description: "Which preset of devices to use.",

      "pio-switches-and-leds": "Switches and LEDs",
      "pio-printer": "Printer (PIO)",
      handshake: "Printer (Handshake)",
    },

    speeds: {
      label: "Speeds",

      executionUnit: "Simulation speed",
      clockSpeed: "Clock speed",
      printerSpeed: "Printer speed",
      disableAnimations: {
        label: "Disable animations",
        description:
          "Disable animations for faster running. Only affects animations affected by the simulation speed (e.g. the CPU). Other animations (like the clock and the printer) will run at their own speed.",
      },
    },
  },

  footer: {
    documentation: "Documentation",
    "report-issue": "Report an issue",
    copyright: "III-LIDI, FI, UNLP",
  },
} satisfies BaseLocale;
