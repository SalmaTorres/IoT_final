#include <Arduino.h>
#include <ArduinoJson.h>
#include "GasSensor.h"
#include "Fan.h"
#include "Valve.h"
#include "Buzzer.h"
#include "WifiConfig.h"
#include "MQTTClient.h"

constexpr uint8_t FAN_PIN = 18;
constexpr uint8_t GAS_SENSOR_PIN = 34;
constexpr uint8_t VALVE_PIN = 16;
constexpr uint8_t BUZZER_PIN = 17;

const String DEVICE_NAME = "smart_monitor_gas_001";
const String MQTT_BROKER = "a2qtonmyilc0yl-ats.iot.us-east-2.amazonaws.com";
const int MQTT_PORT = 8883;

const String UPDATE = "$aws/things/smart_monitor_gas_001/shadow/update";
const String UPDATE_DELTA = "$aws/things/smart_monitor_gas_001/shadow/update/delta";

GasSensor gasSensor(GAS_SENSOR_PIN);
Fan fan(FAN_PIN);
Valve valve(VALVE_PIN);
Buzzer buzzer(BUZZER_PIN);
WiFiConfig wifiManager;
MQTTClient mqttClient(MQTT_BROKER, MQTT_PORT, DEVICE_NAME, UPDATE, UPDATE_DELTA);

struct Timings {
    static constexpr unsigned long REPORT_INTERVAL = 500;
    static constexpr unsigned long MQTT_RECONNECT_INTERVAL = 10000;
    static constexpr unsigned long WIFI_RECONNECT_INTERVAL = 5000;
    static constexpr unsigned long LOOP_DELAY = 200;
};

struct SystemState {
    uint16_t currentPPM = 0;
    String currentGasLevel = "inicializando";
    String lastGasLevel = "";
    bool stateChanged = false;
    bool remoteCommandReceived = false;
    unsigned long lastReportTime = 0;
} systemState;

StaticJsonDocument<256> inputDoc;
StaticJsonDocument<512> outputDoc;
char outputBuffer[512];

void printSystemStatus() {
    Serial.println("=== ESTADO ACTUAL DEL SISTEMA ===");
    Serial.println("PPM: " + String(systemState.currentPPM));
    Serial.println("Nivel de gas: " + systemState.currentGasLevel);
    Serial.println("Buzzer: " + buzzer.getState());
    Serial.println("Fan: " + fan.getState());
    Serial.println("Valve: " + valve.getState());
    Serial.println("Safe threshold: " + String(gasSensor.getSafeThreshold()));
    Serial.println("Warning threshold: " + String(gasSensor.getWarningThreshold()));
    Serial.println("================================");
}

bool createReportPayload() {
    outputDoc.clear();
    
    JsonObject state = outputDoc.createNestedObject("state");
    JsonObject reported = state.createNestedObject("reported");
    
    reported["gasLevel_ppm"] = systemState.currentPPM;
    reported["gasLevel_state"] = systemState.currentGasLevel;
    reported["buzzer_state"] = buzzer.getState();
    reported["fan_state"] = fan.getState();
    reported["valve_state"] = valve.getState();
    reported["safe_threshold"] = gasSensor.getSafeThreshold();
    reported["warning_threshold"] = gasSensor.getWarningThreshold();
    
    size_t len = serializeJson(outputDoc, outputBuffer, sizeof(outputBuffer));
    return len > 0;
}

void reportStates() {
    if (!mqttClient.isConnected()) {
        Serial.println("MQTT desconectado - omitiendo reporte");
        return;
    }

    unsigned long currentTime = millis();
    if (!systemState.remoteCommandReceived && 
        currentTime - systemState.lastReportTime < Timings::REPORT_INTERVAL) {
        return;
    }

    if (!createReportPayload()) {
        Serial.println("ERROR: Fallo al crear payload JSON");
        return;
    }

    Serial.println("Reportando: " + String(outputBuffer));
    
    if (mqttClient.publish(UPDATE, outputBuffer)) {
        Serial.println("Estados reportados exitosamente");
        systemState.lastReportTime = currentTime;
        systemState.remoteCommandReceived = false;
    } else {
        Serial.println("Error al reportar estados");
    }
}

bool processThresholds(JsonObject& config, const String& source) {
    bool changed = false;
    
    if (config.containsKey("safe_threshold")) {
        uint16_t threshold = config["safe_threshold"].as<uint16_t>();
        gasSensor.setSafeThreshold(threshold);
        Serial.println("Safe threshold " + source + ": " + String(threshold));
        changed = true;
    }
    
    if (config.containsKey("warning_threshold")) {
        uint16_t threshold = config["warning_threshold"].as<uint16_t>();
        gasSensor.setWarningThreshold(threshold);
        Serial.println("Warning threshold " + source + ": " + String(threshold));
        changed = true;
    }
    
    return changed;
}

bool processDeviceCommand(JsonObject& deltaState, const String& device, const String& command) {
    if (!deltaState.containsKey(device)) return false;
    
    String deviceCommand = deltaState[device].as<String>();
    Serial.println("Delta " + device + ": " + deviceCommand);
    
    if (device == "buzzer_state") {
        if (deviceCommand == "on") buzzer.turnOn();
        else if (deviceCommand == "off") buzzer.turnOff();
        else return false;
    } else if (device == "fan_state") {
        if (deviceCommand == "on") fan.turnOn();
        else if (deviceCommand == "off") fan.turnOff();
        else return false;
    } else if (device == "valve_state") {
        if (deviceCommand == "open") valve.open();
        else if (deviceCommand == "closed") valve.close();
        else return false;
    }
    
    return true;
}

