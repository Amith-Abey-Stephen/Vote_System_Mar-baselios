# VTIC Smart School Election System (Revised)

## Election Structure

The election consists of 3 positions.

### Head Boy

* Candidate 1
* Candidate 2
* Candidate 3
* Candidate 4

### Head Girl

* Candidate 1
* Candidate 2
* Candidate 3
* Candidate 4

### Sports Captain

* Candidate 1
* Candidate 2
* Candidate 3
* Candidate 4

---

## Total Candidates

```text
3 Positions × 4 Candidates

= 12 Candidates
```

---

# Hardware Layout

## Inputs

### Voting Buttons

12 Buttons

```text
Head Boy
 ├── Candidate 1
 ├── Candidate 2
 ├── Candidate 3
 └── Candidate 4

Head Girl
 ├── Candidate 1
 ├── Candidate 2
 ├── Candidate 3
 └── Candidate 4

Sports Captain
 ├── Candidate 1
 ├── Candidate 2
 ├── Candidate 3
 └── Candidate 4
```

### Reset Button

Used to clear current selections before submission.

If a voter makes a mistake:

```text
Press Reset
↓
Clear all selections
↓
Start again
```

### Configuration Button

Long Press (5 seconds)

```text
Enter WiFi Setup Mode
```

---

# Outputs

## RGB Status LED

Only one RGB LED is required.

No candidate LEDs are used.

This reduces:

* Wiring
* Power Consumption
* Complexity
* Cost

---

# Voting Logic

A voter must select:

* One Head Boy
* One Head Girl
* One Sports Captain

Example:

```text
Head Boy → Candidate 3

Head Girl → Candidate 1

Sports Captain → Candidate 4
```

When all three selections are completed:

```text
Vote Ready
```

System automatically starts upload.

---

# Reset Logic

Before upload:

User may press Reset.

Action:

```text
Clear all selections
```

No vote is submitted.

RGB remains Green.

---

# Upload Logic

After all 3 roles are selected:

## Lock Voting

Disable all buttons.

---

## Upload Vote

RGB:

Yellow

Meaning:

Uploading vote to Firebase.

Vote Example:

```json
{
  "headBoy": "candidate3",
  "headGirl": "candidate1",
  "sportsCaptain": "candidate4",
  "timestamp": 1740000000
}
```

---

# Success

RGB:

Blue

Duration:

2 Seconds

Meaning:

Vote recorded successfully.

---

# Failure

RGB:

Red

Vote stored locally.

Automatic sync later.

No vote loss.

---

# Cooldown

After successful recording:

RGB:

Blinking Yellow

Duration:

10 Seconds

During cooldown:

* All buttons disabled
* No new voting allowed

After cooldown:

* Selections cleared
* Buttons unlocked

RGB:

Green

Ready for next voter.

---

# RGB Status Reference

| Color           | Meaning                        |
| --------------- | ------------------------------ |
| Green           | Ready For Voting               |
| Purple          | WiFi Configuration Mode        |
| Yellow          | Uploading Vote                 |
| Blue            | Vote Recorded Successfully     |
| Red             | Upload Failed (Stored Offline) |
| Blinking Yellow | Cooldown Period                |

---

# Election Control Panel

The administrator configures:

## Head Boy

Candidate 1

* Name
* Class

Candidate 2

* Name
* Class

Candidate 3

* Name
* Class

Candidate 4

* Name
* Class

---

## Head Girl

Candidate 1

* Name
* Class

Candidate 2

* Name
* Class

Candidate 3

* Name
* Class

Candidate 4

* Name
* Class

---

## Sports Captain

Candidate 1

* Name
* Class

Candidate 2

* Name
* Class

Candidate 3

* Name
* Class

Candidate 4

* Name
* Class

---

# Dashboard Features

* Total Votes
* Election Status
* Live Results
* Current Leaders
* Device Status
* Last Vote Received
* Pending Offline Votes

All updates occur in real time using Firebase Firestore.

---

# Hardware Summary

```text
ESP32

12 Vote Buttons

1 Reset Button & WiFi Config Button

1 RGB LED
```

Total Physical Controls:

```text
14 Buttons
1 RGB LED
```

Simple, reliable, and suitable for school election deployment.
