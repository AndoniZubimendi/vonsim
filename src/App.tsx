import { linter } from "@codemirror/lint";
import { useCodeMirror } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";
import { compile } from "./compiler";

function App() {
  const [cache, setCache] = useState("");
  const [compiled, setCompiled] = useState("");

  const editor = useRef<HTMLDivElement | null>(null);
  const { setContainer } = useCodeMirror({
    container: editor.current,
    value: cache,
    onChange: value => setCache(value),
    width: "600px",
    height: "400px",
    extensions: [
      linter(view => {
        const result = compile(view.state.doc.toString());
        if (result.success) {
          setCompiled(result.result);
          return [];
        } else {
          setCompiled("Error");
          return result.errors.map(error => ({
            from: error.from,
            to: error.to,
            message: error.message,
            severity: "error",
          }));
        }
      }),
    ],
  });

  useEffect(() => {
    if (editor.current) {
      setContainer(editor.current);
    }
  }, [editor.current]);

  return (
    <div className="p-4">
      <h1 className="text-center text-4xl font-bold">VonSim</h1>

      <div className="flex gap-4">
        <div ref={editor} />
        <div>
          <b>Compiled</b>
          <pre className="grow rounded bg-gray-200 p-4">{compiled}</pre>
        </div>
      </div>
    </div>
  );
}

export default App;