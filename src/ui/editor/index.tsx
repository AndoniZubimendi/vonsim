import { history } from "@codemirror/commands";
import { indentOnInput } from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  showPanel,
} from "@codemirror/view";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { useCallback, useEffect, useState } from "react";
import { useKey } from "react-use";

import { cn } from "@/ui/lib/utils";

import { lintSummaryPanel } from "./lint";
import { lineHighlightField, readOnly } from "./methods";
import { initialDoc, storePlugin } from "./store";
import { VonSim } from "./vonsim";

/**
 * CodeMirror editor
 *
 * I've chosen to use CodeMirror because it's a very powerful editor that
 * supports mobile devices.
 *
 * I save the editor instance in the window object so I can access it from
 * anywhere in the app. I don't save it in a React state because it's a
 * very heavy object and I don't want to re-render the app every time the
 * editor changes.
 */

export function Editor({ className }: { className?: string }) {
  const [element, setElement] = useState<HTMLElement>();

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;

    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    window.codemirror = new EditorView({
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          EditorState.tabSize.of(2),
          readOnly.of(EditorState.readOnly.of(false)),

          storePlugin,

          lineNumbers(),
          lineHighlightField,
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          highlightActiveLine(),
          keymap.of(vscodeKeymap),
          VonSim(),
          lintGutter(),
          showPanel.of(lintSummaryPanel),
        ],
      }),
      parent: element,
    });

    return () => window.codemirror?.destroy();
  }, [element]);

  useKey(
    e => e.ctrlKey && e.key === "s",
    ev => {
      ev.preventDefault();
      if (!window.codemirror) return;

      const blob = new Blob([window.codemirror.state.doc.toString()], { type: "text/plain" });
      const href = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = href;
      a.download = `vonsim-${new Date().toISOString().slice(0, 16)}.txt`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    },
  );

  return <div ref={ref} className={cn("h-full overflow-auto font-mono", className)} />;
}
