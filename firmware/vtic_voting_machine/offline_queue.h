#ifndef OFFLINE_QUEUE_H
#define OFFLINE_QUEUE_H

#include <LittleFS.h>
#include <ArduinoJson.h>

class OfflineQueue {
private:
  const char* QUEUE_FILE = "/votes_queue.jsonl";

public:
  OfflineQueue() {}

  bool begin() {
    if (!LittleFS.begin(true)) {
      Serial.println("LittleFS Mount Failed");
      return false;
    }
    return true;
  }

  void enqueue(String hb, String hg, String sc) {
    File file = LittleFS.open(QUEUE_FILE, FILE_APPEND);
    if (!file) {
      Serial.println("Failed to open queue file for appending");
      return;
    }

    StaticJsonDocument<200> doc;
    doc["headBoy"] = hb;
    doc["headGirl"] = hg;
    doc["sportsCaptain"] = sc;
    doc["timestamp"] = time(nullptr); // System time if NTP synchronized

    serializeJson(doc, file);
    file.print("\n");
    file.close();
    Serial.println("Vote queued offline successfully.");
  }

  int getPendingCount() {
    if (!LittleFS.exists(QUEUE_FILE)) return 0;
    File file = LittleFS.open(QUEUE_FILE, FILE_READ);
    if (!file) return 0;

    int count = 0;
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.length() > 5) count++;
    }
    file.close();
    return count;
  }

  bool peekNext(String &outJson) {
    if (!LittleFS.exists(QUEUE_FILE)) return false;
    File file = LittleFS.open(QUEUE_FILE, FILE_READ);
    if (!file) return false;

    while (file.available()) {
      String line = file.readStringUntil('\n');
      line.trim();
      if (line.length() > 5) {
        outJson = line;
        file.close();
        return true;
      }
    }
    file.close();
    return false;
  }

  void popNext() {
    if (!LittleFS.exists(QUEUE_FILE)) return;
    File file = LittleFS.open(QUEUE_FILE, FILE_READ);
    if (!file) return;

    File tempFile = LittleFS.open("/temp_queue.jsonl", FILE_WRITE);
    if (!tempFile) {
      file.close();
      return;
    }

    bool skippedFirst = false;
    while (file.available()) {
      String line = file.readStringUntil('\n');
      line.trim();
      if (line.length() > 5) {
        if (!skippedFirst) {
          skippedFirst = true; // Skip the first valid line we pop
        } else {
          tempFile.print(line + "\n");
        }
      }
    }
    
    file.close();
    tempFile.close();

    LittleFS.remove(QUEUE_FILE);
    LittleFS.rename("/temp_queue.jsonl", QUEUE_FILE);
    Serial.println("Popped front vote from offline cache.");
  }
};

#endif
