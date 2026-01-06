/**
 * Mock Modbus Server for Filter Pump
 *
 * Registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to start cleaning cycle)
 */
