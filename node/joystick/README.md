# Joystick Node

A Node-RED MCU node for interfacing with the M5Stack Joystick Unit.

![M5Stack Joystick Unit](https://raw.githubusercontent.com/404background/node-red-contrib-mcu-m5units/main/images/joystick.jpg)

## Description

The Joystick node allows you to read data from an M5Stack Joystick Unit connected via I2C. It provides three outputs:
- X-axis value
- Y-axis value
- Button state (pressed/released)

The node communicates with the joystick unit through the I2C protocol and can be triggered by incoming messages.

## Hardware Requirements

- M5Stack Joystick Unit
- ESP32 or other compatible microcontroller running Node-RED MCU
- I2C connection (default SDA pin: 21, SCL pin: 22)

## Configuration

| Parameter | Description |
|-----------|-------------|
| Name      | Optional name for the node instance |
| SDA Pin   | Data pin for I2C communication (default: 21) |
| SCL Pin   | Clock pin for I2C communication (default: 22) |

## Outputs

The node has three outputs:

1. **X Axis**: Provides the X-axis value (0-255)
2. **Y Axis**: Provides the Y-axis value (0-255)
3. **Button**: Provides the button state (1 when pressed, 0 when released)

## Status Indicators

The node displays its current status through the following indicators:

- **Green dot with "ready"**: Node is initialized and ready to read joystick data
- **Green dot with values**: Shows the current X, Y, and button values
- **Red dot with "no I2C support"**: The device does not support I2C communication
- **Red dot with "read error"**: An error occurred while reading from the joystick

## Usage Example

1. Connect your M5Stack Joystick Unit to your microcontroller (default pins: SDA=21, SCL=22)
2. Add the Joystick node to your flow
3. Configure the SDA and SCL pins if necessary
4. Connect an inject node to trigger readings
5. Connect debug nodes to each output to see the X-axis, Y-axis, and button values

## Technical Details

- The joystick unit is accessed at I2C address 0x52
- The node reads 3 bytes from the device:
  - Byte 0: X-axis value (0-255)
  - Byte 1: Y-axis value (0-255)
  - Byte 2: Button state (1 when pressed, 0 when released)

## Localization

This node supports the following languages:
- English (en-US)
- Japanese (ja)

## Demonstration

See the Joystick node in action in this video:

[![Joystick Node Demo](https://img.youtube.com/vi/Ndb2MqFHdD8/0.jpg)](https://youtu.be/Ndb2MqFHdD8)
