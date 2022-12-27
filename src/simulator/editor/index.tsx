import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { indentOnInput } from "@codemirror/language";
import { lintGutter, lintKeymap } from "@codemirror/lint";
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
} from "@codemirror/view";
import { Transition } from "@headlessui/react";
import { useCallback, useEffect, useState } from "react";
import { usePrevious } from "react-use";
import { ErrorsStore, useErrors } from "./store";
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

export function Editor() {
  const [element, setElement] = useState<HTMLElement>();
  const errors = useErrors();
  const prevErrors = usePrevious(errors);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;

    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    window.codemirror = new EditorView({
      state: EditorState.create({
        doc: example,
        extensions: [
          EditorState.tabSize.of(2),

          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          highlightActiveLine(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...lintKeymap,
            {
              key: "Tab",
              preventDefault: true,
              run: view => {
                view.dispatch(
                  view.state.update(view.state.replaceSelection(" ".repeat(view.state.tabSize)), {
                    scrollIntoView: true,
                    userEvent: "input",
                  }),
                );
                return true;
              },
            },
          ]),
          VonSim(),
          lintGutter(),
        ],
      }),
      parent: element,
    });

    return () => window.codemirror?.destroy();
  }, [element]);

  return (
    <div className="flex w-[750px] flex-col">
      <div ref={ref} className="flex h-full overflow-auto font-mono" />
      <Transition
        className="overflow-hidden bg-red-500 px-2 py-1 text-white"
        show={errors.numberOfErrors > 0}
        enter="transition-all duration-250"
        enterFrom="h-0"
        enterTo="h-8"
        leave="transition-all duration-150"
        leaveFrom="h-8"
        leaveTo="h-0"
      >
        {/**
         * This prevErrors thing is to persist the message when the div dissapears.
         * Otherwise, it will show "0 errors" for a split second.
         */}

        {errors.numberOfErrors === 0 && prevErrors
          ? errorsToText(prevErrors)
          : errorsToText(errors)}
      </Transition>
    </div>
  );
}

function errorsToText(errors: ErrorsStore) {
  return errors.globalError
    ? errors.globalError
    : errors.numberOfErrors === 1
    ? `Hay un error. Solucionalo antes de compilar.`
    : `Hay ${errors.numberOfErrors} errores. Solucionalos antes de compilar.`;
}

const example = `                   ORG 1000h
                   nombre: DB "JuanLorenzoMartin"
                   fin_nombre: DB 00h
                   vocales: DB "AEIOUaeiou"
                   fin_vocales: DB 00h
                   cantidad_vocales: DB 0

                   ORG 3000h
                   ; CX es la referencia al primer valor
                   ; DX es la referencia al segundo valor
             SWAP: PUSH AX
                   PUSH BX
                   MOV BX, CX
                   MOV AL, [BX] ; Primer valor en AL
                   MOV BX, DX
                   MOV AH, [BX] ; Segundo valor en AH
                   MOV [BX], AL ; Primer valor --> segunda referencia
                   MOV BX, CX
                   MOV [BX], AH ; Segundo valor --> primera referencia
                   POP BX
                   POP AX
                   RET

                   ; Caracter por pila
                   ; Si es vocal, AH=FFh; de lo contrario, AH=00h
    ES_VOCAL:      PUSH BX
                   MOV BX, SP
                   ADD BX, 2 + 2
                   MOV AL, [BX] ; Caracter en AL
                   MOV BX, OFFSET vocales - 1
                   MOV AH, 00h
    ES_VOCAL_LOOP: INC BX
                   CMP BX, OFFSET fin_vocales
                   JZ ES_VOCAL_FIN
                   CMP AL, [BX]
                   JNZ ES_VOCAL_LOOP
                   MOV AH, 0FFh
    ES_VOCAL_FIN:  POP BX
                   RET
                   ; Nota sobre el INC BX:
                   ; Como no podemos usar PUSHF ni POPF porque
                   ; no están bien implementados, tenemos que
                   ; poner el INC en el inicio del loop.


                   ORG 2000h
                   MOV CX, OFFSET nombre
                   MOV DX, OFFSET fin_nombre - 1
        MAIN_LOOP: CMP DX, CX
                   JS LOOP_FIN
                   ; Contar (o no) si el valor al que
                   ; apunta en CX es vocal
                   MOV BX, CX
                   MOV AL, [BX]
                   MOV AH, 00
                   PUSH AX
                   CALL ES_VOCAL
                   CMP AH, 0
                   JZ NO_CONTAR_1
                   INC cantidad_vocales
      NO_CONTAR_1: POP AX
                   ; Si CX y DX apuntan a la misma letra, terminar
                   CMP DX, CX
                   JZ LOOP_FIN
                   ; Contar (o no) si el valor al que
                   ; apunta en DX es vocal
                   MOV BX, DX
                   MOV AL, [BX]
                   MOV AH, 0
                   PUSH AX
                   CALL ES_VOCAL
                   CMP AH, 0
                   JZ NO_CONTAR_2
                   INC cantidad_vocales
      NO_CONTAR_2: POP AX
                   ; Swapear
                   CALL SWAP
                   INC CX
                   DEC DX
                   JMP MAIN_LOOP
         LOOP_FIN: HLT`;
