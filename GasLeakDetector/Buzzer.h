#ifndef BUZZER_H
#define BUZZER_H

#include <Arduino.h>

class Buzzer {
private:
  uint8_t pin;
  String state;

public:
  Buzzer(uint8_t pin);
  void turnOn();
  void turnOff();
  String getState();
};

#endif