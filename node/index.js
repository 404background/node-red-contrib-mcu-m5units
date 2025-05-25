const joystickNode = require('./joystick/joystick');
const colorNode = require('./color/color');

module.exports = function(RED) {
    // Register nodes for Node-RED environment
    if (typeof joystickNode === 'function') {
        joystickNode(RED);
    }
    if (typeof colorNode === 'function') {
        colorNode(RED);
    }
    
    // Additional nodes will be added here as the project grows
};
