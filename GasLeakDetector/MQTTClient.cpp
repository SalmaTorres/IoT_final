#include "MQTTClient.h"

MQTTClient::MQTTClient(const String& endpoint, int port, const String& clientId, const String& updateTopic, const String& updateDeltaTopic) 
  : brokerEndpoint(endpoint), brokerPort(port), clientId(clientId), client(wifiClient) {
    this->updateTopic = updateTopic;
    this->updateDeltaTopic = updateDeltaTopic;
}

bool MQTTClient::initialize() {
  Serial.println("Initializing MQTT client...");
  setupSSL();
  client.setServer(brokerEndpoint.c_str(), brokerPort);
  Serial.println("MQTT client initialized successfully");
  return true;
}

void MQTTClient::setupSSL() {
  wifiClient.setCACert(AWSCertificates::getRootCA());
  wifiClient.setCertificate(AWSCertificates::getDeviceCertificate());
  wifiClient.setPrivateKey(AWSCertificates::getPrivateKey());
}

bool MQTTClient::connect() {
  int attempts = 0;
  const int maxAttempts = 5;
    
  while (!client.connected() && attempts < maxAttempts) {
    Serial.print("Attempting MQTT connection... ");
        
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
            
      if (updateDeltaTopic.length() > 0) {
        subscribe(updateDeltaTopic);
      }
            
      return true;
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" trying again in 5 seconds");
      attempts++;
      delay(5000);
    }
  }
    
  Serial.println("Failed to connect to MQTT broker after maximum attempts");
  return false;
}

bool MQTTClient::isConnected() {
    return client.connected();
}

void MQTTClient::disconnect() {
  if (client.connected()) {
    client.disconnect();
    Serial.println("MQTT client disconnected");
  }
}

void MQTTClient::loop() {
    client.loop();
}

bool MQTTClient::subscribe(const String& topic) {
  if (!client.connected()) {
    Serial.println("MQTT client not connected");
    return false;
  }
    
  if (client.subscribe(topic.c_str())) {
    Serial.println("Subscribed to " + topic);
    return true;
  } else {
    Serial.println("Failed to subscribe to " + topic);
    return false;
  }
}

bool MQTTClient::publish(const String& topic, const String& message) {
  if (!client.connected()) {
    Serial.println("MQTT client not connected");
    return false;
  }
    
  return client.publish(topic.c_str(), message.c_str());
}

void MQTTClient::setMessageCallback(void (*cb)(char*, byte*, unsigned int)) {
  client.setCallback(cb);
}