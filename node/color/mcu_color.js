import { Node } from "nodered";
import Timer from "timer";

const COLOR_I2C_ADDRESS = 0x29;
const COMMAND_BIT = 0x80;
const AUTO_INCREMENT = 0x20;
const REG_ENABLE = 0x00;
const REG_ATIME = 0x01;
const REG_CONTROL = 0x0F;
const REG_ID = 0x12;
const REG_CDATAL = 0x14;
const ENABLE_PON = 0x01;
const ENABLE_AEN = 0x02;
const POWER_ON_DELAY_MS = 3;    // datasheet: 2.4 ms after PON before AEN
const DEFAULT_INTEGRATION_MS = 154;
const DEFAULT_GAIN = "16x";
const GAIN_REGISTER = {
    "1x": 0x00,
    "4x": 0x01,
    "16x": 0x02,
    "60x": 0x03
};

/*
 * Status texts are locale keys: node-red-mcu-plugin relays the status to the
 * editor, which translates it in the node's namespace.
 */
const STATUS = {
    ready: "mcu_color.status.ready",
    noI2C: "mcu_color.status.no-i2c-support",
    initFailed: "mcu_color.status.sensor-init-failed",
    readError: "mcu_color.status.read-error"
};

class ColorNode extends Node {
    #bus = null;
    #integrationMs = DEFAULT_INTEGRATION_MS;
    #gain = DEFAULT_GAIN;
    #outputs = null;
    #singleOutput = null;
    #address = COLOR_I2C_ADDRESS;
    #buffer = new Uint8Array(8);

    onStart(config) {
        super.onStart(config);
        this.#integrationMs = this.#parseIntegration(config.integrationTime);
        this.#gain = this.#parseGain(config.gain);
        this.#address = this.#parseAddress(config.i2cAddress);
        this.#configureOutputs(config);

        /*
         * device.I2C.default describes the bus (io constructor, data and
         * clock pins); it is not an open bus. The sensor is reached through an
         * SMBus opened on those pins.
         */
        const SMBus = globalThis.device?.io?.SMBus;
        const pins = globalThis.device?.I2C?.default;
        if (!SMBus || !pins) {
            this.status({ fill: "red", shape: "ring", text: STATUS.noI2C });
            this.error("no I2C bus on this board");
            return;
        }

        try {
            this.#bus = new SMBus({ ...pins, address: this.#address });
            this.#enableSensor();
        } catch (e) {
            this.#bus?.close();
            this.#bus = null;
            this.status({ fill: "red", shape: "ring", text: STATUS.initFailed });
            this.error(`Color unit not found at 0x${this.#address.toString(16)}: ${e.message}`);
            return;
        }

        this.status({ fill: "green", shape: "dot", text: STATUS.ready });
    }

    onMessage(msg, done) {
        if (!this.#bus) {
            done?.();
            return;
        }

        let reading;
        try {
            reading = this.#readColor();
        } catch (e) {
            this.status({ fill: "red", shape: "ring", text: STATUS.readError });
            this.error(e.message, msg);
            return;
        }

        msg.payload = this.#composePayload(this.#buildValueMap(reading));
        this.status({
            fill: "green",
            shape: "dot",
            text: `r:${this.#shortenValue(reading.red)} g:${this.#shortenValue(reading.green)} b:${this.#shortenValue(reading.blue)}`
        });
        this.send(msg);
        done?.();
    }

    /* Throws when the sensor does not answer (NACK) */
    #enableSensor() {
        const bus = this.#bus;
        bus.readUint8(COMMAND_BIT | REG_ID);
        bus.writeUint8(COMMAND_BIT | REG_ATIME, this.#integrationToRegister(this.#integrationMs));
        bus.writeUint8(COMMAND_BIT | REG_CONTROL, GAIN_REGISTER[this.#gain] ?? GAIN_REGISTER[DEFAULT_GAIN]);
        bus.writeUint8(COMMAND_BIT | REG_ENABLE, ENABLE_PON);
        Timer.delay(POWER_ON_DELAY_MS);
        bus.writeUint8(COMMAND_BIT | REG_ENABLE, ENABLE_PON | ENABLE_AEN);
    }

    #readColor() {
        const bytes = this.#buffer;
        this.#bus.readBuffer(COMMAND_BIT | AUTO_INCREMENT | REG_CDATAL, bytes);

        const clear = (bytes[1] << 8) | bytes[0];
        const red = (bytes[3] << 8) | bytes[2];
        const green = (bytes[5] << 8) | bytes[4];
        const blue = (bytes[7] << 8) | bytes[6];

        const lux = this.#calculateLux(red, green, blue);
        const colorTemperature = this.#calculateColorTemperature(red, green, blue);

        return { clear, red, green, blue, lux, colorTemperature };
    }

    #integrationToRegister(ms) {
        const value = 256 - Math.round(this.#clamp(ms, 2, 700) / 2.4);
        return this.#clamp(value, 0, 255);
    }

    #calculateLux(r, g, b) {
        return Math.max(0, (-0.32466 * r) + (1.57837 * g) + (-0.73191 * b));
    }

