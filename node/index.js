// Load node definitions
const joystickNode = require('./joystick/joystick');
const colorNode = require('./color/color');

module.exports = function(RED) {
    // Register the joystick node
    joystickNode(RED);
    // Register the color node
    colorNode(RED);
    
    // Additional nodes will be added here as the project grows
};
