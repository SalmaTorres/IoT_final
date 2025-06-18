#ifndef WIFI_CONFIG_H
#define WIFI_CONFIG_H

#include <WiFiManager.h>

class WiFiConfig {
  private:
    WiFiManager wifiManager;
    bool isConnected;

public:
    WiFiConfig();
    bool initialize();
    bool connect();
    bool isWiFiConnected() const;
    const char* getLocalIP() const;
    void reset();
};

#endif