    #calculateColorTemperature(r, g, b) {
        const X = (-0.14282 * r) + (1.54924 * g) + (-0.95641 * b);
        const Y = (-0.32466 * r) + (1.57837 * g) + (-0.73191 * b);
        const Z = (-0.68202 * r) + (0.77073 * g) + (0.56332 * b);
        const denom = X + Y + Z;

        if (denom <= 0) {
            return NaN;
        }

        const xc = X / denom;
        const yc = Y / denom;
        const n = (xc - 0.3320) / (0.1858 - yc);

        return (449 * (n ** 3)) + (3525 * (n ** 2)) + (6823.3 * n) + 5520.33;
    }

    #parseIntegration(value) {
        const parsed = parseInt(value ?? DEFAULT_INTEGRATION_MS, 10);
        if (Number.isFinite(parsed) && parsed >= 2 && parsed <= 700) {
            return parsed;
        }
        return DEFAULT_INTEGRATION_MS;
    }

    #parseGain(value) {
        if (typeof value === "string" && GAIN_REGISTER[value]) {
            return value;
        }
        return DEFAULT_GAIN;
    }

    #clamp(value, min, max) {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }

    #shortenValue(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        if (value > 9999) {
            return 9999;
        }
        return Math.round(value);
    }

    #configureOutputs(config) {
        const available = [
            { key: "red", prop: "includeRed" },
            { key: "green", prop: "includeGreen" },
            { key: "blue", prop: "includeBlue" },
            { key: "clear", prop: "includeClear" },
            { key: "colorTemperature", prop: "includeCct" },
            { key: "lux", prop: "includeLux" }
        ];

        const selected = available.filter(({ prop }) => this.#parseBoolean(config?.[prop])).map(({ key }) => key);

        if (selected.length === 0) {
            this.#outputs = available.map(({ key }) => key);
        } else {
            this.#outputs = selected;
        }

        this.#singleOutput = this.#outputs.length === 1 ? this.#outputs[0] : null;
    }

    #parseBoolean(value) {
        if (value === undefined || value === null) {
            return false;
        }
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "number") {
            return value !== 0;
        }
        if (typeof value === "string") {
            const lower = value.toLowerCase();
            return lower === "true" || lower === "on" || lower === "checked";
        }
        return false;
    }

    #buildValueMap(reading) {
        const colorTemperature = Number.isFinite(reading.colorTemperature) ? reading.colorTemperature : null;
        const lux = Number.isFinite(reading.lux) ? reading.lux : null;

        return {
            red: reading.red,
            green: reading.green,
            blue: reading.blue,
            clear: reading.clear,
            colorTemperature,
            lux
        };
    }

    #composePayload(values) {
        if (this.#singleOutput) {
            return values[this.#singleOutput];
        }

        const payload = {};
        for (const key of this.#outputs) {
            payload[key] = values[key];
        }
        return payload;
    }

    #parseAddress(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return this.#clamp(Math.trunc(value), 0, 0x7F);
        }

        if (typeof value === "string" && value.trim().length > 0) {
            const trimmed = value.trim();
            let parsed = Number.NaN;

            if (/^0x[0-9a-f]+$/i.test(trimmed)) {
                parsed = parseInt(trimmed, 16);
            } else if (/^[0-9]+$/.test(trimmed)) {
                parsed = parseInt(trimmed, 10);
            }

            if (Number.isFinite(parsed)) {
                return this.#clamp(parsed, 0, 0x7F);
            }
        }

        return COLOR_I2C_ADDRESS;
    }

    static type = "mcu_color";
    static {
        RED.nodes.registerType(this.type, this);
    }
}
