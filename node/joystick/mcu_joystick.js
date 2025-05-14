import { Node } from "nodered"

/**
 * M5Stack Joystick Module Node - Simplified Implementation
 * - I2C Address: 0x52
 */

// M5Stack Joystick constants
const JOYSTICK_I2C_ADDRESS = 0x52;
const BUTTON_PRESSED = 0; // Button returns 0 when pressed, 1 when released

// I2C instance cache
let i2cCache = null;

class JoystickNode extends Node {
    // Private variables
    #i2c = null;
    #i2cInstance = null; // Cache for the direct I2C instance
    
    onStart(config) {
        super.onStart(config);
        
        try {
            // I2C initialization - simpler approach now that we know what works
            this.#i2c = this.#initializeI2C();
            if (!this.#i2c) {
                this.status({fill: "red", shape: "dot", text: "no I2C support"});
                this.send([{ payload: null, _status: { error: "no-i2c-support" } }, null, null]);
                return;
            }
            
            // Initialization complete
            this.status({fill: "green", shape: "dot", text: "ready"});
            this.send([{ payload: null, _status: { initialized: true } }, null, null]);
        } catch (e) {
            this.status({fill: "red", shape: "dot", text: "error"});
            this.send([{ payload: null, _status: { error: e.toString() } }, null, null]);
        }
    }
    
    // Simple I2C initialization
    #initializeI2C() {
        if (i2cCache) return i2cCache;
        
        try {
            // Using the device.I2C.default which is known to work
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
    
    // Handle incoming messages
    onMessage(msg, done) {
        try {
            this.#readJoystick();
        } catch (e) {
            this.status({fill: "red", shape: "dot", text: "read error"});
            this.send([{ payload: null, _status: { error: e.toString() } }, null, null]);
        }
        
        if (done) done();
    }
    
    // Read joystick data and send values - simplified implementation
    #readJoystick() {
        if (!this.#i2c) return;
        
        try {
            // Use the cached instance or create a new one
            if (!this.#i2cInstance) {
                const i2cOptions = {
                    data: this.#i2c.data || 21,
                    clock: this.#i2c.clock || 22,
                    address: JOYSTICK_I2C_ADDRESS,
                    hz: 100000
                };
                this.#i2cInstance = new this.#i2c.io(i2cOptions);
            }
            
            // Read the joystick data using the buffer method which is known to work
            const buffer = new Uint8Array(3);
            this.#i2cInstance.read(buffer.buffer);
            
            const x = buffer[0];
            const y = buffer[1]; 
            // Fix button logic: BUTTON_PRESSED (0) means pressed
            const buttonPressed = buffer[2] === BUTTON_PRESSED;
            
            this.status({fill: "green", shape: "dot", text: `x:${x}, y:${y}, btn:${buttonPressed ? 'pressed' : 'released'}`});
            
            this.send([
                { payload: x, _status: { x, y, btn: buttonPressed } },
                { payload: y },
                { payload: buttonPressed }
            ]);
        } catch (e) {
            // If there was an error, try to clean up the instance
            if (this.#i2cInstance && typeof this.#i2cInstance.close === "function") {
                try {
                    this.#i2cInstance.close();
                } catch (err) {
                    // Ignore close errors
                }
            }
            this.#i2cInstance = null;
            
            console.error(`Joystick read error: ${e.message}`);
            throw e;
        }
    }
    
    // Clean up on node stop
    onStop() {
        if (this.#i2cInstance && typeof this.#i2cInstance.close === "function") {
            try {
                this.#i2cInstance.close();
            } catch (e) {
                // Ignore close errors
            }
        }
        this.#i2cInstance = null;
    }
    
    static type = "mcu_joystick"
    static {
        RED.nodes.registerType(this.type, this)
    }
}
