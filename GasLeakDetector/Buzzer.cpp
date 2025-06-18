#include "Buzzer.h"

Buzzer::Buzzer(uint8_t pin) {
  this->pin = pin;
  state = "off";
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);  
}

void Buzzer::turnOn() {
  digitalWrite(pin, HIGH);
  state = "on";
}

void Buzzer::turnOff() {
  digitalWrite(pin, LOW);
  state = "off";
}

String Buzzer::getState() {
  return state;
}