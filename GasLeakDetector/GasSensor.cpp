#include "GasSensor.h"

const uint16_t CLEAN_AIR_FACTOR PROGMEM = 983;
const uint8_t CALIBRATION_SAMPLES PROGMEM = 30;
const uint8_t READING_SAMPLES PROGMEM = 3;
const uint16_t LOAD_RESISTANCE PROGMEM = 1000;
const uint16_t ADC_MAX_VALUE PROGMEM = 4095;

const uint16_t LPG_PPM_TABLE[] PROGMEM = {
  0, 10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000, 2000, 5000, 10000
};
const uint16_t LPG_RATIO_TABLE[] PROGMEM = {
  1000, 800, 650, 520, 420, 350, 280, 230, 180, 150, 120, 90, 60, 40, 25, 15
};

GasSensor::GasSensor(uint8_t pin) {
  this->pin = pin;
  safeThreshold = 100;
  warningThreshold = 200; 
  cleanAirResistanceRo = 0;
  calibrated = false;
  ppm = 0;
  gasLevel = "seguro";
}

bool GasSensor::calibrateInCleanAir() {
  uint16_t averageResistance = readAverageResistance(pgm_read_byte(&CALIBRATION_SAMPLES));
  
  if (averageResistance == 0) {
    return false;
  }
  
  cleanAirResistanceRo = (averageResistance * 100) / pgm_read_word(&CLEAN_AIR_FACTOR);
  calibrated = true;
  return true;
}

void GasSensor::calculateGasConcentration() {
  uint16_t currentResistance = readAverageResistance(pgm_read_byte(&READING_SAMPLES));
  if (currentResistance == 0 || !calibrated) {
    ppm = -1;
    gasLevel = "error";
    return;  
  }
  
  uint16_t resistanceRatio = (currentResistance * 100) / cleanAirResistanceRo;
  ppm = convertRatioToPPM(resistanceRatio);
  
  if (ppm < safeThreshold) {
    gasLevel = "seguro";
  } else if (ppm < warningThreshold) {
    gasLevel = "precaucion";
  } else {
    gasLevel = "emergencia";
  }
}

int GasSensor::getPPM(){
  return ppm;
}

String GasSensor::getGasLevel(){
  return gasLevel;
}

bool GasSensor::isCalibrationValid() const {
  return calibrated;
}

uint16_t GasSensor::getCleanAirResistance() const {
  return cleanAirResistanceRo;
}

uint16_t GasSensor::calculateSensorResistance(uint16_t adcValue) {
  if (adcValue == 0) return 0;
  uint16_t loadRes = pgm_read_word(&LOAD_RESISTANCE);
  uint16_t adcMax = pgm_read_word(&ADC_MAX_VALUE);
  return (loadRes * (adcMax - adcValue)) / adcValue;
}

uint16_t GasSensor::readAverageResistance(uint8_t samples) {
  uint32_t adcSum = 0;
  uint8_t validSamples = 0;
  
  for (uint8_t i = 0; i < samples; i++) {
    uint16_t adcReading = analogRead(pin);
    if (adcReading > 0) {
      adcSum += adcReading;
      validSamples++;
    }
    delay(50); 
  }
  
  if (validSamples == 0) return 0;
  
  uint16_t averageADC = adcSum / validSamples;
  return calculateSensorResistance(averageADC);
}

uint16_t GasSensor::convertRatioToPPM(uint16_t ratio) {
  if (ratio == 0) return 0;
  
  const uint8_t tableSize = sizeof(LPG_RATIO_TABLE) / sizeof(LPG_RATIO_TABLE[0]);
  
  for (uint8_t i = 0; i < tableSize - 1; i++) {
    uint16_t ratioHigh = pgm_read_word(&LPG_RATIO_TABLE[i]);
    uint16_t ratioLow = pgm_read_word(&LPG_RATIO_TABLE[i + 1]);
    
    if (ratio >= ratioLow && ratio <= ratioHigh) {
      uint16_t ppmHigh = pgm_read_word(&LPG_PPM_TABLE[i]);
      uint16_t ppmLow = pgm_read_word(&LPG_PPM_TABLE[i + 1]);
      uint16_t ppmRange = ppmLow - ppmHigh;
      uint16_t ratioRange = ratioHigh - ratioLow;
      uint16_t ratioOffset = ratioHigh - ratio;
      
      return ppmHigh + ((ppmRange * ratioOffset) / ratioRange);
    }
  }
  
  return ratio > pgm_read_word(&LPG_RATIO_TABLE[0]) ? 0 : 10000;
}