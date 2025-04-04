import { animated, getSpring } from "@/computer/shared/springs";
import { useSimulation } from "@/computer/simulation";

export function Clock() {
  const { devices } = useSimulation();

  if (!devices.clock) return null;

  const angle = getSpring("clock.angle");

  return (
    <div className="**:z-20 absolute left-[520px] top-[930px] z-10 size-12 rounded-full border border-stone-600 bg-stone-800 p-1">
      <svg
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-full fill-none stroke-white stroke-2"
      >
        <circle cx="12" cy="12" r="10" />
        <animated.line
          x1={angle.to(w => 12 + 6 * Math.sin((w * Math.PI) / 180))}
          y1={angle.to(w => 12 - 6 * Math.cos((w * Math.PI) / 180))}
          x2={12}
          y2={12}
        />
      </svg>
    </div>
  );
}
