// Load the joystick node
const joystickNode = require('./joystick/mcu_joystick');

module.exports = function(RED) {
    // No need to register the node here as it's now handled by the static block in the node itself
    // The module might be loaded in both environments (Node-RED host and MCU)
    
    // For compatibility with the Node-RED environment, check if we need to register
    if (typeof joystickNode === 'function') {
        joystickNode(RED);
    }
    
    // Additional nodes will be added here as the project grows
};
