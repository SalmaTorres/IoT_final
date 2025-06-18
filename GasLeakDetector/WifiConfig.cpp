#include "WiFiConfig.h"

WiFiConfig::WiFiConfig() : isConnected(false) {}

bool WiFiConfig::initialize() {
    wifiManager.setConfigPortalTimeout(300);
    wifiManager.setAPCallback([](WiFiManager *mgr) {
        Serial.println(F("Config mode - Connect to: "));
        Serial.println(mgr->getConfigPortalSSID());
    });
    return true;
}

bool WiFiConfig::connect() {
    if (wifiManager.autoConnect("ESP32-Gas", "12345678")) {
        Serial.println(F("WiFi OK"));
        isConnected = true;
        return true;
    }
    isConnected = false;
    return false;
}

bool WiFiConfig::isWiFiConnected() const {
    return WiFi.status() == WL_CONNECTED && isConnected;
}

const char* WiFiConfig::getLocalIP() const {
    static String ip;
    ip = WiFi.localIP().toString();
    return ip.c_str();
}

void WiFiConfig::reset() {
    wifiManager.resetSettings();
    ESP.restart();
}