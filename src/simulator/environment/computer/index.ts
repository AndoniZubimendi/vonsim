import { isMatching, match } from "ts-pattern";
import create from "zustand";
import type { Program } from "~/compiler";
import { RegisterType, WordRegisterType } from "~/compiler/common";
import { wordRegisterPattern } from "~/compiler/common/patterns";
import {
  INITIAL_IP,
  MAX_BYTE_VALUE,
  MAX_MEMORY_ADDRESS,
  MAX_SIGNED_BYTE_VALUE,
  MAX_SIGNED_WORD_VALUE,
  MAX_WORD_VALUE,
  MEMORY_SIZE,
  MIN_MEMORY_ADDRESS,
  MIN_SIGNED_BYTE_VALUE,
  MIN_SIGNED_WORD_VALUE,
} from "~/config";
import { useConfig } from "../config";
import { joinLowHigh, renderAddress, splitLowHigh, unsignedToSigned } from "../helpers";
import { programToBytecode } from "./bytecode";
import { runInstruction } from "./runner";

export type ArithmeticOperation = "ADD" | "ADC" | "SUB" | "SBB";
export type LogicalOperation = "AND" | "OR" | "XOR" | "NOT";
export type ALUOperation = ArithmeticOperation | LogicalOperation;

export type ComputerStore = {
  memory: number[];
  registers: { [key in WordRegisterType]: number };
  alu: {
    left: number;
    right: number;
    result: number;
    operation: ALUOperation;
    flags: { carry: boolean; overflow: boolean; sign: boolean; zero: boolean };
  };
  program: Program | null;

  getMemory(address: number, size: "byte" | "word"): number;
  getRegister(register: RegisterType): number;
  setMemory: (address: number, size: "byte" | "word", value: number) => void;
  setRegister: (register: RegisterType, value: number) => void;

  executeArithmetic: (
    operation: ArithmeticOperation,
    left: number,
    right: number,
    size: "byte" | "word",
  ) => number;

  executeLogical: (
    operation: LogicalOperation,
    left: number,
    right: number,
    size: "byte" | "word",
  ) => number;

  loadProgram: (program: Program) => void;
  runInstruction: () => boolean;
};

