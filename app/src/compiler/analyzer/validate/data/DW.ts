import type { Merge } from "type-fest";

import { CompilerError } from "@/compiler/common";
import type { DataDirectiveStatement, NumberExpression } from "@/compiler/parser/grammar";

import type { ValidatedMeta } from "../types";

export type ValidatedDW = {
  type: "DW";
  meta: ValidatedMeta;
  initialValues: (NumberExpression | null)[];
};

export function validateDW(dw: Merge<DataDirectiveStatement, { directive: "DW" }>): ValidatedDW {
  const initialValues: ValidatedDW["initialValues"] = [];

  for (const value of dw.values) {
    if (value.type === "string") {
      throw new CompilerError("cannot-accept-strings", "DW").at(value);
    } else if (value.type === "unassigned") {
      initialValues.push(null);
    } else {
      initialValues.push(value);
    }
  }

  if (initialValues.length === 0) {
    throw new CompilerError("must-have-one-or-more-values", "DW").at(dw);
  }

  return {
    type: "DW",
    meta: { label: dw.label, start: 0, length: initialValues.length * 2, position: dw.position },
    initialValues,
  };
}