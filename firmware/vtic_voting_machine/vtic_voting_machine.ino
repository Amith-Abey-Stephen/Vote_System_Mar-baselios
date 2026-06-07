#include <WiFi.h>
#include <time.h>
#include "config.h"
#include "wifi_manager.h"
#include "offline_queue.h"
#include "firebase_sync.h"

// System States
enum SystemState {
  STATE_INITIAL_SETUP,
  STATE_READY,
  STATE_VOTE_UPLOADING,
  STATE_VOTE_SUCCESS,
  STATE_VOTE_FAILED,
  STATE_COOLDOWN
};

SystemState currentState = STATE_READY;

// Selections
String selectedHB = "";
String selectedHG = "";
String selectedSC = "";

// Time variables
unsigned long stateChangeTime = 0;
unsigned long lastTelemetryTime = 0;
unsigned long configPressStartTime = 0;
bool configButtonPressed = false;

// Button configuration array
struct Button {
  int pin;
  String role;      // "hb", "hg", "sc", "reset", "config"
  String candidateId; // "candidate1", "candidate2", etc.
  bool lastState;
  unsigned long lastDebounceTime;
};

Button buttons[] = {
  {BTN_HB_1, "hb", "candidate1", HIGH, 0},
  {BTN_HB_2, "hb", "candidate2", HIGH, 0},
  {BTN_HB_3, "hb", "candidate3", HIGH, 0},
  {BTN_HB_4, "hb", "candidate4", HIGH, 0},

  {BTN_HG_1, "hg", "candidate1", HIGH, 0},
  {BTN_HG_2, "hg", "candidate2", HIGH, 0},
  {BTN_HG_3, "hg", "candidate3", HIGH, 0},
  {BTN_HG_4, "hg", "candidate4", HIGH, 0},

  {BTN_SC_1, "sc", "candidate1", HIGH, 0},
  {BTN_SC_2, "sc", "candidate2", HIGH, 0},
  {BTN_SC_3, "sc", "candidate3", HIGH, 0},
  {BTN_SC_4, "sc", "candidate4", HIGH, 0},

  {BTN_RESET, "reset", "", HIGH, 0},
  {BTN_CONFIG, "config", "", HIGH, 0}
};

const int totalButtons = sizeof(buttons) / sizeof(buttons[0]);

// Module instances
WifiManager wifiManager;
OfflineQueue offlineQueue;
FirebaseSync firebaseSync;

String macAddress = "";

// --- RGB LED CONTROL ---
void setRGBColor(int red, int green, int blue) {
  analogWrite(RGB_RED_PIN, red);
  analogWrite(RGB_GREEN_PIN, green);
  analogWrite(RGB_BLUE_PIN, blue);
}

void updateLEDStatus() {
  switch (currentState) {
    case STATE_INITIAL_SETUP:
      setRGBColor(128, 0, 128); // Purple
      break;
    case STATE_READY:
      setRGBColor(0, 255, 0); // Green
      break;
    case STATE_VOTE_UPLOADING:
      setRGBColor(255, 255, 0); // Yellow
      break;
    case STATE_VOTE_SUCCESS:
      setRGBColor(0, 0, 255); // Blue
      break;
    case STATE_VOTE_FAILED:
      setRGBColor(255, 0, 0); // Red
      break;
    case STATE_COOLDOWN:
      // Managed in loop for blinking
      break;
  }
}

// --- SYNC OFFLINE QUEUE ---
void processOfflineQueue() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  int pendingCount = offlineQueue.getPendingCount();
  if (pendingCount == 0) return;

  Serial.printf("Processing offline queue: %d votes pending.\n", pendingCount);

  String voteJson;
  while (offlineQueue.peekNext(voteJson)) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, voteJson);
    
    if (!error) {
      String hb = doc["headBoy"];
      String hg = doc["headGirl"];
      String sc = doc["sportsCaptain"];
      
      Serial.printf("Uploading offline vote: HB[%s], HG[%s], SC[%s]...\n", hb.c_str(), hg.c_str(), sc.c_str());
      if (firebaseSync.uploadVote(hb, hg, sc, macAddress)) {
        offlineQueue.popNext();
      } else {
        Serial.println("Upload failed, stopping queue synchronization.");
        break; // Network issue, try again later
      }
    } else {
      // Corrupt line, pop it to avoid deadlocks
      offlineQueue.popNext();
    }
  }
}

// --- DEVICE REPORT TELEMETRY ---
void sendHeartbeatTelemetry() {
  int queueCount = offlineQueue.getPendingCount();
  String ip = WiFi.localIP().toString();
  String ssid = WiFi.SSID();
  
  Serial.println("Sending device telemetry heartbeat...");
  firebaseSync.uploadTelemetry(macAddress, true, queueCount, ip, ssid);
}

