import { Node } from "nodered"

/**
 * M5Stack Joystick Module Node
 * 
 * M5Stack Joystick Specifications:
 * - I2C Address: 0x52 (fixed)
 * - X-axis: Register 0x10, value range 0-255 (center 127)
 * - Y-axis: Register 0x11, value range 0-255 (center 127)
 * - Button: Register 0x20, value 0(pressed) or 1(released)
 * - Documentation: https://docs.m5stack.com/en/unit/joystick
 */

// M5Stack Joystick constants
const JOYSTICK_I2C_ADDRESS = 0x52;  // Fixed I2C address
const DEFAULT_VALUE = 127;          // Center position (mid-point of 0-255)
const BUTTON_RELEASED = 1;          // Button released value
const BUTTON_PRESSED = 0;           // Button pressed value

// I2C instance cache (shared between multiple nodes)
let i2cCache = null;

class JoystickNode extends Node {
    // Private variables
    #i2c = null;                     // I2C instance
    #interval = 100;                 // Polling interval (ms)
    #timer = null;                   // Timer ID
    
    onStart(config) {
        super.onStart(config);
        
        // Parse configuration values
        this.#interval = parseInt(config.interval || 100, 10);
        
        // I2C initialization - simple implementation
        this.#i2c = this.#initializeI2C();
        if (!this.#i2c) {
            // No I2C support case
            this.send([{ payload: null, _status: { error: "no-i2c-support" } }, null, null]);
            return;
        }
        
        // Set up periodic value reading
        this.#timer = Timer.repeat(() => this.#readValues(), this.#interval);
        
        // Initialization complete notification
        this.send([{ payload: null, _status: { initialized: true } }, null, null]);
    }
      // I2C initialization process (simplified)
    #initializeI2C() {
        // Reuse cache if available
        if (i2cCache) return i2cCache;
        
        // Use default I2C configuration
        if (device.I2C?.default) {
            i2cCache = device.I2C.default;
        } else if (typeof device.i2c === "object") {
            i2cCache = device.i2c;
        } else {
            trace("No I2C support available\n");
            return null;
        }
        
        return i2cCache;
    }
    
    onStop() {
        // Clear the timer
        if (this.#timer) {
            Timer.clear(this.#timer);
            this.#timer = null;
        }
    }
      // Read joystick values (simplified)
    #readValues() {
        if (!this.#i2c) return;
        
        // Read values from M5Stack Joystick module
        const values = this.#readI2CValues();
        
        // Get values and apply defaults
        const rawX = values.x !== undefined ? values.x : DEFAULT_VALUE;
        const rawY = values.y !== undefined ? values.y : DEFAULT_VALUE;
        const btnState = values.button !== undefined ? values.button : BUTTON_RELEASED;
        
        // Button state (convert to boolean for easier use)
        const btnPressed = btnState === BUTTON_PRESSED;
        
        // Create output messages with raw values
        const msgs = [
            { 
                payload: rawX,
                _status: { x: rawX, y: rawY, btn: btnPressed }
            },
            { payload: rawY },
            { payload: btnPressed }
        ];
        
        // Send messages
        this.send(msgs);
    }
      /**
     * Read data directly from M5Stack Joystick module
     * According to M5Stack docs, reading from address 0x52 returns 
     * 3 bytes array with [X value, Y value, Button status]
     * @returns {{x: number, y: number, button: number}} Read values
     */
    #readI2CValues() {
        // Result object
        const result = {
            x: DEFAULT_VALUE,
            y: DEFAULT_VALUE,
            button: BUTTON_RELEASED
        };
        
        // Use readBytes function if it's available
        if (typeof this.#i2c.readBytes === "function") {
            // Read all 3 bytes at once from address 0x52
            const data = this.#i2c.readBytes(JOYSTICK_I2C_ADDRESS, 0, 3);
            if (data && data.length === 3) {
                result.x = data[0];
                result.y = data[1];
                result.button = data[2];
            }
        }
        
        return result;
    }
    
    static type = "mcu_joystick"
    static {
        RED.nodes.registerType(this.type, this)
    }
}
