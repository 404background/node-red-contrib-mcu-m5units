module.exports = function(RED) {
    function JoystickNode(config) {
        RED.nodes.createNode(this, config);
    }
    
    RED.nodes.registerType("mcu_joystick", JoystickNode);
};
