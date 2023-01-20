import { isMatching } from "ts-pattern";

import { CompilerError, safeForEach } from "@/compiler/common";
import { instructionPattern } from "@/compiler/common/patterns";
import { MAX_MEMORY_ADDRESS } from "@/config";

import type { ValidatedStatement } from "./validate";

export type LabelAddresses = Map<string, { type: "DB" | "DW" | "instruction"; address: number }>;
export type CodeMemory = Set<number>;

type ComputeAddressesResult =
  | { success: true; codeMemory: CodeMemory; labelAddresses: LabelAddresses }
  | { success: false; errors: unknown[] };

export function computeAddresses(statements: ValidatedStatement[]): ComputeAddressesResult {
  const occupiedMemory = new Set<number>();
  const codeMemory: CodeMemory = new Set();
  const labelAddresses: LabelAddresses = new Map();

  let pointer: number | null = null;
  const result = safeForEach(statements, statement => {
    if (statement.type === "EQU") return;
    if (statement.type === "end") return;

    if (statement.type === "origin-change") {
      pointer = statement.newAddress;
      return;
    } else if (pointer === null) {
      throw new CompilerError("missing-org").at(statement);
    }

    if (statement.meta.label) {
      labelAddresses.set(statement.meta.label, {
        type: statement.type === "DB" || statement.type === "DW" ? statement.type : "instruction",
        address: pointer,
      });
    }

    statement.meta.start = pointer;

    const finalPointer = pointer + statement.meta.length;
    if (finalPointer > MAX_MEMORY_ADDRESS) {
      throw new CompilerError("instruction-out-of-range", finalPointer).at(statement);
    }

    const isInstruction = isMatching(instructionPattern, statement.type);
    for (; pointer < finalPointer; pointer++) {
      if (occupiedMemory.has(pointer)) {
        throw new CompilerError("occupied-address", pointer).at(statement);
      }

      occupiedMemory.add(pointer);
      if (isInstruction) codeMemory.add(pointer);
    }
  });

  if (result.success) return { success: true, codeMemory, labelAddresses };
  else return result;
}
