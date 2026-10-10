import { Node } from "nodered"

const JOYSTICK_I2C_ADDRESS = 0x52;
const I2C_HZ = 100_000;

/* Pin from the editor, or the board's default I2C pin when it is not a number */
function pinOrDefault(value, fallback) {
    if (value === undefined || value === null || value === "")
        return fallback;
    const pin = Number(value);
    return Number.isInteger(pin) && pin >= 0 ? pin : fallback;
}

class JoystickNode extends Node {
    #buffer = new Uint8Array(3);
    #options = null;
    #i2c = null;

    onStart(config) {
        super.onStart(config);

        /*
         * device.I2C.default describes the board's bus (io constructor, data
         * and clock pins); it is not an open bus. The SDA / SCL pins set in
         * the editor take precedence over its pins.
         */
        const bus = globalThis.device?.I2C?.default;
        if (!bus?.io) {
            this.status({ fill: "red", shape: "ring", text: "no I2C support" });
            this.error("no I2C bus on this board");
            return;
        }

        this.#options = {
            ...bus,
            data: pinOrDefault(config.sdaPin, bus.data),
            clock: pinOrDefault(config.sclPin, bus.clock),
            address: JOYSTICK_I2C_ADDRESS,
            hz: I2C_HZ
        };
        this.status({ fill: "green", shape: "dot", text: "ready" });
    }

    onMessage(msg, done) {
        if (!this.#options) {
            done?.();
            return;
        }

        try {
            this.#i2c ??= new this.#options.io(this.#options);
            this.#i2c.read(this.#buffer);   // throws when the unit does not answer
        } catch (e) {
            /* Closed so that the next message opens the bus again */
            this.#i2c?.close();
            this.#i2c = null;
            this.status({ fill: "red", shape: "ring", text: "device disconnected" });
            this.error(`Joystick read error: ${e.message}`, msg);
            return;
        }

        const [x, y, buttonPressed] = this.#buffer;
        this.status({ fill: "green", shape: "dot", text: `x:${x}, y:${y}, btn:${buttonPressed ? "pressed" : "released"}` });

        this.send([
            { payload: x },
            { payload: y },
            { payload: buttonPressed }
        ]);
        done?.();
    }

    static type = "mcu_joystick"
    static {
        RED.nodes.registerType(this.type, this)
    }
}
