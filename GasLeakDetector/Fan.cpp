#include "Fan.h"

Fan::Fan(uint8_t pin) {
  this->pin = pin;
  state = "off";
  pinMode(pin, OUTPUT);
  digitalWrite(pin, HIGH);  
}

void Fan::turnOn() {  
  digitalWrite(pin, LOW);
  state = "on";
}

void Fan::turnOff() {
  digitalWrite(pin, HIGH);
  state = "off";
}

String Fan::getState() {
  return state;
}