import clsx from "clsx";
import { useCallback } from "react";
import { useEvent } from "react-use";

import { useSimulator } from "@/hooks/useSimulator";
import { useTranslate } from "@/hooks/useTranslate";

export function Controls({ className }: { className?: string }) {
  const translate = useTranslate();

  const [state, dispatch] = useSimulator();

  const onKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.key === "F5") {
        ev.preventDefault();
        if (ev.shiftKey) dispatch("cpu.stop");
        else dispatch("cpu.run");
      } else if (ev.key === "F11") {
        ev.preventDefault();
        dispatch("cpu.step");
      }
    },
    [dispatch],
  );

  useEvent("keydown", onKeyDown, undefined, [dispatch]);

  return (
    <div className={clsx("flex items-center justify-center gap-4", className)}>
      {state.type === "stopped" ? (
        <button
          className="flex w-min items-center gap-1 rounded-md bg-mantis-500 p-2 text-mantis-50 transition-colors hover:enabled:bg-mantis-600 hover:enabled:text-white disabled:opacity-40"
          onClick={() => dispatch("cpu.run")}
        >
          <span className="icon-[lucide--play] block h-5 w-5" />
          <span className="whitespace-nowrap font-semibold tracking-wide">
            {translate("runner.action.start")}
          </span>
        </button>
      ) : (
        <button
          className="flex w-min items-center gap-1 rounded-md bg-mantis-500 p-2 text-mantis-50 transition-colors hover:enabled:bg-mantis-600 hover:enabled:text-white disabled:opacity-40"
          onClick={() => dispatch("cpu.stop")}
        >
          <span className="icon-[lucide--stop-circle] block h-5 w-5" />
          <span className="whitespace-nowrap font-semibold tracking-wide">
            {translate("runner.action.stop")}
          </span>
        </button>
      )}
    </div>
  );
}
