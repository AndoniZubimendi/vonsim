import { match } from "ts-pattern";

import { MAX_SIGNED_VALUE, MAX_VALUE, Size } from "@/config";

// #=========================================================================#
// # Byte/Word                                                               #
// #=========================================================================#

export type Word = [low: number, high: number];

// Little endian

export function joinLowHigh(...[low, high]: Word): number {
  // Shift the high byte to the most significant byte and OR it with the low byte
  return (high << 8) | low;
}

export function splitLowHigh(value: number): Word {
  // Low byte - mask the least significant byte
  // High byte - shift the most significant byte to the least significant byte and mask it
  return [value & 0xff, (value >> 8) & 0xff];
}

// #=========================================================================#
// # Numbers                                                                 #
// #=========================================================================#

export function unsignedToSigned(n: number, size: Size): number {
  return n > MAX_VALUE[size] ? MAX_VALUE[size] - n : n;
}

export function signedToUnsigned(n: number, size: Size): number {
  return n < 0 ? MAX_SIGNED_VALUE[size] - n : n;
}

export const randomByte = () => Math.floor(Math.random() * MAX_VALUE.byte);
export const randomWord = () => Math.floor(Math.random() * MAX_VALUE.word);

// #=========================================================================#
// # Render                                                                  #
// #=========================================================================#

export type MemoryRepresentation = "hex" | "bin" | "int" | "uint" | "ascii";

export function renderMemoryCell(n: number, representation: MemoryRepresentation): string {
  // n is a number between 0 and 255
  return match(representation)
    .with("hex", () => n.toString(16).padStart(2, "0").toUpperCase())
    .with("bin", () => n.toString(2).padStart(8, "0"))
    .with("int", () => unsignedToSigned(n, "byte").toString(10)) // Ca2 or 2's complement
    .with("uint", () => n.toString(10)) // BSS or unsinged int
    .with("ascii", () => String.fromCharCode(n))
    .exhaustive();
}

export function renderAddress(address: number, withH = true): string {
  return address.toString(16).padStart(4, "0").toUpperCase() + (withH ? "h" : "");
}

export function renderWord(n: number): string {
  return splitLowHigh(n)
    .reverse()
    .map(n => n.toString(2).padStart(8, "0"))
    .join(" ");
}

// #=========================================================================#
// # Others                                                                  #
// #=========================================================================#

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
