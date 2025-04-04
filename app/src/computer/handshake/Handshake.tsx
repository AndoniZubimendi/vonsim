import { Register } from "@/computer/shared/Register";
import { useSimulation } from "@/computer/simulation";
import { useTranslate } from "@/lib/i18n";

import { DATAAtom, STATEAtom } from "./state";

export function Handshake() {
  const translate = useTranslate();
  const { devices } = useSimulation();

  if (!devices.handshake) return null;

  return (
    <div className="**:z-20 absolute left-[900px] top-[925px] z-10 h-min w-[220px] rounded-lg border border-stone-600 bg-stone-900">
      <span className="bg-mantis-500 block size-min rounded-br-lg rounded-tl-lg border-b border-r border-stone-600 px-2 py-1 text-2xl text-white">
        {translate("computer.handshake.name")}
      </span>

      <Register
        name={translate("computer.handshake.state")}
        title={translate("generics.io-register", "STATE", 0x41)}
        valueAtom={STATEAtom}
        springs="handshake.STATE"
        className="mx-auto my-4"
      />

      <hr className="border-stone-600" />

      <Register
        name={translate("computer.handshake.data")}
        title={translate("generics.io-register", "DATA", 0x40)}
        valueAtom={DATAAtom}
        springs="handshake.DATA"
        className="mx-auto my-4"
      />
    </div>
  );
}
