import { Node } from "nodered";

const COLOR_I2C_ADDRESS = 0x29;
const COMMAND_BIT = 0x80;
const AUTO_INCREMENT = 0x20;
const REG_ENABLE = 0x00;
const REG_ATIME = 0x01;
const REG_CONTROL = 0x0F;
const REG_CDATAL = 0x14;
const ENABLE_PON = 0x01;
const ENABLE_AEN = 0x02;
const DEFAULT_INTEGRATION_MS = 154;
const DEFAULT_GAIN = "16x";
const GAIN_REGISTER = {
    "1x": 0x00,
    "4x": 0x01,
    "16x": 0x02,
    "60x": 0x03
};

let i2cCache = null;

class ColorNode extends Node {
    #i2c = null;
    #integrationMs = DEFAULT_INTEGRATION_MS;
    #gain = DEFAULT_GAIN;
    #inputListener = null;
    #outputs = null;
    #singleOutput = null;
    #address = COLOR_I2C_ADDRESS;

    onStart(config) {
        super.onStart(config);
        this.#integrationMs = this.#parseIntegration(config.integrationTime);
        this.#gain = this.#parseGain(config.gain);
        this.#address = this.#parseAddress(config.i2cAddress);
        this.#configureOutputs(config);

        this.#i2c = this.#initializeI2C();
        if (!this.#i2c) {
            this.send([{ payload: null, _status: { error: "no-i2c-support" } }]);
            return;
        }

        if (!this.#enableSensor()) {
            this.send([{ payload: null, _status: { error: "sensor-init-failed" } }]);
            return;
        }

        if (typeof this.on === "function") {
            this.#inputListener = msg => this.#handleInput(msg);
            this.on("input", this.#inputListener);
        }

        this.send([{ payload: null, _status: { initialized: true } }]);
    }

    onStop() {
        if (this.#inputListener) {
            if (typeof this.off === "function") {
                this.off("input", this.#inputListener);
            } else if (typeof this.removeListener === "function") {
                this.removeListener("input", this.#inputListener);
            }
            this.#inputListener = null;
        }
        this.#disableSensor();
    }

    onMessage(msg) {
        this.#handleInput(msg);
    }

    #handleInput(msg) {
        void msg;
        if (!this.#i2c) {
            this.send([{ payload: null, _status: { error: "no-i2c-support" } }]);
            return;
        }

        const reading = this.#readColor();
        if (!reading) {
            this.send([{ payload: null, _status: { error: "read-error" } }]);
            return;
        }

        const values = this.#buildValueMap(reading);
        const payload = this.#composePayload(values);

        const status = {
            last: {
                r: this.#shortenValue(reading.red),
                g: this.#shortenValue(reading.green),
                b: this.#shortenValue(reading.blue)
            }
        };

        this.send([{ payload, _status: status }]);
    }

    #initializeI2C() {
        if (i2cCache) {
            return i2cCache;
        }

        try {
            if (typeof device === "undefined") {
                return null;
            }
            if (device.I2C?.default) {
                i2cCache = device.I2C.default;
            } else if (typeof device.i2c === "object") {
                i2cCache = device.i2c;
            }
        } catch (error) {
            void error;
            i2cCache = null;
        }

        return i2cCache;
    }

    #enableSensor() {
        const atime = this.#integrationToRegister(this.#integrationMs);
        const gainValue = GAIN_REGISTER[this.#gain] ?? GAIN_REGISTER[DEFAULT_GAIN];

        if (!this.#writeRegister(REG_ENABLE, ENABLE_PON)) {
            return false;
        }

        if (!this.#writeRegister(REG_ENABLE, ENABLE_PON | ENABLE_AEN)) {
            return false;
        }

        if (!this.#writeRegister(REG_ATIME, atime)) {
            return false;
        }

        if (!this.#writeRegister(REG_CONTROL, gainValue)) {
            return false;
        }

        return true;
    }

    #disableSensor() {
        this.#writeRegister(REG_ENABLE, 0x00);
    }

    #readColor() {
        const bytes = this.#readRegisters(REG_CDATAL, 8);
        if (!bytes || bytes.length < 8) {
            return null;
        }

        const clear = (bytes[1] << 8) | bytes[0];
        const red = (bytes[3] << 8) | bytes[2];
        const green = (bytes[5] << 8) | bytes[4];
        const blue = (bytes[7] << 8) | bytes[6];

        const lux = this.#calculateLux(red, green, blue);
        const colorTemperature = this.#calculateColorTemperature(red, green, blue);

        return { clear, red, green, blue, lux, colorTemperature };
    }

    #writeRegister(register, value) {
        if (!this.#i2c) {
            return false;
        }

        const reg = COMMAND_BIT | register;

        try {
            const address = this.#address;

            if (typeof this.#i2c.writeByte === "function") {
                this.#i2c.writeByte(address, reg, value);
                return true;
            }

            if (typeof this.#i2c.writeBytes === "function") {
                this.#i2c.writeBytes(address, reg, [value]);
                return true;
            }

            if (typeof this.#i2c.write === "function") {
                this.#i2c.write(address, [reg, value]);
                return true;
            }
        } catch (error) {
            void error;
        }

        return false;
    }

    #readRegisters(register, length) {
        if (!this.#i2c) {
            return null;
        }

        const reg = COMMAND_BIT | AUTO_INCREMENT | register;

        try {
            const address = this.#address;

            if (typeof this.#i2c.readBytes === "function") {
                return this.#normalizeBytes(this.#i2c.readBytes(address, reg, length));
            }

            if (typeof this.#i2c.read === "function") {
                return this.#normalizeBytes(this.#i2c.read(address, reg, length));
            }
        } catch (error) {
            void error;
        }

        return null;
    }

    #normalizeBytes(value) {
        if (!value) {
            return null;
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (value instanceof Uint8Array) {
            return Array.from(value);
        }

        if (value.buffer instanceof ArrayBuffer) {
            return Array.from(new Uint8Array(value.buffer));
        }

        return null;
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
