# node-red-contrib-mcu-m5units

Node-RED nodes to use M5Stack Units with Node-RED MCU.

## About

This package provides Node-RED nodes for integrating M5Stack Units with Node-RED MCU. It allows you to easily use various M5Stack sensors and modules within your Node-RED flows when using the MCU feature.

## Installation

Install via npm:

```bash
npm install node-red-contrib-mcu-m5units
```

Or install directly from the Node-RED palette manager.

## Features

- Simple integration of M5Stack Units with Node-RED
- Support for various M5Stack sensors and modules
- Easy-to-use node interface
- Full localization support

## Supported Units

- Joystick - Read analog joystick input (X, Y axes and button press)

## Usage

1. Install the package
2. Add the desired M5Stack unit node to your flow
3. Configure the node settings
4. Connect to other nodes in your flow

## Examples

Example flows are provided in the `examples/` directory.

## Project Structure

The project follows the structure recommended in the node creation guidelines:

```
node-red-contrib-mcu-m5units/  
├── README.md                # This document  
├── package.json             # Package settings  
├── node/                    # Node implementation directory  
│   ├── <unit-name>/         # Each M5Stack unit has its own folder  
│   │   ├── <unit-name>.js   # Runtime implementation  
│   │   ├── <unit-name>.html # Editor UI definition  
│   │   └── locales/         # i18n dictionaries  
│   └── index.js             # Entry point for registering all nodes  
├── manifest.json            # Required configuration for MCU nodes  
└── examples/                # Sample flows (JSON)  
```
