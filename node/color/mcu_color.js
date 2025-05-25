import { Node } from "nodered"

const COLOR_I2C_ADDRESS = 0x29;
let i2cCache = null;

class ColorNode extends Node {
    #buffer = new Uint8Array(8);
    #probeBuffer = new ArrayBuffer(0);
    #writeBuffer = new Uint8Array(2);
    #i2c = null;    #i2cInstance = null;
    #initialized = false;
    
    onStart(config) {
        super.onStart(config);
        
        this.#i2c = this.#initializeI2C();
        if (!this.#i2c) {
            this.status({fill: "red", shape: "dot", text: "no I2C support"});
            this.send([null, null, null, null]);
            return;
        }
        
        this.status({fill: "green", shape: "dot", text: "ready"});
    }
    
    #initializeI2C() {
        if (i2cCache) return i2cCache;
        
        try {
            if (globalThis.device?.I2C?.default) {
                i2cCache = globalThis.device.I2C.default;
                return i2cCache;
            }
            return null;
        } catch (e) {
            console.error("I2C initialization error:", e);
            return null;
        }
    }

    onMessage(msg, done) {
        try {
            this.#readColor();
        } catch (e) {
            this.status({fill: "red", shape: "dot", text: "read error"});
            this.send([null, null, null, null]);
        }
        done?.();
    }
    
    #initializeSensor() {
        if (!this.#i2cInstance) return false;
        
        try {
            // Enable power on
            this.#writeBuffer[0] = 0x80; // TCS3472_COMMAND_BIT
            this.#writeBuffer[1] = 0x01; // TCS3472_ENABLE_PON
            this.#i2cInstance.write(this.#writeBuffer);
            
            // Wait for power on
            globalThis.Timer?.delay(10);
            
            // Enable RGBC
            this.#writeBuffer[0] = 0x80; // TCS3472_COMMAND_BIT
            this.#writeBuffer[1] = 0x03; // TCS3472_ENABLE_PON | TCS3472_ENABLE_AEN
            this.#i2cInstance.write(this.#writeBuffer);
            
            // Set integration time (154ms)
            this.#writeBuffer[0] = 0x81; // TCS3472_COMMAND_BIT | TCS3472_ATIME
            this.#writeBuffer[1] = 0xC0; // 154ms
            this.#i2cInstance.write(this.#writeBuffer);
            
            // Set gain (4x)
            this.#writeBuffer[0] = 0x8F; // TCS3472_COMMAND_BIT | TCS3472_CONTROL
            this.#writeBuffer[1] = 0x01; // 4x gain
            this.#i2cInstance.write(this.#writeBuffer);
            
            this.#initialized = true;
            return true;
        } catch (e) {
            console.error("Sensor initialization error:", e);
            this.#initialized = false;
            return false;
        }
    }

    #calibrateRGB(red, green, blue) {
        // Get calibration values from config
        const redBlack = Number(this.redBlack) || 0;
        const greenBlack = Number(this.greenBlack) || 0;
        const blueBlack = Number(this.blueBlack) || 0;
        const redWhite = Number(this.redWhite) || 65535;
        const greenWhite = Number(this.greenWhite) || 65535;
        const blueWhite = Number(this.blueWhite) || 65535;
        
        // Avoid division by zero and calculate calibrated values directly
        if (redWhite <= redBlack || greenWhite <= greenBlack || blueWhite <= blueBlack) {
            // Return uncalibrated normalized values
            return {
                r: Math.min(255, Math.max(0, Math.round((red / 65535) * 255))),
                g: Math.min(255, Math.max(0, Math.round((green / 65535) * 255))),
                b: Math.min(255, Math.max(0, Math.round((blue / 65535) * 255)))
            };
        }
        
        // Calibrate and normalize to 0-255 in one step
        return {
            r: Math.min(255, Math.max(0, Math.round(((red - redBlack) / (redWhite - redBlack)) * 255))),
            g: Math.min(255, Math.max(0, Math.round(((green - greenBlack) / (greenWhite - greenBlack)) * 255))),
            b: Math.min(255, Math.max(0, Math.round(((blue - blueBlack) / (blueWhite - blueBlack)) * 255)))
        };
    }
    
    #readColor() {
        if (!this.#i2c) return;
          if (!this.#i2cInstance) {
                const i2cOptions = {
                    data: Number(this.#i2c.data) ?? 21,
                    clock: Number(this.#i2c.clock) ?? 22,
                    address: COLOR_I2C_ADDRESS,
                    hz: 100000
                };
                this.#i2cInstance = new this.#i2c.io(i2cOptions);
                this.#initialized = false;
            }
            
            // Initialize sensor if needed
            if (!this.#initialized) {
                if (!this.#initializeSensor()) {
                    this.status({fill: "red", shape: "dot", text: "init failed"});
                    this.send([null, null, null, null]);
                    return;
                }
                // Wait for first measurement
                globalThis.Timer?.delay(200);
            }
            
            // Check device connection with probe buffer to suppress xsbug errors
            if (this.#i2cInstance.write(this.#probeBuffer)) {
                this.status({fill: "red", shape: "dot", text: "device disconnected"});
                this.send([null, null, null, null]);
                return;
            }
            
            // Read RGBC data
            this.#writeBuffer[0] = 0x94; // TCS3472_COMMAND_BIT | TCS3472_CDATAL
            this.#i2cInstance.write(this.#writeBuffer.slice(0, 1));
            this.#i2cInstance.read(this.#buffer);
            
            // Convert raw data to 16-bit values
            const clear = (this.#buffer[1] << 8) | this.#buffer[0];
            const red = (this.#buffer[3] << 8) | this.#buffer[2];
            const green = (this.#buffer[5] << 8) | this.#buffer[4];
            const blue = (this.#buffer[7] << 8) | this.#buffer[6];
              // Output based on selected mode
            if (this.outputMode === "rgb") {
                const calibrated = this.#calibrateRGB(red, green, blue);
                const rgbString = `rgb(${calibrated.r},${calibrated.g},${calibrated.b})`;
                
                this.status({fill: "green", shape: "dot", text: `RGB(${calibrated.r},${calibrated.g},${calibrated.b})`});
                
                this.send([
                    { payload: calibrated.r },
                    { payload: calibrated.g },
                    { payload: calibrated.b },
                    { payload: rgbString }
                ]);
            } else {
                this.status({fill: "green", shape: "dot", text: `R:${red}, G:${green}, B:${blue}, C:${clear}`});
                
                this.send([
                    { payload: red },
                    { payload: green },
                    { payload: blue },
                    { payload: clear }
                ]);
            }
    }
    
    onStop() {
        this.#i2cInstance?.close();
        this.#i2cInstance = null;
        this.#initialized = false;
    }
    
    static type = "mcu_color"
    static {
        RED.nodes.registerType(this.type, this)
    }
}