export const useComputer = create<ComputerStore>()((set, get) => ({
  memory: new Array(MEMORY_SIZE).fill(0),
  registers: {
    AX: 0,
    BX: 0,
    CX: 0,
    DX: 0,
    IP: INITIAL_IP,
    IR: 0,
    SP: MEMORY_SIZE,
    MAR: 0,
    MBR: 0,
  },
  alu: {
    left: 0,
    right: 0,
    result: 0,
    operation: "AND",
    flags: { carry: false, overflow: false, sign: false, zero: true },
  },
  program: null,

  getMemory: (address, size) => {
    if (size === "byte") {
      if (address < MIN_MEMORY_ADDRESS || address > MAX_MEMORY_ADDRESS) {
        throw new Error(`La dirección de memoria ${renderAddress(address)} está fuera de rango.`);
      }
      return get().memory[address];
    } else {
      if (address < MIN_MEMORY_ADDRESS || address > MAX_MEMORY_ADDRESS - 1) {
        throw new Error(`La dirección de memoria ${renderAddress(address)} está fuera de rango.`);
      }
      return joinLowHigh(get().memory[address], get().memory[address + 1]);
    }
  },

  getRegister: register => {
    return match(register)
      .with("AL", () => splitLowHigh(get().registers.AX)[0])
      .with("AH", () => splitLowHigh(get().registers.AX)[1])
      .with("BL", () => splitLowHigh(get().registers.BX)[0])
      .with("BH", () => splitLowHigh(get().registers.BX)[1])
      .with("CL", () => splitLowHigh(get().registers.CX)[0])
      .with("CH", () => splitLowHigh(get().registers.CX)[1])
      .with("DL", () => splitLowHigh(get().registers.DX)[0])
      .with("DH", () => splitLowHigh(get().registers.DX)[1])
      .with(wordRegisterPattern, reg => get().registers[reg])
      .exhaustive();
  },

  setMemory: (address, size, value) => {
    const memory = [...get().memory];

    if (size === "byte") {
      if (address < MIN_MEMORY_ADDRESS || address > MAX_MEMORY_ADDRESS) {
        throw new Error(`La dirección de memoria ${renderAddress(address)} está fuera de rango.`);
      }
      memory[address] = value;
    } else {
      if (address < MIN_MEMORY_ADDRESS || address > MAX_MEMORY_ADDRESS - 1) {
        throw new Error(`La dirección de memoria ${renderAddress(address)} está fuera de rango.`);
      }
      const [low, high] = splitLowHigh(value);
      memory[address] = low;
      memory[address + 1] = high;
    }

    set({ memory });
  },

  setRegister: (register, value) => {
    if (isMatching(wordRegisterPattern, register)) {
      set(state => ({
        ...state,
        registers: {
          ...state.registers,
          [register]: value,
        },
      }));
    } else {
      const wordRegister = (register[0] + "X") as WordRegisterType;
      let [low, high] = splitLowHigh(get().registers[wordRegister]);
      if (register[1] === "L") low = value;
      else if (register[1] === "H") high = value;
      set(state => ({
        ...state,
        registers: {
          ...state.registers,
          [wordRegister]: joinLowHigh(low, high),
        },
      }));
    }
  },

  executeArithmetic: (operation, uleft, uright, size) => {
    const left = unsignedToSigned(uleft, size);
    const right = unsignedToSigned(uright, size);

    // Unsigned result
    let uresult: number = match(operation)
      .with("ADD", () => uleft + uright)
      .with("ADC", () => uleft + uright + Number(get().alu.flags.carry))
      .with("SUB", () => uleft - uright)
      .with("SBB", () => uleft - uright - Number(get().alu.flags.carry))
      .exhaustive();

    // Signed result
    const result: number = match(operation)
      .with("ADD", () => left + right)
      .with("ADC", () => left + right + Number(get().alu.flags.carry))
      .with("SUB", () => left - right)
      .with("SBB", () => left - right - Number(get().alu.flags.carry))
      .exhaustive();

    const max = size === "byte" ? MAX_BYTE_VALUE : MAX_WORD_VALUE;
    const maxSigned = size === "byte" ? MAX_SIGNED_BYTE_VALUE : MAX_SIGNED_WORD_VALUE;
    const minSigned = size === "byte" ? MIN_SIGNED_BYTE_VALUE : MIN_SIGNED_WORD_VALUE;

    const flags = {
      carry: uresult < 0 || uresult > max,
      overflow: result < minSigned || result > maxSigned,
      sign: result < 0,
      zero: result === 0,
    };

    if (uresult > max) uresult = uresult - max - 1; // overflow
    else if (uresult < 0) uresult = uresult + max + 1; // underflow

    set(state => ({
      ...state,
      alu: {
        ...state.alu,
        left,
        right,
        result: uresult,
        operation,
        flags,
      },
    }));

    return uresult;
  },

  executeLogical: (operation, left, right, size) => {
    const result: number = match(operation)
      .with("AND", () => left & right)
      .with("OR", () => left | right)
      .with("XOR", () => left ^ right)
      .with("NOT", () => ~right)
      .exhaustive();

    const flags = {
      carry: false,
      overflow: false,
      sign: result >> (size === "byte" ? 7 : 15) === 1,
      zero: result === 0,
    };

    set(state => ({
      ...state,
      alu: {
        ...state.alu,
        left,
        right,
        result,
        operation,
        flags,
      },
    }));

    return result;
  },

  loadProgram: program => {
    const memoryConfig = useConfig.getState().memoryOnReset;

    const memory: number[] =
      memoryConfig === "empty"
        ? new Array(MEMORY_SIZE).fill(0)
        : memoryConfig === "random"
        ? new Array(MEMORY_SIZE).fill(0).map(() => Math.round(Math.random() * MAX_BYTE_VALUE))
        : [...get().memory];

    programToBytecode(memory, program);

    set({
      memory,
      program,
      registers: {
        IP: INITIAL_IP,
        IR: 0,
        SP: MEMORY_SIZE,
        MAR: 0,
        MBR: 0,
        ...(memoryConfig === "empty"
          ? { AX: 0, BX: 0, CX: 0, DX: 0 }
          : memoryConfig === "random"
          ? {
              AX: Math.random() * MAX_WORD_VALUE,
              BX: Math.random() * MAX_WORD_VALUE,
              CX: Math.random() * MAX_WORD_VALUE,
              DX: Math.random() * MAX_WORD_VALUE,
            }
          : {
              AX: get().registers.AX,
              BX: get().registers.BX,
              CX: get().registers.CX,
              DX: get().registers.DX,
            }),
      },
    });
  },

  runInstruction,
}));