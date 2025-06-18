#include "Valve.h"

Valve::Valve(uint8_t pin) {
  this->pin = pin;
  state = "closed";
  servo.setPeriodHertz(50);
}

void Valve::open() {
  servo.attach(pin, 1000, 2000);
  servo.writeMicroseconds(1700);
  delay(700);
  servo.detach();
  state = "open";
}

void Valve::close() {
  servo.attach(pin, 1000, 2000);
  servo.writeMicroseconds(1300);
  delay(700);
  servo.detach();
  state = "closed";
}

String Valve::getState() {
  return state;
}