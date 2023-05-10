import { isMatching, match } from "ts-pattern";
import type { Merge } from "type-fest";

import { CompilerError, RegisterType, UnaryInstructionType } from "@/compiler/common";
import { wordRegisterPattern } from "@/compiler/common/patterns";
import {
  InstructionStatement,
  NumberExpression,
  numberExpressionPattern,
  Operand,
} from "@/compiler/parser/grammar";
import type { Size } from "@/config";

import type { LabelTypes } from "../../get-label-types";
import type { ValidatedMeta } from "../types";

type RegisterOperand = { type: "register"; register: RegisterType };
type MemoryOperand = { type: "memory" } & (
  | { mode: "direct"; address: NumberExpression }
  | { mode: "indirect" }
);

export type ValidatedUnaryInstruction = {
  type: UnaryInstructionType;
  meta: ValidatedMeta;
  opSize: Size;
  out: RegisterOperand | MemoryOperand;
};

/**
 * Validates a unary instruction.
 *
 * The parser returns a generic instruction statement, with operands that can be
 * - a register (`AX`, `BL`, etc...)
 * - an address, that can be
 *   - direct (`[1234h]`, `[OFFSET dataLabel]`, `[instruction_label]` etc...)
 *     its value is always an expression that can be calculated at compile time
 *   - indirect (`[BX]`)
 * - an immediate value (`1234h`, `OFFSET dataLabel`, `instruction_label` etc...)
 *   its value is always an expression that can be calculated at compile time
 *   those are invalid for unary instructions, so we throw an error
 * - a data label (`dataLabel`)
 *   it's a special case of an immediate value, quasi-equivalent to `[OFFSET dataLabel]`
 *   although it isn't an expression, it comes from the parser as an expression
 *   with just one label (see the patterns above)
 *
 * Notice that both immediate values and data labels are expressions can be
 * expression with just one label, so we need to distinguish them.s
 */

export function validateUnaryInstruction(
  instruction: Merge<InstructionStatement, { instruction: UnaryInstructionType }>,
  labels: LabelTypes,
): ValidatedUnaryInstruction {
  if (instruction.operands.length !== 1) {
    throw new CompilerError("expects-one-operand").at(instruction);
  }

  return match<Operand, ValidatedUnaryInstruction>(instruction.operands[0])
    .with({ type: "register" }, out => {
      const reg = isMatching(wordRegisterPattern, out.value)
        ? ({ type: "register", size: "word", value: out.value, position: out.position } as const)
        : ({ type: "register", size: "byte", value: out.value, position: out.position } as const);

      return {
        type: instruction.instruction,
        meta: { label: instruction.label, start: 0, length: 2, position: instruction.position },
        opSize: reg.size,
        out: { type: "register", register: reg.value },
      };
    })
    .with({ type: "address", mode: "direct" }, out => {
      if (out.size === "auto") {
        throw new CompilerError("unknown-size").at(out);
      }

      return {
        type: instruction.instruction,
        meta: { label: instruction.label, start: 0, length: 3, position: instruction.position },
        opSize: out.size,
        out: { type: "memory", mode: "direct", address: out.value },
      };
    })
    .with({ type: "address", mode: "indirect" }, out => {
      if (out.size === "auto") {
        throw new CompilerError("unknown-size").at(out);
      }

      return {
        type: instruction.instruction,
        meta: { label: instruction.label, start: 0, length: 1, position: instruction.position },
        opSize: out.size,
        out: { type: "memory", mode: "indirect" },
      };
    })
    .with(numberExpressionPattern, out => {
      if (out.type !== "label" || out.offset) {
        throw new CompilerError("destination-cannot-be-immediate").at(out);
      }

      const outType = labels.get(out.value);
      if (!outType) {
        throw new CompilerError("label-not-found", out.value).at(out);
      }

      const outSize = outType === "DB" ? "byte" : outType === "DW" ? "word" : false;
      if (!outSize) {
        throw new CompilerError("label-should-be-writable", out.value).at(out);
      }

      return {
        type: instruction.instruction,
        meta: { label: instruction.label, start: 0, length: 3, position: instruction.position },
        opSize: outSize,
        /**
         * As previously stated, the operand `dataLabel` is essentially `[OFFSET dataLabel]`.
         * For consistency, we convert it to a memory operand with a direct address.
         */
        out: {
          type: "memory",
          mode: "direct",
          address: { type: "label", offset: true, value: out.value, position: out.position },
        },
      };
    })
    .exhaustive();
}