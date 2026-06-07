# VTIC Smart School Election System

*Developed & Powered by [CircuitBay](https://circuitbay.org/)*

A production-ready school election voting system utilizing physical ESP32 voting terminals synchronized in real-time with a light-themed, non-technical web administration console using Google Firebase Firestore.

---

## 📂 Project Structure

```text
voting machine/
├── index.html             # Administrative Dashboard UI
├── style.css              # Dashboard stylesheet (Light, spacious layout)
├── app.js                 # Dashboard controllers & Firestore live bindings
├── plan.md                # System voting logic specifications
├── README.md              # Project documentation (This file)
└── firmware/
    └── vtic_voting_machine/
        ├── vtic_voting_machine.ino   # Main ESP32 state-machine sketch
        ├── config.h                 # GPIO mappings & system timers
        ├── wifi_manager.h           # Captive Portal & Preferences WLAN store
        ├── offline_queue.h          # LittleFS local backup queue for offline voting
        └── firebase_sync.h          # REST HTTPClient Firestore connection helpers
```

---

## 📊 Database Schema (Firestore)

The web dashboard and physical ESP32 terminals communicate in real time through Firestore:

### 1. `/election/status`
Tracks the global state of the election.
* **Format:**
  ```json
  { "state": "configuring" | "running" | "paused" | "ended" }
  ```

### 2. `/election/candidates`
Stores the candidate rosters for the three positions: Head Boy (`hb`), Head Girl (`hg`), and Sports Captain (`sc`).
* **Format:**
  ```json
  {
    "hb": [ { "id": "candidate1", "name": "Aarav Sharma", "class": "10A" }, ... ],
    "hg": [ ... ],
    "sc": [ ... ]
  }
  ```

### 3. `/votes/{voteId}`
An audit trail where votes are recorded. Each document represents a single submitted ballot.
* **Format:**
  ```json
  {
    "headBoy": "candidate3",
    "headGirl": "candidate1",
    "sportsCaptain": "candidate4",
    "deviceId": "VTIC-AB-CD-EF",
    "timestamp": 1740000000
  }
  ```

### 4. `/devices/{deviceId}`
Telemetry and state monitoring for active physical terminals.
* **Format:**
  ```json
  {
    "online": true,
    "lastActive": 1740000300,
    "pendingVotes": 0,
    "ipAddress": "192.168.1.144",
    "ssid": "VTIC-WLAN-SECURE"
  }
  ```

## 💻 Web Dashboard Setup & CD Pipeline

The dashboard connects to Firebase dynamically at runtime. You can set it up either locally or through a GitHub Actions automated pipeline.

### Option A: Local / Manual Setup
1. Create a file named **`config.json`** in the root directory:
   ```json
   {
     "apiKey": "YOUR_FIREBASE_API_KEY",
     "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
     "projectId": "YOUR_PROJECT_ID"
   }
   ```
   *Note: If `config.json` is missing or keys are empty, the dashboard defaults to local offline **Demo Mode** using values from `app.js`.*
2. Open **`index.html`** directly in any modern web browser or run it on a local static server.

### Option B: Automated GitHub Actions Deployment
This project includes a CI/CD workflow that automatically injects your credentials from GitHub Secrets, builds a clean production distribution, and deploys it to **GitHub Pages**.

1. Push your repository to GitHub.
2. In your repository settings under **Settings > Secrets and variables > Actions**, add the following Repository Secrets:
   * `FIREBASE_API_KEY`
   * `FIREBASE_AUTH_DOMAIN`
   * `FIREBASE_PROJECT_ID`
3. Push to your `main` or `master` branch. The action will build the deployment assets under `dist/`, create the `config.json` file dynamically, and publish it automatically.

### Firebase Authentication (Admin Login Setup)
To protect your production administrative dashboard from unauthorized access, configure one or both of the supported sign-in providers in your Firebase console:

#### Option A: Email & Password
1. Open the [Firebase Console](https://console.firebase.google.com/) and navigate to your project.
2. Click **Authentication** in the left sidebar, and click **Get Started**.
3. Under the **Sign-in method** tab, click **Add new provider** and select **Email/Password**.
4. Enable the **Email/Password** toggle and click **Save**.
5. Go to the **Users** tab, click **Add user**, and register an email address (e.g. `admin@vtic.edu.in`) and a secure password.

#### Option B: Google Sign-In
1. In the **Sign-in method** tab of the Firebase Authentication console, click **Add new provider** and select **Google**.
2. Enable the toggle, fill in the **Project support email** dropdown, and click **Save**.
3. *Note: Ensure your web dashboard domain (like your GitHub Pages URL) is added to the **Authorized domains** list located at the bottom of the Sign-in method settings tab.*

---

## 🔌 Hardware Terminal Setup (ESP32)

### 1. Wiring & Pin Configuration
The ESP32 pins are configured in [**`firmware/vtic_voting_machine/config.h`**](file:///home/amith/amith/Projects/voting%20machine/firmware/vtic_voting_machine/config.h):
* **Voting Buttons (12 total):** Pins `4, 12, 13, 14` (Head Boy), `15, 16, 17, 18` (Head Girl), and `19, 21, 22, 23` (Sports Captain).
* **Reset Button:** Pin `25` (Clears current selections).
* **Config Button:** Pin `26` (Hold for 5s to enter Wi-Fi Setup).
* **RGB Status LED:** Pins `27` (Red), `32` (Green), `33` (Blue) [Common Cathode].

### 2. LED Status Key

| LED Color | Meaning |
| :--- | :--- |
| **Green** | Ready for voting |
| **Purple** | WiFi Setup portal active |
| **Yellow** | Uploading vote document to database |
| **Blue** | Vote uploaded successfully (2s) |
| **Red** | Upload failed; vote cached offline (2s) |
| **Blinking Yellow** | Voter Cooldown (10s); inputs temporarily locked |

### 3. Captive Portal (Initial WLAN Setup)
* On first start, or when holding the **Config** button for 5 seconds, the terminal enters Setup Mode.
* Connect your phone or laptop to the wireless network: **`VTIC-VOTING-SETUP`**.
* A portal will automatically open (or navigate to `http://192.168.4.1`).
* Select your Wi-Fi SSID, enter your password, input your Firebase Project credentials, and click **Save & Restart**.

### 4. Offline Queue System
If the Wi-Fi connection drops, the terminal uses `LittleFS` storage to write the ballot as a JSON line locally in flash memory (`/votes_queue.jsonl`). As soon as the terminal reconnects, it will automatically flush the queue, uploading cached votes to Firestore in chronological order without data loss.

---

## 🛠️ Installation & Flashing
1. Open the Arduino IDE.
2. Install the **ArduinoJson** library (Library Manager -> search `ArduinoJson` -> Install version 6.x).
3. Open [`firmware/vtic_voting_machine/vtic_voting_machine.ino`](file:///home/amith/amith/Projects/voting%20machine/firmware/vtic_voting_machine/vtic_voting_machine.ino).
4. Configure your parameters in `config.h`.
5. Select **ESP32 Dev Module** under Board Manager and flash the chip.