void setup() {
  Serial.begin(115200);
  Serial.println("Starting VTIC Smart School Election Terminal...");

  // Setup RGB Pins
  pinMode(RGB_RED_PIN, OUTPUT);
  pinMode(RGB_GREEN_PIN, OUTPUT);
  pinMode(RGB_BLUE_PIN, OUTPUT);

  // Setup Button Pins
  for (int i = 0; i < totalButtons; i++) {
    pinMode(buttons[i].pin, INPUT_PULLUP);
  }

  // Get MAC Address
  macAddress = WiFi.macAddress();
  macAddress.replace(":", "-");
  macAddress = "VTIC-" + macAddress.substring(9); // e.g. VTIC-AB-CD-EF

  // Init Modules
  wifiManager.begin();
  offlineQueue.begin();

  if (wifiManager.hasCredentials()) {
    currentState = STATE_READY;
    updateLEDStatus();
    Serial.println("Connecting to network...");
    if (wifiManager.connect()) {
      Serial.println("Connected to Wi-Fi successfully!");
      
      // Init SNTP for Firestore time stamps
      configTime(19800, 0, "pool.ntp.org", "time.nist.gov"); // IST (UTC +5:30)
      
      firebaseSync.begin(wifiManager.getFirebaseProject(), wifiManager.getFirebaseApiKey());
      sendHeartbeatTelemetry();
    } else {
      Serial.println("WLAN connection failed. Starting in Offline Mode.");
    }
  } else {
    Serial.println("No WiFi credentials found. Launching setup Captive Portal...");
    currentState = STATE_INITIAL_SETUP;
    updateLEDStatus();
    wifiManager.startPortal();
  }
}

void loop() {
  if (currentState == STATE_INITIAL_SETUP) {
    wifiManager.handlePortal();
    return;
  }

  unsigned long currentMillis = millis();

  // --- BUTTON POLL READINGS ---
  for (int i = 0; i < totalButtons; i++) {
    int reading = digitalRead(buttons[i].pin);
    
    if (reading != buttons[i].lastState) {
      buttons[i].lastDebounceTime = currentMillis;
    }

    if ((currentMillis - buttons[i].lastDebounceTime) > BUTTON_DEBOUNCE_MS) {
      if (reading == LOW && buttons[i].lastState == HIGH) {
        // Button Clicked
        String role = buttons[i].role;
        
        if (currentState == STATE_READY) {
          if (role == "hb") {
            selectedHB = buttons[i].candidateId;
            Serial.println("HB Selected: " + selectedHB);
          } else if (role == "hg") {
            selectedHG = buttons[i].candidateId;
            Serial.println("HG Selected: " + selectedHG);
          } else if (role == "sc") {
            selectedSC = buttons[i].candidateId;
            Serial.println("SC Selected: " + selectedSC);
          } else if (role == "reset") {
            selectedHB = "";
            selectedHG = "";
            selectedSC = "";
            Serial.println("Selections Reset by user.");
          }
          
          // If all three categories are configured, proceed to uploading
          if (selectedHB != "" && selectedHG != "" && selectedSC != "") {
            currentState = STATE_VOTE_UPLOADING;
            updateLEDStatus();
            stateChangeTime = currentMillis;
            Serial.println("All roles selected. Starting Upload...");
          }
        }
        
        // Config button action
        if (role == "config" && !configButtonPressed) {
          configButtonPressed = true;
          configPressStartTime = currentMillis;
        }
      }
      
      if (reading == HIGH && buttons[i].lastState == LOW) {
        if (buttons[i].role == "config") {
          configButtonPressed = false;
        }
      }
    }
    buttons[i].lastState = reading;
  }

  // --- CONFIG HELD CHECK ---
  if (configButtonPressed && (currentMillis - configPressStartTime) > CONFIG_HOLD_TIME_MS) {
    Serial.println("Config button held for 5 seconds. Launching Portal...");
    wifiManager.resetCredentials();
    setRGBColor(128, 0, 128); // Purple
    delay(1000);
    ESP.restart();
  }

  // --- STATE CONTROL ---
  switch (currentState) {
    case STATE_VOTE_UPLOADING: {
      Serial.println("Uploading vote document...");
      bool ok = firebaseSync.uploadVote(selectedHB, selectedHG, selectedSC, macAddress);
      
      if (ok) {
        currentState = STATE_VOTE_SUCCESS;
        updateLEDStatus();
        Serial.println("Upload success.");
      } else {
        offlineQueue.enqueue(selectedHB, selectedHG, selectedSC);
        currentState = STATE_VOTE_FAILED;
        updateLEDStatus();
        Serial.println("Upload failed. Vote saved to LittleFS offline queue.");
      }
      stateChangeTime = currentMillis;
      break;
    }

    case STATE_VOTE_SUCCESS:
    case STATE_VOTE_FAILED:
      if (currentMillis - stateChangeTime >= SUCCESS_LED_TIME_MS) {
        currentState = STATE_COOLDOWN;
        stateChangeTime = currentMillis;
      }
      break;

    case STATE_COOLDOWN: {
      // Blink Yellow LED
      if (((currentMillis - stateChangeTime) / 500) % 2 == 0) {
        setRGBColor(255, 255, 0); // Yellow
      } else {
        setRGBColor(0, 0, 0); // Off
      }

      if (currentMillis - stateChangeTime >= COOLDOWN_TIME_MS) {
        // Reset state
        selectedHB = "";
        selectedHG = "";
        selectedSC = "";
        currentState = STATE_READY;
        updateLEDStatus();
        Serial.println("Cooldown completed. Terminal ready for next vote.");
      }
      break;
    }

    case STATE_READY:
      // --- BACKGROUND SYNC & TELEMETRY ---
      if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = currentMillis;
        processOfflineQueue();
        sendHeartbeatTelemetry();
      }
      break;
      
    default:
      break;
  }
}