void processDeltaMessage(JsonObject deltaState) { 
    Serial.println("=== PROCESANDO DELTA - SINCRONIZACIÓN AUTOMÁTICA ===");
    
    bool devicesChanged = false;
    
    devicesChanged |= processDeviceCommand(deltaState, "buzzer_state", "");
    devicesChanged |= processDeviceCommand(deltaState, "fan_state", "");
    devicesChanged |= processDeviceCommand(deltaState, "valve_state", "");
    devicesChanged |= processThresholds(deltaState, "sincronizado desde delta");
    
    if (devicesChanged) {
        Serial.println("=== SINCRONIZACIÓN COMPLETADA ===");
        printSystemStatus();
        
        delay(1000);
        reportStates();
        Serial.println("=== ESTADO REPORTADO ===");
    }
}

void callback(char* topic, byte* payload, unsigned int length) {
    Serial.println("=== MENSAJE MQTT RECIBIDO ===");
    Serial.println("Tópico: " + String(topic));
    
    String message = "";
    message.reserve(length);
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    Serial.println("Payload: " + message);
    
    DeserializationError error = deserializeJson(inputDoc, message);
    if (error) {
        Serial.println("ERROR JSON: " + String(error.c_str()));
        return;
    }
    
    String topicStr = String(topic);
    
    if (topicStr == UPDATE_DELTA && inputDoc.containsKey("state")) {
        JsonObject deltaState = inputDoc["state"].as<JsonObject>();
        processDeltaMessage(deltaState);
    }
}

bool setupMQTTSubscriptions() {
    Serial.println("Configurando suscripciones MQTT...");
    
    if (mqttClient.subscribe(UPDATE_DELTA)) {
        Serial.println("Suscrito a UPDATE_DELTA");
        return true;
    } else {
        Serial.println("Error suscribiendo a UPDATE_DELTA");
        return false;
    }
}

void handleMQTTReconnection() {
    static unsigned long lastAttempt = 0;
    if (millis() - lastAttempt < Timings::MQTT_RECONNECT_INTERVAL) return;
    
    Serial.println("=== RECONECTANDO MQTT ===");
    
    if (mqttClient.connect()) {
        Serial.println("MQTT reconectado");
        setupMQTTSubscriptions();
        delay(2000); 
        reportStates();
    } else {
        Serial.println("Falló reconexión MQTT");
    }
    
    lastAttempt = millis();
}

void handleWiFiReconnection() {
    static unsigned long lastAttempt = 0;
    if (millis() - lastAttempt < Timings::WIFI_RECONNECT_INTERVAL) return;
    
    Serial.println("Intentando reconectar WiFi...");
    wifiManager.connect();
    lastAttempt = millis();
}

void setup() {
    Serial.begin(115200);
    Serial.println("=== INICIANDO SISTEMA DE DETECCIÓN DE GAS ===");
    
    Serial.println("Inicializando WiFi...");
    if (!wifiManager.initialize() || !wifiManager.connect()) {
        Serial.println("ERROR FATAL: WiFi no disponible");
        while(1) delay(1000);
    }
    
    Serial.println("Inicializando MQTT...");
    if (!mqttClient.initialize()) {
        Serial.println("ERROR FATAL: MQTT no disponible");
        while(1) delay(1000);
    }
    
    mqttClient.setMessageCallback(callback);

    if (mqttClient.connect()) {
        Serial.println("MQTT conectado");
        setupMQTTSubscriptions();
        delay(2000); 
        reportStates();
    } else {
        Serial.println("ADVERTENCIA: Sin conexión MQTT - modo offline");
    }
    
    Serial.println("Calibrando sensor...");
    if (!gasSensor.calibrateInCleanAir()) {
        Serial.println("ERROR FATAL: Fallo en calibración del sensor");
        while(1) delay(1000);
    }
    
    gasSensor.calculateGasConcentration();
    systemState.currentPPM = gasSensor.getPPM();
    systemState.currentGasLevel = gasSensor.getGasLevel();
    systemState.lastGasLevel = systemState.currentGasLevel;
    
    Serial.println("=== SISTEMA INICIALIZADO ===");
    Serial.println("IP: " + String(wifiManager.getLocalIP()));
    Serial.println("Estado inicial: " + systemState.currentGasLevel);
    
    if (!mqttClient.isConnected()) {
        Serial.println("Operando en modo offline");
    }
}

void loop() {
    mqttClient.loop();
    
    if (!wifiManager.isWiFiConnected()) {
        handleWiFiReconnection();
        delay(100);
        return;
    }
    
    if (!mqttClient.isConnected()) {
        handleMQTTReconnection();
    }
    
    if (systemState.remoteCommandReceived) {
        systemState.stateChanged = false;
    }
    
    gasSensor.calculateGasConcentration();
    systemState.currentPPM = gasSensor.getPPM();
    systemState.currentGasLevel = gasSensor.getGasLevel();
    
    Serial.println("PPM: " + String(systemState.currentPPM) + " - Estado: " + systemState.currentGasLevel);
    
    if (systemState.currentGasLevel != systemState.lastGasLevel) {
        Serial.println("Cambio detectado: " + systemState.lastGasLevel + " -> " + systemState.currentGasLevel);
        systemState.lastGasLevel = systemState.currentGasLevel;
        systemState.stateChanged = true;
        reportStates();
    }
    
    delay(Timings::LOOP_DELAY);
}