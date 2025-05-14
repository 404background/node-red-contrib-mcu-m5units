import { Node } from "nodered"

/**
 * M5Stack Joystick Module Node - Ultra-Simplified Implementation
 * - I2C Address: 0x52
 */

// M5Stack Joystick constants
const JOYSTICK_I2C_ADDRESS = 0x52;
const BUTTON_PRESSED = 0;

// I2C instance cache
let i2cCache = null;

class JoystickNode extends Node {
    // Private variables
    #i2c = null;
    
    onStart(config) {
        super.onStart(config);
        
        // I2C initialization
        this.#i2c = this.#initializeI2C();
        if (!this.#i2c) {
            this.send([{ payload: null, _status: { error: "no-i2c-support" } }, null, null]);
            return;
        }
        
        // Initialization complete
        this.send([{ payload: null, _status: { initialized: true } }, null, null]);
    }
    
    // Simple I2C initialization
    #initializeI2C() {
        if (i2cCache) return i2cCache;
        
        if (device.I2C?.default) {
            i2cCache = device.I2C.default;
        } else if (typeof device.i2c === "object") {
            i2cCache = device.i2c;
        } else {
            return null;
        }
        
        return i2cCache;
    }
    
    // Handle incoming messages
    onMessage(msg) {
        this.#readJoystick();
    }
    
    // Read joystick data and send values
    #readJoystick() {
        // if (!this.#i2c || typeof this.#i2c.readBytes !== "function") return;
        
        const data = this.#i2c.readBytes(JOYSTICK_I2C_ADDRESS, 0, 3);
        // if (!data || data.length !== 3) return;
        
        const x = data[0];
        const y = data[1]; 
        const buttonPressed = data[2] === BUTTON_PRESSED;
        
        this.send([
            { payload: x, _status: { x, y, btn: buttonPressed } },
            { payload: y },
            { payload: buttonPressed }
        ]);
    }
    
    static type = "mcu_joystick"
    static {
        RED.nodes.registerType(this.type, this)
    }
}
