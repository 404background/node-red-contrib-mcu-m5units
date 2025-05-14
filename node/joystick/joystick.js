module.exports = function(RED) {
    "use strict";
      function JoystickNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        this.interval = parseInt(config.interval || 100, 10);
        
        // Processing in Node-RED MCU environment
        if (RED.device) {
            // Display initialization status
            node.status({fill:"blue", shape:"dot", text:"initializing..."});
            
            // Simple display of status information from MCU
            node.on("input", function(msg) {
                // Forward received messages to the device to trigger reading
                // This allows manual polling of the joystick
                
                // Handle special status messages
                if (msg && msg._status) {
                    // Error state
                    if (msg._status.error) {
                        // Show more descriptive error status
                        const errorText = msg._status.error.includes("read failed") ? 
                            "I2C read error" : msg._status.error;
                        node.status({fill:"red", shape:"dot", text: errorText});
                        
                        // Auto-recovery after some time
                        setTimeout(() => {
                            node.status({fill:"yellow", shape:"ring", text:"retrying..."});
                        }, 2000);
                    } 
                    // Initialization complete
                    else if (msg._status.initialized) {
                        node.status({fill:"green", shape:"dot", text:"ready"});
                    }
                    // Joystick values
                    else if (msg._status.x !== undefined) {
                        // Display raw X/Y values (0-255)
                        const x = msg._status.x;
                        const y = msg._status.y;
                        const btn = msg._status.btn ? "ON" : "OFF";
                        node.status({fill:"green", shape:"dot", text:`x:${x} y:${y} btn:${btn}`});
                    }
                }
            });
            return;
        }
          // Notification that it's not implemented in regular Node-RED environment
        node.status({fill:"yellow", shape:"ring", text:"not supported in node-red"});
        node.warn("This node is only supported in Node-RED MCU environment");
        node.on('close', function() {
            // Cleanup process (nothing to do)
        });
    }
    
    // Register the node
    RED.nodes.registerType("mcu_joystick", JoystickNode);
};
