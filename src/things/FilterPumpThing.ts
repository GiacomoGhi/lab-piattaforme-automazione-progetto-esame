/**
 * FilterPumpThing - Modbus Proxy for aquarium filter pump.
 *
 * This Thing acts as an HTTP proxy to a Modbus device.
 * It exposes pumpSpeed and filterStatus properties via HTTP,
 * while communicating with the actual pump via Modbus protocol.
 *
 * Modbus Registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger)
 */
