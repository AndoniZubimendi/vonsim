import clsx from "clsx";

import { animated, getSpring } from "@/simulator/computer/shared/springs";

export function DataLines({ className }: { className?: string }) {
  const addressPath = [
    "M 699 349 H 800", // CPU -> Memory
    "M 725 349 V 770", // Down
    "M 450 770 H 999", // Big horizontal line
    "M 618 770 V 875", // Timer
  ].join(" ");

  const dataPath = [
    "M 687 249 H 800", // CPU -> Memory
    "M 770 249 V 790", // Down
    "M 450 790 H 999", // Big horizontal line
    "M 598 790 V 875", // Timer
  ].join(" ");

  return (
    <svg
      viewBox="0 0 1500 1100"
      className={clsx("pointer-events-none absolute z-[5] h-[1100px] w-[1500px]", className)}
    >
      {/* Data lines */}
      <path
        className="fill-none stroke-stone-900 stroke-[14px]"
        strokeLinejoin="round"
        d={dataPath}
      />
      <animated.path
        className="fill-none stroke-[12px]"
        strokeLinejoin="round"
        d={dataPath}
        style={getSpring("bus.data")}
      />

      {/* Address lines */}
      <path
        className="fill-none stroke-stone-900 stroke-[14px]"
        strokeLinejoin="round"
        d={addressPath}
      />
      <animated.path
        className="fill-none stroke-[12px]"
        strokeLinejoin="round"
        d={addressPath}
        style={getSpring("bus.address")}
      />
    </svg>
  );
}