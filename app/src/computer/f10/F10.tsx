import { useKey } from "react-use";

import { useSimulation } from "@/computer/simulation";
import { useTranslate } from "@/lib/i18n";

import styles from "./Button.module.css";

export function F10() {
  const translate = useTranslate();
  const { status, dispatch } = useSimulation();

  useKey("F10", ev => {
    ev.preventDefault();
    dispatch("f10.press");
  });

  return (
    <div className="absolute left-[50px] top-[950px] z-10 flex h-min w-48 flex-col rounded-lg border border-stone-600 bg-stone-900 [&_*]:z-20">
      <button
        className={styles.pushable}
        disabled={status.type !== "running"}
        onClick={() => dispatch("f10.press")}
        title={translate("computer.f10.name")}
      >
        <div className={styles.shadow} />
        <div className={styles.edge} />
        <span className={styles.front}>{translate("computer.f10.interrupt")}</span>
      </button>
    </div>
  );
}
