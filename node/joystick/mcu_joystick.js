import { Node } from "nodered"

const JOYSTICK_I2C_ADDRESS = 0x52;
const BUTTON_PRESSED = 1;
let i2cCache = null;

class JoystickNode extends Node {
    #i2c = null;
    #i2cInstance = null;
    
    onStart(config) {
        super.onStart(config);
        
        try {
            this.#i2c = this.#initializeI2C();
            if (!this.#i2c) {
                this.status({fill: "red", shape: "dot", text: "no I2C support"});
                this.send([{ payload: null }, null, null]);
                return;
            }
            
            this.status({fill: "green", shape: "dot", text: "ready"});
            this.send([{ payload: null }, null, null]);
        } catch (e) {
            this.status({fill: "red", shape: "dot", text: "error"});
            this.send([{ payload: null }, null, null]);
        }
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
            this.#readJoystick();
        } catch (e) {
            this.status({fill: "red", shape: "dot", text: "read error"});
            this.send([{ payload: null }, null, null]);
        }
        
        if (done) done();
    }
    
    #readJoystick() {
        if (!this.#i2c) return;
        
        try {
            if (!this.#i2cInstance) {
                const i2cOptions = {
                    data: Number(this.#i2c.data) || 21,
                    clock: Number(this.#i2c.clock) || 22,
                    address: JOYSTICK_I2C_ADDRESS,
                    hz: 100000
                };
                this.#i2cInstance = new this.#i2c.io(i2cOptions);
            }
            
            const buffer = new Uint8Array(3);
            this.#i2cInstance.read(buffer.buffer);
            
            const x = buffer[0];
            const y = buffer[1]; 
            const buttonPressed = buffer[2];
            this.status({fill: "green", shape: "dot", text: `x:${x}, y:${y}, btn:${buttonPressed ? 'pressed' : 'released'}`});
            
            this.send([
                { payload: x },
                { payload: y },
                { payload: buttonPressed }
            ]);
        } catch (e) {
            if (this.#i2cInstance && typeof this.#i2cInstance.close === "function") {
                try {
                    this.#i2cInstance.close();
                } catch (err) {
                }
            }
            this.#i2cInstance = null;
            
            console.error(`Joystick read error: ${e.message}`);
            throw e;
        }
    }
    
    onStop() {
        if (this.#i2cInstance && typeof this.#i2cInstance.close === "function") {
            this.#i2cInstance.close();
        }
        this.#i2cInstance = null;
    }
    
    static type = "mcu_joystick"
    static {
        RED.nodes.registerType(this.type, this)
    }
}
