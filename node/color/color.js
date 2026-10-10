module.exports = function(RED) {
    "use strict";
    function ColorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        if (RED.device) {
            const statusText = function(key) {
                return node._("mcu_color.status." + key) || key;
            };

            node.status({ fill: "blue", shape: "ring", text: statusText("waiting") });

            node.on("input", function(msg) {
                if (msg && msg._status) {
                    const status = msg._status;
                    if (status.error) {
                        const text = statusText(status.error) || status.error;
                        node.status({ fill: "red", shape: "dot", text });
                    } else if (status.initialized) {
                        node.status({ fill: "green", shape: "dot", text: statusText("ready") });
                    } else if (status.last) {
                        const last = status.last;
                        node.status({ fill: "green", shape: "dot", text: `r:${last.r} g:${last.g} b:${last.b}` });
                    }
                    return;
                }

                node.status({ fill: "blue", shape: "dot", text: statusText("requesting") });
            });
            return;
        }

        node.status({ fill: "yellow", shape: "ring", text: "not supported in node-red" });
        node.warn("This node is only supported in Node-RED MCU environment");
    }

    RED.nodes.registerType("mcu_color", ColorNode);
};
