#ifndef GASSENSOR_H
#define GASSENSOR_H

#include <Arduino.h>

class GasSensor {
  private:
    uint8_t pin;
    uint16_t cleanAirResistanceRo; 
    bool calibrated;
    int ppm; 
    String gasLevel;
    int safeThreshold;
    int warningThreshold;
    
    uint16_t calculateSensorResistance(uint16_t adcValue);
    uint16_t readAverageResistance(uint8_t samples);
    uint16_t convertRatioToPPM(uint16_t ratio);
    
  public:
    GasSensor(uint8_t pin); 
    
    bool calibrateInCleanAir();
    void calculateGasConcentration();
    int getPPM();
    String getGasLevel();
    bool isCalibrationValid() const;
    uint16_t getCleanAirResistance() const;
    
    void setSafeThreshold(int threshold) { safeThreshold = threshold; }
    void setWarningThreshold(int threshold) { warningThreshold = threshold; }
    int getSafeThreshold() { return safeThreshold; }
    int getWarningThreshold() { return warningThreshold; }
};

#endif