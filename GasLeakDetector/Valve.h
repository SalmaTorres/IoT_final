#ifndef VALVE_H
#define VALVE_H

#include <Arduino.h>
#include <ESP32Servo.h>

class Valve {
  private:
    uint8_t pin;
    Servo servo;
    String state; 

  public:
    Valve(uint8_t pin);
    void open(); 
    void close(); 
    String getState();
};

#endif