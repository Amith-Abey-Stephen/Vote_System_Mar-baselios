#ifndef FIREBASE_SYNC_H
#define FIREBASE_SYNC_H

#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

class FirebaseSync {
private:
  String projectId;
  String apiKey;
  WiFiClientSecure client;

public:
  FirebaseSync() {
    client.setInsecure(); // Skip certificate verification for simple deployments
  }

  void begin(String projId, String key) {
    projectId = projId;
    apiKey = key;
  }

  bool uploadVote(String hb, String hg, String sc, String deviceId) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    String url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/votes?key=" + apiKey;
    
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");

    // Construct Firestore fields JSON payload
    StaticJsonDocument<500> doc;
    JsonObject fields = doc.createNestedObject("fields");
    
    JsonObject hbObj = fields.createNestedObject("headBoy");
    hbObj["stringValue"] = hb;

    JsonObject hgObj = fields.createNestedObject("headGirl");
    hgObj["stringValue"] = hg;

    JsonObject scObj = fields.createNestedObject("sportsCaptain");
    scObj["stringValue"] = sc;

    JsonObject deviceObj = fields.createNestedObject("deviceId");
    deviceObj["stringValue"] = deviceId;

    JsonObject tsObj = fields.createNestedObject("timestamp");
    tsObj["integerValue"] = String(time(nullptr));

    String payload;
    serializeJson(doc, payload);

    int httpCode = http.POST(payload);
    http.end();

    return httpCode == 200 || httpCode == 201;
  }

  bool uploadTelemetry(String deviceId, bool online, int pendingCount, String ipAddress, String ssid) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    // Use PATCH to create or overwrite the device telemetry document
    String url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/devices/" + deviceId + "?currentDocument.exists=true&key=" + apiKey;
    
    // We try to patch first; if it returns 404, we use POST/PATCH to create it
    String patchUrl = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/devices/" + deviceId + "?updateMask.fieldPaths=online&updateMask.fieldPaths=lastActive&updateMask.fieldPaths=pendingVotes&updateMask.fieldPaths=ipAddress&updateMask.fieldPaths=ssid&key=" + apiKey;

    http.begin(client, patchUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<500> doc;
    JsonObject fields = doc.createNestedObject("fields");

    JsonObject onlineObj = fields.createNestedObject("online");
    onlineObj["booleanValue"] = online;

    JsonObject pendingObj = fields.createNestedObject("pendingVotes");
    pendingObj["integerValue"] = String(pendingCount);

    JsonObject ipObj = fields.createNestedObject("ipAddress");
    ipObj["stringValue"] = ipAddress;

    JsonObject ssidObj = fields.createNestedObject("ssid");
    ssidObj["stringValue"] = ssid;

    JsonObject tsObj = fields.createNestedObject("lastActive");
    tsObj["integerValue"] = String(time(nullptr));

    String payload;
    serializeJson(doc, payload);

    // Send HTTP PATCH request via customRequest
    int httpCode = http.sendRequest("PATCH", payload);
    http.end();

    // If it doesn't exist, post it
    if (httpCode == 404) {
      String createUrl = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/devices?documentId=" + deviceId + "&key=" + apiKey;
      http.begin(client, createUrl);
      http.addHeader("Content-Type", "application/json");
      httpCode = http.POST(payload);
      http.end();
    }

    return httpCode == 200 || httpCode == 201;
  }
};

#endif
