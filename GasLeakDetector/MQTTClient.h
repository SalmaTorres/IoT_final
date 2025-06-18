#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "AWSCertificates.h"

class MQTTClient {
private:
    WiFiClientSecure wifiClient;
    PubSubClient client;
    String brokerEndpoint;
    int brokerPort;
    String clientId;
    String updateTopic;
    String updateDeltaTopic;
    void setupSSL();
    
public:
    MQTTClient(const String& endpoint, int port, const String& clientId, const String& updateTopic, const String& updateDeltaTopic);
    bool initialize();
    bool connect();
    bool isConnected();
    void disconnect();
    void loop();
    bool subscribe(const String& topic);
    bool publish(const String& topic, const String& message);
    void setMessageCallback(void (*cb)(char*, byte*, unsigned int)); 
};

#endif