import { match } from "ts-pattern";
import type { Merge } from "type-fest";

import { CompilerError, IOInstructionType } from "@/compiler/common";
import {
  InstructionStatement,
  NumberExpression,
  numberExpressionPattern,
  Operand,
} from "@/compiler/parser/grammar";
import type { Size } from "@/config";

import type { LabelTypes } from "../../get-label-types";
import type { ValidatedMeta } from "../types";

export type ValidatedIOInstruction = {
  type: IOInstructionType;
  meta: ValidatedMeta;
  opSize: Size;
  port: { type: "fixed"; value: NumberExpression } | { type: "variable" };
};

export function validateIOInstruction(
  instruction: Merge<InstructionStatement, { instruction: IOInstructionType }>,
  labels: LabelTypes,
): ValidatedIOInstruction {
  if (instruction.operands.length !== 2) {
    throw new CompilerError("expects-two-operands").at(instruction);
  }

  const internal = instruction.operands[instruction.instruction === "IN" ? 0 : 1];
  const external = instruction.operands[instruction.instruction === "IN" ? 1 : 0];

  if (internal.type !== "register" || (internal.value !== "AX" && internal.value !== "AL")) {
    throw new CompilerError("expects-ax").at(internal);
  }

  const opSize = internal.value === "AX" ? "word" : "byte";

  return match<Operand, ValidatedIOInstruction>(external)
    .with({ type: "register" }, reg => {
      if (reg.value !== "DX") {
        throw new CompilerError("expects-dx").at(reg);
      }

      return {
        type: instruction.instruction,
        meta: { label: instruction.label, start: 0, length: 1, position: instruction.position },
        opSize,
        port: { type: "variable" },
      };
    })
    .with({ type: "address" }, external => {
      throw new CompilerError("expects-immediate").at(external);
    })
    .with(numberExpressionPattern, external => {
      // Can be a label pointing to a DB or DW
      if (external.type === "label" && !external.offset) {
        const label = labels.get(external.value);
        if (label === "DB" || label === "DW") {
          throw new CompilerError("label-should-be-a-number", external.value).at(external);
        }
      }

      return {
        type: instruction.instruction,
        meta: { label: instruction.label, start: 0, length: 2, position: instruction.position },
        opSize,
        port: { type: "fixed", value: external },
      };
    })
    .exhaustive();
}