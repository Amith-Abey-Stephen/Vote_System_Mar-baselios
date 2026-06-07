#ifndef CONFIG_H
#define CONFIG_H

// --- FIREBASE SETTINGS ---
// Set your project parameters. These can also be configured via Captive Portal
#define DEFAULT_FIREBASE_PROJECT_ID "vtic-voting-system"
#define DEFAULT_FIREBASE_API_KEY "YOUR_API_KEY_HERE"

// --- GPIO PIN CONFIGURATIONS ---

// Voting buttons (12 total: 4 for Head Boy, 4 for Head Girl, 4 for Sports Captain)
#define BTN_HB_1 4
#define BTN_HB_2 12
#define BTN_HB_3 13
#define BTN_HB_4 14

#define BTN_HG_1 15
#define BTN_HG_2 16
#define BTN_HG_3 17
#define BTN_HG_4 18

#define BTN_SC_1 19
#define BTN_SC_2 21
#define BTN_SC_3 22
#define BTN_SC_4 23

// Control buttons
#define BTN_RESET 25
#define BTN_CONFIG 26

// RGB LED (Common Cathode by default, active HIGH)
#define RGB_RED_PIN 27
#define RGB_GREEN_PIN 32
#define RGB_BLUE_PIN 33

// --- SYSTEM CONSTANTS ---
#define CONFIG_HOLD_TIME_MS 5000     // 5 seconds long press to enter Captive Portal Setup
#define SUCCESS_LED_TIME_MS 2000     // 2 seconds success light
#define COOLDOWN_TIME_MS 10000       // 10 seconds cooldown between voters
#define BUTTON_DEBOUNCE_MS 50        // 50ms button debounce limit
#define TELEMETRY_INTERVAL_MS 30000  // 30 seconds device heartbeat rate

#endif
