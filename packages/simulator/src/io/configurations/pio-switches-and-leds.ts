import type { IOAddressLike } from "@vonsim/common/address";
import type { Byte } from "@vonsim/common/byte";
import type { JsonObject } from "type-fest";

import type { ComponentInit } from "../../component";
import type { EventGenerator } from "../../events";
import { Leds } from "../devices/leds";
import { Switches } from "../devices/switches";
import { IOInterface } from "../interface";
import { PIOSwitchesAndLeds } from "../modules/pio/switches-and-leds";

export class IOPIOSwitchesAndLeds extends IOInterface {
  // Devices
  readonly leds: Leds;
  readonly switches: Switches;

  // Modules
  readonly pio: PIOSwitchesAndLeds;

  constructor(options: ComponentInit) {
    super(options);
    this.leds = new Leds(options);
    this.switches = new Switches(options);
    this.pio = new PIOSwitchesAndLeds(options);
  }

  /**
   * Reads a byte from IO memory at the specified address.
   * @param address The address to read the byte from.
   * @returns The byte at the specified address (always 8-bit) or null if there was an error.
   */
  *read(address: IOAddressLike): EventGenerator<Byte<8> | null> {
    const pio = this.pio.chipSelect(address);
    if (pio) {
      yield { type: "cs:selected", chip: "pio" };
      return yield* this.pio.read(pio);
    }

    return yield* super.read(address);
  }

  /**
   * Writes a byte to IO memory at the specified address.
   * @param address The address to write the byte to.
   * @param value The byte to write.
   * @returns Whether the operation succedeed or not (boolean).
   */
  *write(address: IOAddressLike, value: Byte<8>): EventGenerator<boolean> {
    const pio = this.pio.chipSelect(address);
    if (pio) {
      yield { type: "cs:selected", chip: "pio" };
      yield* this.pio.write(pio, value);
      return true;
    }

    return yield* super.write(address, value);
  }

  toJSON(): JsonObject {
    return {
      ...super.toJSON(),
      leds: this.leds.toJSON(),
      switches: this.switches.toJSON(),
      pio: this.pio.toJSON(),
    };
  }
}
