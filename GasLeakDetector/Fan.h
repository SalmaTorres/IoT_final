#ifndef FAN_H
#define FAN_H

#include <Arduino.h>

class Fan {
  private:
    uint8_t pin;
    String state;  
  public:
    Fan(uint8_t pin);
    void turnOn();
    void turnOff();
    String getState();
};

#endif