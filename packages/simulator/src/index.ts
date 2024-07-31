import type { Byte } from "@vonsim/common/byte";

import { Computer, ComputerOptions } from "./computer";
import { SimulatorError } from "./error";
import type { EventGenerator, SimulatorEvent } from "./events";

/**
 * Simulator class.
 *
 * It's mainly a wrapper around the Computer class, which is the one that actually
 * does all the work. This wrapper is just to make it easier to use and prevents
 * the user from messing with the internals of the computer.
 *
 * @see {@link Computer}
 *
 * {@link Simulator.startCPU} and some functions in {@link Simulator.devices} return
 * a generator of {@link SimulatorEvent}. This is an object describing the event that
 * was generated by the Simulator.
 *
 * ---
 * This class is: MUTABLE
 */
export class Simulator {
  #computer: Computer = new Computer({
    program: { data: [], instructions: [] },
    devices: { keyboardAndScreen: false, pic: false, pio: null, handshake: null },
    data: "clean",
  });

  /**
   * Loads a program into the computer!
   *
   * @param options.program The program to load.
   * @param options.data Whether to leave all data (memory, registers, etc.) `unchanged`, `randomize` it or `clean` it.
   * @param options.devices Which devices to connect to the computer.
   */
  loadProgram(options: Omit<ComputerOptions, "previous">) {
    this.#computer = new Computer({ ...options, previous: this.#computer });
  }

  /**
   * Returns a copy of the current state of the computer as a JSON object.
   */
  getComputerState() {
    return this.#computer?.toJSON() || null;
  }

  /**
   * Starts the CPU of the computer. Returns a generator of {@link SimulatorEvent}.
   * @see {@link SimulatorEvent}
   */
  startCPU(): EventGenerator {
    if (!this.#computer) throw new SimulatorError("no-program");
    return this.#computer.cpu.run();
  }

  /**
   * Returns an object with all the devices of the computer
   * that can be interacted with from the outside.
   */
  get devices() {
    if (!this.#computer) throw new Error("No computer loaded!");

    return {
      clock: {
        connected: () => this.#computer.io.clock !== null,
        tick: () => {
          if (this.#computer.io.clock) return this.#computer.io.clock.tick();
          else console.warn("Called clock.tick() when no clock was connected to the computer");
        },
      },
      f10: {
        connected: () => this.#computer.io.f10 !== null,
        press: () => {
          if (this.#computer.io.f10) return this.#computer.io.f10.press();
          else console.warn("Called f10.press() when no f10 was connected to the computer");
        },
      },
      keyboard: {
        connected: () => this.#computer.io.keyboard !== null,
        readChar: (char: Byte<8>) => {
          if (this.#computer.io.keyboard) return this.#computer.io.keyboard.setLastCharRead(char);
          else
            console.warn("Called keyboard.press() when no keyboard was connected to the computer");
        },
      },
      leds: {
        connected: () => this.#computer.io.leds !== null,
      },
      printer: {
        connected: () => this.#computer.io.printer !== null,
        clear: () => {
          if (this.#computer.io.printer) return this.#computer.io.printer.clear();
          else console.warn("No printer connected to the computer!");
        },
        print: () => {
          if (this.#computer.io.printer) return this.#computer.io.printer.print();
          else console.warn("No printer connected to the computer!");
        },
      },
      screen: {
        connected: () => this.#computer.io.screen !== null,
        clear: () => {
          if (this.#computer.io.screen) return this.#computer.io.screen.clear();
          else console.warn("Called screen.clear() when no screen was connected to the computer");
        },
      },
      switches: {
        connected: () => this.#computer.io.switches !== null,
        toggle: (index: number) => {
          if (this.#computer.io.switches) return this.#computer.io.switches.toggle(index);
          else
            console.warn(
              "Called switches.toggle() when no switches were connected to the computer",
            );
        },
      },
    };
  }
}

type ComputerState = ReturnType<Simulator["getComputerState"]>;

export type { ComputerOptions, ComputerState, EventGenerator, SimulatorEvent };
export { SimulatorError };
