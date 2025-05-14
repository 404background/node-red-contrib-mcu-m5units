// Load the joystick node
const joystickNode = require('./joystick/joystick');

module.exports = function(RED) {
    // Register the joystick node
    joystickNode(RED);
    
    // Additional nodes will be added here as the project grows
};
