module.exports = function(RED) {
    function ColorNode(config) {
        RED.nodes.createNode(this, config);
    }
    
    RED.nodes.registerType("mcu_color", ColorNode);
};
