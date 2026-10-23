# B.M.S. COLLEGE FOR WOMEN (AUTONOMOUS)
### Bugle Rock, Basavanagudi, Bengaluru – 560004

## A PROJECT REPORT ON
# “VISIONASSIST AI”
### Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students

**Bachelor of Computer Applications (BCA)**  
**Submitted by:**  
- **NAYANA N S** (U18BP24S0023)  
- **LAKSHMI K** (U18BP24S0211)  

**Under the Guidance of:**  
- **Dr. Anita** — Department of B.Voc. IT  
- **Prof. Chandana H.** — Department of BCA  

**DEPARTMENT OF BACHELOR OF COMPUTER APPLICATIONS**  
**Academic Year 2026–2027**  

---

## CERTIFICATE

This is to certify that **NAYANA N S (U18BP24S0023)** and **LAKSHMI K (U18BP24S0211)**, students of the Bachelor of Computer Applications programme at B.M.S. College for Women, Bengaluru, have completed the project entitled **“VisionAssist AI – Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students”** in partial fulfilment of the requirements for the award of the degree of Bachelor of Computer Applications, under the guidance of **Dr. Anita (Department of B.Voc. IT)** and **Prof. Chandana H. (Department of BCA)**.

The report describes the objectives, requirements, architecture, algorithmic design, computer vision biometric identity locking, multi-person proctoring state machine, high-clarity acoustic character synthesis, module implementations, and comprehensive testing of the system.

- **Signature of Guides:** Dr. Anita, Prof. Chandana H.  
- **Head of the Department:** Name: ______________  
- **Signature of Examiners:** 1. ______________ 2. ______________  
- **Examination Centre:** B.M.S. College for Women  
- **Date of Examination:** ____________________  

---

## ACKNOWLEDGEMENT

We express our sincere gratitude to our project guides, Dr. Anita of the Department of B.Voc. IT and Prof. Chandana H. of the Department of BCA, for their continuous guidance and valuable suggestions during the development of VisionAssist AI. We thank the Department of BCA and B.M.S. College for Women (Autonomous), Bengaluru, for providing the academic infrastructure and learning opportunities. We also acknowledge the open-source communities of React, Vite, Node.js, Express, MongoDB, and ElevenLabs.

**NAYANA N S**  
**LAKSHMI K**  

---

## DECLARATION

We, NAYANA N S (U18BP24S0023) and LAKSHMI K (U18BP24S0211), hereby declare that the project report entitled “VisionAssist AI – Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students” is a record of original project work carried out by us under the guidance of Dr. Anita and Prof. Chandana H., B.M.S. College for Women, Bengaluru.

---

## ABSTRACT

Visually impaired students frequently face severe barriers during competitive and university academic examinations. Traditional setups rely heavily on human scribes, leading to significant transcription errors, communication bottlenecks, scheduling delays, privacy compromises, and substantial financial overhead. VisionAssist AI is an end-to-end, AI-powered accessible examination and voice-guided assistive portal designed specifically to grant visually impaired examinees complete academic independence while ensuring uncompromised institutional security.

---

## TABLE OF CONTENTS

| SL.NO | PARTICULARS | PAGE NO. |
|---|---|---|
| 1. | Introduction<br>1.1 Literature Review<br>1.2 SDLC Model | 01–04<br>04<br>05 |
| 2. | System Requirement Specification<br>2.1 System requirement for development<br>2.2 System requirement for deployment<br>2.3 Language used<br>2.4 Tools used<br>2.5 Functional requirements<br>2.6 Non-functional requirements | 06–10<br>06<br>07<br>07<br>08<br>09<br>10 |
| 3. | Module Description<br>3.1 Modules (3.1.1 to 3.1.10)<br>3.2 Summary of API routes | 11–18<br>11<br>18 |
| 4. | System Design<br>4.1 System architecture<br>4.2 System workflows (Workflows A to E)<br>4.3 EER / ER diagram (Overview, Attributes, Tables)<br>4.4 Use case diagram<br>4.5 Activity diagram<br>4.6 DFD diagrams (Level 0 and Level 1)<br>4.7 Table description (7 Collections Schema) | 19–38<br>19<br>20<br>26<br>31<br>32<br>33<br>35 |
| 5. | Sample Coding<br>5.1–5.9 Client, server, and AI service architecture<br>5.10 Code 1: Biometric Face Verification & Proctoring Security Engine<br>5.11 Code 2: Voice Assistant Speech Synthesis & Acoustic Character Engine<br>5.12 Code 3: Live Teacher Proctoring Logs & Exam Security Controller | 39–51<br>39<br>46<br>48<br>50 |
| 6. | Testing<br>6.1 Testing methods<br>6.2 Test cases and verification (TC-01 to TC-24 complete table)<br>6.3 Test cases and validation | 52–56<br>52<br>53<br>56 |
| 7. | Screenshots (Figures 7.1 to 7.21) | 57–64 |
| 8. | Conclusion | 65 |
| 9. | Future Enhancement | 65 |
| 10. | Bibliography | 66 |

---

## 1. INTRODUCTION

### Project Overview
Academic assessments in contemporary educational institutions remain predominantly visual, relying upon printed question papers, computerized graphical user interfaces, optical bubble sheets, and manual scribes. For visually impaired students, this visual paradigm creates an almost insurmountable barrier to demonstrating true academic potential.

### Problem Statement
Visually impaired students encounter severe barriers: inaccessible graphical interfaces, transcription bottlenecks introduced by human scribes, absence of autonomous biometric verification, and vulnerability to false malpractice accusations.

### 1.1 Literature Review
Assistive technology for visually impaired learners has advanced from tactile Braille displays to intelligent multimodal conversational systems. VisionAssist AI builds upon W3C WCAG 2.1 AA standards and lightweight client-side computer vision.

### 1.2 SDLC Model
VisionAssist AI was engineered using the Agile Iterative & Incremental Software Development Life Cycle (SDLC) across six distinct sprints.

---

## 2. SYSTEM REQUIREMENT SPECIFICATION

### 2.1 Development & Deployment Requirements
- **Hardware:** Intel Core i3/i5, 8 GB RAM, 256 GB SSD, 720p/1080p Webcam, Microphone.
- **Software:** Windows 10/11 / Linux, Node.js 18+ LTS, MongoDB 7.x, Chrome/Edge.

### 2.2 Languages & Tools
| Component | Technology | Role |
|---|---|---|
| Client UI | react, react-dom ^18.3.1 | Component-based declarative accessible user interface. |
| Routing | react-router-dom ^6.26.0 | Client-side SPA navigation and protected role-based routing. |
| Build Tool | vite ^5.4.21 | Ultra-fast HMR development server and optimized production bundler. |
| Styling | tailwindcss ^3.4.10 | Utility-first design with high-contrast accessibility classes. |
| HTTP Client | axios ^1.7.4 | Promise-based REST API client with Bearer token interceptors. |
| Icons | lucide-react ^0.436.0 | Clean vector iconography for assistive interface indicators. |
| Server Framework | express ^4.19.2 | High-performance REST API microservice routing and controllers. |
| Database ODM | mongoose ^8.5.3 | MongoDB object modeling, schema validation, and index management. |
| Security | jsonwebtoken ^9.0.2 | Cryptographic stateless authentication token generation and verification. |
| Password Hashing | bcryptjs ^2.4.3 | One-way cryptographic salt and hashing (10 rounds) for credentials. |
| Security Headers | helmet ^7.1.0, cors ^2.8.5 | HTTP security headers, Content Security Policy, and CORS enforcement. |
| Rate Limiting | express-rate-limit ^7.4.0 | Brute-force password guessing defense on authentication routes. |

---

## 3. MODULE DESCRIPTION

### 3.1 Core Modules
1. **Authentication & Role Gate:** Secure JWT and bcrypt role-based access for Student, Teacher, and Administrator.
2. **Voice Profile Setup:** Hands-free auditory onboarding assigning candidate register number `202601100X`.
3. **Biometric Face Verification:** Compulsory camera gate matching live face with enrolled photo (threshold >= 50%).
4. **Multi-Person Vision Proctoring:** YCbCr skin chrominance tracking with perimeter boundary exclusion.
5. **Exam Audio Narrator & Dictation:** Automated acoustic question narration and voice answer transcription.
6. **Live Teacher Dashboard:** Real-time candidate telemetry, webcam status, and strike monitoring.
7. **Emergency SOS Assistance:** Auditory emergency trigger alerting invigilators with sound sirens.
8. **Timer & Disciplinary Exit:** Fair 2-strike warning escalation with automatic termination on strike 3.
9. **ElevenLabs Character Voice Engine:** 5 distinct voice personas (Rachel, Adam, Antoni, Bella, Domi).
10. **Instant Grading & Audio Feedback:** Automated scoring, percentage, and grade announcement.

### 3.2 Summary of REST API Routes

| Endpoint | Method | Access | Purpose |
|---|---|---|---|
| `/api/auth/register` | **POST** | Public (Rate-limited) | Creates new user account; hashes password via bcrypt. |
| `/api/auth/login` | **POST** | Public (Rate-limited) | Authenticates credentials and signs 7-day JWT token. |
| `/api/auth/me` | **GET** | Protected (JWT) | Returns current authenticated user identity and role. |
| `/api/student/profile` | **GET, POST** | Protected (Student) | Retrieves or updates student profile, subject, and photo. |
| `/api/student/biometric-enroll` | **POST** | Protected (Student) | Enrolls reference facial vector from official photo. |
| `/api/exams` | **GET, POST** | Protected (JWT) | Lists active exams for students or creates exam for teachers. |
| `/api/exams/:id` | **GET, DELETE** | Protected (JWT) | Fetches exam details/questions or deletes exam. |
| `/api/exams/:id/submit` | **POST** | Protected (Student) | Submits completed exam answers and triggers evaluation. |
| `/api/proctor/log` | **POST** | Protected (Student) | Dispatches live proctoring telemetry packet to teacher hub. |
| `/api/proctor/live-feed` | **GET** | Protected (Teacher) | Streams real-time candidate monitoring status and snapshots. |
| `/api/assistance/sos` | **POST** | Protected (Student) | Triggers emergency SOS alert notifying teachers. |
| `/api/assistance/respond` | **POST** | Protected (Teacher) | Dispatches teacher resolution message to student narrator. |
| `/api/tts/speak` | **POST** | Public / Proxy | ElevenLabs neural speech synthesis proxy endpoint. |
| `/api/tts/status` | **GET** | Public | Checks server ElevenLabs API key availability. |

---

## 4. SYSTEM DESIGN

### 4.1 System Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                     VISUALLY IMPAIRED EXAMINEE                                    |
|                         (Web Speech Audio Dictation, Headset Audio Narrator)                      |
+---------------------------------------------------------------------------------------------------+
                                                 │ ▲ (Hands-Free Voice / Audio Feedback)
                                                 ▼ │
+---------------------------------------------------------------------------------------------------+
|                                CLIENT TIER: REACT.JS + VITE SPA                                   |
|  • Pages: Login, Voice Assistant, Student Dashboard, Exam Hall, Teacher Monitor, Admin Hub        |
|  • Speech Engine: Unified speech.js (ElevenLabs + Browser Character Voices: Rachel/Adam/Bella)    |
|  • Local AI Proctor: Offscreen HTML5 Canvas, Pearson Biometrics, YCbCr Chroma Multi-Person       |
|  • State Mutex: Single-Channel Audio Controller, HDMI Audio Listener, Strike Counter             |
+---------------------------------------------------------------------------------------------------+
                                                 │ ▲ (HTTPS / RESTful JSON / Bearer JWT)
                                                 ▼ │
+---------------------------------------------------------------------------------------------------+
|                             APPLICATION TIER: NODE.JS & EXPRESS REST API                          |
|  • Middleware: helmet, cors, express.json, express-rate-limit, authMiddleware (JWT Verification)  |
|  • Controllers: authController, examController, proctorController, assistanceController, ttsProxy |
+---------------------------------------------------------------------------------------------------+
                         │ ▲                                         │ ▲
                         ▼ │                                         ▼ │
+----------------------------------+        +-------------------------------------------------------+
|    PERSISTENCE TIER: MONGODB     |        |              EXTERNAL NEURAL SERVICES                 |
|  • users (Credentials & Roles)   |        |  • ElevenLabs Cloud TTS API (High-Fidelity Voices)    |
|  • studentprofiles (Biometrics)  |        |  • Web Speech Synthesis & Recognition API             |
|  • exams (Questions & Timers)    |        |  • Chromium Native Shape Detection / FaceDetector     |
|  • liveproctorlogs (Telemetry)   |        +-------------------------------------------------------+
|  • studentanswers (Submissions)  |
|  • notifications & audiosettings |
+----------------------------------+
```

### 4.2 Workflows

```
  [Start] ──► Open Portal ──► Check Auth Session?
                 │                     │
             (No Session)          (Valid JWT)
                 ▼                     ▼
          Role Login Page       Role Dashboard
          (Voice or Text)        (Student / Teacher / Admin)
                 │                     │
                 └───► Authenticate ───┘
                             │
                             ▼
                     Select Scheduled Exam
                             │
                             ▼
               [Biometric Identity Gate]
               (Match Live Face with Photo)
                    │                 │
                 (>= 50%)          (< 50%)
                    │                 ▼
                    │          Access Blocked (Audio Alert)
                    ▼
             Enter Exam Hall ◄─── Continuous Proctoring Active
                    │
             Narration & Voice Answers
                    │
             Submit Exam ──► Instant Grading & Telemetry Log ──► [End]


  [Start Live Video] ──► Extract 32x24 Canvas Grid Features
                                     │
                                     ▼
                       Compute Pearson Correlation (r)
                       Against Enrolled Profile Photo
                                     │
                   ┌─────────────────┴─────────────────┐
                   ▼                                   ▼
             Match >= 50%                         Match < 50%
                   │                                   ▼
            [Identity Locked]                  Face Mismatch Alert
            Enter Active Exam                 Access Denied (Audio)
                   │
                   ▼
        [Continuous Proctoring: 600ms Cycle]
        Check: Presence & Secondary Persons
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
  Single Candidate       Intruder Detected / Candidate Absent
  Writing Alone (OK)           │
                               ▼
                       Increment Strike Ticks
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
          [Strike 1]      [Strike 2]      [Strike 3]
         Warning 1 of 2  Final Warning 2  Auto-Terminate Exam
         (Audio & Modal) (Audio & Modal)  Zero Score Submittal
                                          Exit to Dashboard [End]
```

### 4.3 EER / ER Diagram

```
                               +---------------------------------+
                               |              users              |
                               +---------------------------------+
                                  │ 1            │ 1           │ 1
                                  │              │             │
                            (has) │        (submits)     (logs)│
                                  ▼ 0..1         ▼ N           ▼ N
+-----------------------+      +---------------+  +---------------+  +-------------------+
|     audiosettings     |◄─────┤studentprofiles|  | studentanswers|  |  liveproctorlogs  |
+-----------------------+ (1:1)+---------------+  +---------------+  +-------------------+
                                  │ 1                    │ N                 │ N
                                  │                      │                   │
                           (takes)│             (evals)  │             (for) │
                                  ▼ N                    ▼ 1                 ▼ 1
                               +---------------------------------------------------------+
                               |                          exams                          |
                               +---------------------------------------------------------+
                                                          ▲ 1
                                                          │
                                                    (triggers)│ N
                                                          ▼
                                               +---------------------+
                                               |    notifications    |
                                               +---------------------+
```

#### 4.3.1 Entity Descriptions

| Entity | Primary Key | Description |
|---|---|---|
| **users** | `_id (ObjectId)` | Stores login credentials, full name, role (student/teacher/admin), and account status. |
| **studentprofiles** | `_id (ObjectId)` | Holds candidate sequential register number, enrolled biometric facial vector, and subject. |
| **exams** | `_id (ObjectId)` | Contains exam papers authored by teachers, question arrays, durations, and answer keys. |
| **liveproctorlogs** | `_id (ObjectId)` | Maintains live invigilation telemetry, webcam snapshots, violation types, and strike counts. |
| **studentanswers** | `_id (ObjectId)` | Stores submitted answers, spoken speech transcripts, scores, and grade evaluations. |
| **notifications** | `_id (ObjectId)` | Handles emergency SOS alerts, teacher broadcast announcements, and assistance logs. |
| **audiosettings** | `_id (ObjectId)` | Manages user voice preferences, ElevenLabs voice IDs, acoustic pitch, and speech rates. |

#### 4.3.2 Relationship Descriptions

| Relationship | Implementation | Cardinality |
|---|---|---|
| users - studentprofiles (has) | `studentprofiles.userId -> users._id (Unique reference)` | 1 : 0..1 (One-to-One) |
| users - liveproctorlogs (logs) | `liveproctorlogs.userId -> users._id` | 1 : N (One-to-Many) |
| users - studentanswers (submits) | `studentanswers.userId -> users._id` | 1 : N (One-to-Many) |
| exams - studentanswers (evals) | `studentanswers.examId -> exams._id` | 1 : N (One-to-Many) |
| exams - liveproctorlogs (for) | `liveproctorlogs.examId -> exams._id` | 1 : N (One-to-Many) |
| studentprofiles - audiosettings | `audiosettings.userId -> studentprofiles.userId` | 1 : 1 (One-to-One) |
| exams - notifications (triggers) | `notifications.examId -> exams._id` | 1 : N (One-to-Many) |

### 4.4 Use Case Diagram

```
  +-----------------------------------------------------------------------------------------+
  |                                   VISIONASSIST AI SYSTEM                                |
  |                                                                                         |
  |   (( Hands-Free Voice Login )) ◄────────────── [Student]                                |
  |   (( Setup Voice Profile )) ◄───────────────── [Student]                                |
  |   (( Biometric Face Verification )) ◄───────── [Student] ──► (HTML5 Camera API)         |
  |   (( Take Online Exam )) ◄──────────────────── [Student]                                |
  |   (( Submit Voice Answer )) ◄───────────────── [Student] ──► (Web Speech API)           |
  |   (( Trigger Emergency SOS )) ◄─────────────── [Student] ──► [Teacher]                  |
  |                                                                                         |
  |   (( Author & Schedule Exam )) ◄────────────── [Teacher]                                |
  |   (( Live Candidate Monitoring )) ◄─────────── [Teacher]                                |
  |   (( Review Proctoring Strikes )) ◄─────────── [Teacher]                                |
  |   (( Respond to Student SOS )) ◄────────────── [Teacher]                                |
  |                                                                                         |
  |   (( Manage Users & System Health )) ◄──────── [Administrator]                          |
  |   (( Audit System Proctoring Logs )) ◄──────── [Administrator]                          |
  +-----------------------------------------------------------------------------------------+
```

### 4.5 Data Flow Diagrams (DFDs)

```
                    [Student / Examinee]
                        │ ▲ (Voice Answers, SOS Requests)
                        ▼ │ (Audio Questions, Alerts, Grades)
             +───────────────────────────────────────+
             |                  0                    |
             |          VISIONASSIST AI              |
             |     ACCESSIBLE EXAMINATION SYSTEM     |
             +───────────────────────────────────────+
                        │ ▲ (Live Telemetry, Strikes, Exam Papers)
                        ▼ │ (Exam Creation, SOS Responses)
                    [Teacher / Invigilator]
```

### 4.6 Database Collections Schema (Table Descriptions)

#### 1. `users` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Unique MongoDB document identifier. |
| `name` | String | Required, Trimmed | Full name of the user (e.g., 'Nayana N S'). |
| `email` | String | Required, Unique, Lowercase | Unique login email address. |
| `password` | String | Required, Min 6 | bcrypt cryptographic password hash. |
| `role` | String | Enum: student/teacher/admin | User permission level governing dashboard access. |
| `createdAt, updatedAt` | Date | Automatic | System creation and modification timestamps. |

#### 2. `studentprofiles` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Unique profile record identifier. |
| `userId` | ObjectId (ref User) | Required, Unique | Foreign reference to users._id. |
| `registerNumber` | String | Required, Unique | 10-digit sequential candidate ID (202601100X). |
| `profilePic` | String (Data URL) | Required | Base64 JPEG enrolled reference photograph. |
| `interestedSubject` | String | Default: Computer Science | Candidate's focused academic subject. |
| `biometricVector` | Array of Number | Optional | 768-element normalized facial luminance template. |

#### 3. `exams` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Unique examination identifier. |
| `title` | String | Required, Trimmed | Exam title (e.g., 'Database Systems & AI'). |
| `subject` | String | Required | Curricular subject (e.g., 'Computer Science'). |
| `durationMinutes` | Number | Default: 60 | Total allotted examination time in minutes. |
| `questions` | Array of Object | Required, Min 1 | List of questions with text, options, correctIndex, marks. |
| `teacherEmail` | String | Required | Email of authoring teacher for live telemetry routing. |

#### 4. `liveproctorlogs` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Log entry identifier. |
| `studentName` | String | Required | Candidate display name. |
| `examId` | ObjectId (ref Exam) | Required | Active exam reference. |
| `faceVerified` | Boolean | Required | Biometric face verification status. |
| `strikeCount` | Number | Default: 0, Max: 3 | Accumulated malpractice strike count. |
| `violationType` | String | Optional | Reason: 'face_absent', 'multiple_people', 'face_mismatch'. |
| `faceSnapshot` | String (Data URL) | Optional | Webcam JPEG thumbnail for teacher verification. |

#### 5. `studentanswers` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Submission record identifier. |
| `userId` | ObjectId (ref User) | Required | Submitting student identifier. |
| `examId` | ObjectId (ref Exam) | Required | Associated exam identifier. |
| `answers` | Map of Number | Required | Mapping of questionIndex to selectedOptionIndex. |
| `score` | Number | Required | Computed total marks obtained. |
| `percentage` | Number | Required | Calculated percentage score. |
| `grade` | String | Required | Assigned academic letter grade (A+, A, B, F). |

#### 6. `notifications` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Notification identifier. |
| `type` | String | Required | Alert type: 'Emergency SOS', 'Teacher Broadcast'. |
| `title` | String | Required | Summary heading displayed on teacher console. |
| `detail` | String | Required | Detailed message body or candidate request. |
| `read` | Boolean | Default: false | Resolution status flag. |

#### 7. `audiosettings` Collection Schema

| Field | Type | Constraint | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key, Auto | Audio configuration identifier. |
| `userId` | ObjectId (ref User) | Required, Unique | Associated user identifier. |
| `voiceId` | String | Default: Rachel ID | ElevenLabs voice ID or character profile key. |
| `pitch` | Number | Default: 1.0 | Acoustic synthesis frequency modifier (0.5 to 2.0). |
| `rate` | Number | Default: 0.88 | Speech speed modifier (0.65 to 1.3). |
| `volume` | Number | Default: 1.0 | Sound playback amplitude multiplier. |

---

## 5. SAMPLE CODING (EXACTLY 3 CRITICAL PRODUCTION CODES)

### 5.10 Code 1: Biometric Face Verification & Proctoring Security Engine

```javascript
// ==========================================================================================
// CRITICAL PRODUCTION CODE 1: BIOMETRIC IDENTITY VERIFICATION & PROCTORING ENGINE
// File: Frontend/src/components/StudentDashboard.jsx (Authors: Nayana N S & Lakshmi K)
// ==========================================================================================

// 1. Mean-Centered Pearson Biometric Correlation Analysis
export const computeBiometricSimilarity = (biomA, biomB) => {
  if (!biomA || !biomB) return 0;
  const gA = Array.isArray(biomA) ? biomA : biomA.grid;
  const gB = Array.isArray(biomB) ? biomB : biomB.grid;
  if (!gA || !gB || gA.length !== gB.length) return 0;

  const mA = gA.reduce((s, v) => s + v, 0) / gA.length;
  const mB = gB.reduce((s, v) => s + v, 0) / gB.length;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < gA.length; i++) {
    const diffA = gA[i] - mA;
    const diffB = gB[i] - mB;
    num += diffA * diffB;
    dA += diffA * diffA;
    dB += diffB * diffB;
  }
  let pearson = (dA > 0 && dB > 0) ? (num / Math.sqrt(dA * dB)) : 0;
  return Math.min(1.0, Math.max(0, pearson));
};

// 2. Multi-Person YCbCr Skin Chroma Segmentation with Perimeter Boundary Filtering
export const detectPeopleInCanvas = async (canvas) => {
  if (!canvas) return { count: 0, isMultiple: false, isPresent: false };
  const W = canvas.width || 320, H = canvas.height || 240;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, W, H).data;
  const cols = 32, rows = 24;
  const cellW = Math.floor(W / cols), cellH = Math.floor(H / rows);
  const skinGrid = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let cellSkin = 0, cellCount = 0;
      for (let py = r * cellH; py < (r + 1) * cellH; py += 3) {
        for (let px = c * cellW; px < (c + 1) * cellW; px += 3) {
          const idx = (py * W + px) * 4;
          const red = imgData[idx], green = imgData[idx + 1], blue = imgData[idx + 2];
          cellCount++;
          const cb = -0.168736 * red - 0.331264 * green + 0.5 * blue + 128;
          const cr = 0.5 * red - 0.418688 * green - 0.081312 * blue + 128;
          if (cb >= 85 && cb <= 128 && cr >= 136 && cr <= 176 && red > 55 && red > green) cellSkin++;
        }
      }
      if (cellCount > 0 && (cellSkin / cellCount) >= 0.38) skinGrid[r * cols + c] = 1;
    }
  }

  // Connected Component Analysis on Upper Frame (Excluding hands & desks)
  const searchMaxRow = Math.floor(rows * 0.65);
  const visited = new Uint8Array(cols * rows);
  const headCandidates = [];
  for (let r = 0; r < searchMaxRow; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (skinGrid[idx] === 1 && !visited[idx]) {
        const queue = [[c, r]]; visited[idx] = 1;
        let minC = c, maxC = c, minR = r, maxR = r, sumC = 0, sumR = 0, count = 0;
        while (queue.length > 0) {
          const [curC, curR] = queue.shift(); count++; sumC += curC; sumR += curR;
          if (curC < minC) minC = curC; if (curC > maxC) maxC = curC;
          if (curR < minR) minR = curR; if (curR > maxR) maxR = curR;
          for (const [nc, nr] of [[curC+1, curR], [curC-1, curR], [curC, curR+1], [curC, curR-1]]) {
            if (nc >= 0 && nc < cols && nr >= 0 && nr < searchMaxRow && !visited[nr * cols + nc] && skinGrid[nr * cols + nc]) {
              visited[nr * cols + nc] = 1; queue.push([nc, nr]);
            }
          }
        }
        if (count >= 20 && (maxC - minC + 1) >= 4) headCandidates.push({ count, centerCol: sumC / count, centerRow: sumR / count, minC, maxC });
      }
    }
  }
  headCandidates.sort((a, b) => b.count - a.count);
  if (headCandidates.length === 0) return { count: 0, isMultiple: false, isPresent: false };

  const primaryHead = headCandidates[0];
  let multiplePeople = false;
  for (let i = 1; i < headCandidates.length; i++) {
    const sec = headCandidates[i];
    // Filter out wardrobe doors, wall posters at extreme edges (col <= 2 or >= 29)
    if (sec.minC <= 2 || sec.maxC >= 29) continue;
    const hDist = Math.abs(primaryHead.centerCol - sec.centerCol);
    const vDist = Math.abs(primaryHead.centerRow - sec.centerRow);
    if (sec.count >= 48 && sec.count >= primaryHead.count * 0.65 && sec.centerCol >= 4 && sec.centerCol <= 27 && vDist <= 6 && hDist >= 11) {
      multiplePeople = true; break;
    }
  }
  return { count: multiplePeople ? 2 : 1, isMultiple: multiplePeople, isPresent: true };
};

```

### 5.11 Code 2: Voice Assistant Speech Synthesis & Acoustic Character Profiles

```javascript
// ==========================================================================================
// CRITICAL PRODUCTION CODE 2: ACOUSTIC VOICE ASSISTANT & CHARACTER PROFILES
// File: Frontend/src/components/speech.js (Authors: Nayana N S & Lakshmi K)
// ==========================================================================================

// Acoustic Voice Character Profiles for Adaptive Pitch and Natural Timbre
export const VOICE_PROFILES = {
  'pNInz6obpgDQGcFmaJgB': { name: 'Adam', gender: 'Male', basePitch: 0.74, baseRate: 0.88, preferredVoices: ['David', 'Mark', 'Guy', 'Male'] },
  'ErXwobaYiN019PkySvjV': { name: 'Antoni', gender: 'Male', basePitch: 0.94, baseRate: 0.90, preferredVoices: ['David', 'Mark', 'Guy', 'Male'] },
  'EXAVITQu4vr4xnSDxMaL': { name: 'Bella', gender: 'Female', basePitch: 1.16, baseRate: 0.86, preferredVoices: ['Zira', 'Samantha', 'Jenny', 'Female'] },
  'AZnzlk1XvdvUeBnXmlld': { name: 'Domi', gender: 'Female', basePitch: 1.26, baseRate: 1.02, preferredVoices: ['Aria', 'Jenny', 'Zira', 'Female'] },
  '21m00Tcm4TlvDq8ikWAM': { name: 'Rachel', gender: 'Female', basePitch: 1.00, baseRate: 0.88, preferredVoices: ['Jenny', 'Zira', 'Samantha', 'Female'] }
};

let currentSpeechToken = 0;
let cachedNonGoogleVoices = [];

function refreshNonGoogleVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  cachedNonGoogleVoices = (window.speechSynthesis.getVoices() || []).filter(v => {
    const n = (v.name || '').toLowerCase();
    return !n.includes('google'); // Strictly eliminate distorted Google TTS voices
  });
  return cachedNonGoogleVoices;
}

export function speakBrowserSpeech(text, lang = 'en-US', options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel(); // Single audio mutex: eliminate dual-voice overlap
  const myToken = ++currentSpeechToken;

  const activeVoiceId = options.voiceId || localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';
  const profile = VOICE_PROFILES[activeVoiceId] || VOICE_PROFILES['21m00Tcm4TlvDq8ikWAM'];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = options.rate !== undefined ? options.rate : profile.baseRate;
  utterance.pitch = options.pitch !== undefined ? options.pitch : profile.basePitch;

  const available = cachedNonGoogleVoices.length ? cachedNonGoogleVoices : refreshNonGoogleVoices();
  let chosen = null;
  for (const kw of profile.preferredVoices) {
    chosen = available.find(v => v.name.toLowerCase().includes(kw.toLowerCase()) && v.lang.startsWith('en'));
    if (chosen) break;
  }
  if (!chosen) {
    chosen = profile.gender === 'Male'
      ? available.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('male'))
      : available.find(v => v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('female'));
  }
  if (chosen) utterance.voice = chosen;

  utterance.onend = () => { if (options.onEnd && myToken === currentSpeechToken) options.onEnd(); };
  setTimeout(() => {
    if (myToken === currentSpeechToken) {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }
  }, 40);
  return true;
}

export async function speakIn(text, lang = 'en-US', options = {}) {
  const config = JSON.parse(localStorage.getItem('elevenlabs_config') || '{}');
  if (config.apiKey && config.enabled !== false) {
    try {
      const ok = await speakWithElevenLabs(text, options);
      if (ok) return true;
    } catch (e) {}
  }
  return speakBrowserSpeech(text, lang, options);
}

```

### 5.12 Code 3: Live Proctoring Strike Controller & Teacher Telemetry Hub

```javascript
// ==========================================================================================
// CRITICAL PRODUCTION CODE 3: 2-WARNING PROCTORING ESCALATION & TEACHER TELEMETRY HUB
// File: Frontend/src/components/StudentDashboard.jsx & backend (Authors: Nayana N S & Lakshmi K)
// ==========================================================================================

// Unified Proctor Strike Controller (Runs inside 600ms proctor evaluation interval)
const evaluateProctorViolation = (isViolation, violationType, details) => {
  const now = Date.now();
  if (!isViolation) {
    consecutiveMismatchTicksRef.current = 0;
    setIsScannedStudentWriting(true);
    setIsOtherPersonDetected(false);
    return;
  }

  consecutiveMismatchTicksRef.current++;
  setIsScannedStudentWriting(false);
  setIsOtherPersonDetected(true);

  const cooldown = faceMismatchStrikeCountRef.current === 0 ? 0 : 3500;
  if (consecutiveMismatchTicksRef.current >= 3 && (now - lastMismatchAlertTimeRef.current >= cooldown)) {
    lastMismatchAlertTimeRef.current = now;

    // === ALERT 1 OF 2 ===
    if (faceMismatchStrikeCountRef.current === 0) {
      faceMismatchStrikeCountRef.current = 1;
      setFaceMismatchStrikeCount(1);
      const warn1 = `Alert 1 of 2: Security violation detected: ${details.msg}. On the 3rd violation, your exam will exit!`;
      speakText(warn1);
      setFaceMismatchActiveAlert({ strike: 1, title: 'WARNING 1 OF 2', message: details.msg });
      dispatchTelemetryToTeacher(1, details.msg);
    }
    // === ALERT 2 OF 2 (FINAL WARNING) ===
    else if (faceMismatchStrikeCountRef.current === 1) {
      faceMismatchStrikeCountRef.current = 2;
      setFaceMismatchStrikeCount(2);
      const warn2 = `Final warning. Alert 2 of 2: Malpractice detected! If not corrected immediately, your exam will be terminated!`;
      speakText(warn2);
      setFaceMismatchActiveAlert({ strike: 2, title: 'FINAL WARNING (2 OF 2)', message: details.msg });
      dispatchTelemetryToTeacher(2, details.msg);
    }
    // === 3RD TIME: AUTO-TERMINATE EXAM & EXIT TO DASHBOARD ===
    else if (faceMismatchStrikeCountRef.current >= 2) {
      faceMismatchStrikeCountRef.current = 3;
      if (proctorScanIntervalRef.current) clearInterval(proctorScanIntervalRef.current);
      stopCameraForFaceAuth();
      const termMsg = 'Exam terminated and exited. You received 2 prior warnings. Submitting zero score now.';
      speakText(termMsg);
      dispatchTelemetryToTeacher(3, 'TERMINATED: 3rd strike malpractice exit');
      // Submit Zero Score Disciplinary Record
      API.post(`/exams/${currentExam.id}/submit`, { answers: {}, score: 0, terminatedDueToMalpractice: true })
        .finally(() => {
          setCurrentExam(null);
          setActiveTab('Dashboard');
        });
    }
  }
};

// Telemetry Dispatcher synchronizing active session with Teacher Live Dashboard
const dispatchTelemetryToTeacher = (strikeCount, statusMessage) => {
  const packet = {
    student: student.name,
    examTitle: currentExam?.title || '',
    strikeCount,
    statusBadge: strikeCount >= 3 ? '⛔ TERMINATED' : strikeCount > 0 ? `🔴 ALERT ${strikeCount}/2` : '🟢 Verified',
    statusMessage,
    remaining: `${Math.floor(examTimeRemaining / 60)}m`,
    timestamp: new Date().toLocaleTimeString()
  };
  const existing = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
  localStorage.setItem('shared_live_logs', JSON.stringify([packet, ...existing.filter(l => l.student !== student.name)]));
  window.dispatchEvent(new Event('storage'));
};

```

---

## 6. TESTING & VERIFICATION

### 6.1 Test Cases (TC-01 to TC-24)

| ID | Module | Test Scenario | Input | Expected Result | Status |
|---|---|---|---|---|---|
| **TC-01** | Auth | New candidate registration | Name, unique email, 6+ char password | User created, bcrypt salt=10, 201 response with JWT | **Verified & Passed** |
| **TC-02** | Auth | Registration with missing fields | Empty password field | 400 Bad Request: 'Please provide all fields' | **Verified & Passed** |
| **TC-03** | Auth | Duplicate email registration | Existing candidate email | 400 Bad Request: 'User already exists' | **Verified & Passed** |
| **TC-04** | Auth | Standard candidate login | Valid registered email and password | 200 OK, JWT stored, opens Student Dashboard | **Verified & Passed** |
| **TC-05** | Auth | Invalid password attempt | Valid email, incorrect password | 401 Unauthorized: 'Invalid email or password' | **Verified & Passed** |
| **TC-06** | Auth | Protected route security | Direct URL access without JWT header | 401 Unauthorized; redirects to /login | **Verified & Passed** |
| **TC-07** | Voice | Hands-free voice login | Spoken phrase 'login nayana password 123' | Speech transcribed, authenticated, opens portal | **Verified & Passed** |
| **TC-08** | Profile | Voice setup wizard | Spoken name 'Nayana N S', subject 'CS' | Sequential reg number 2026011001 assigned | **Verified & Passed** |
| **TC-09** | Profile | Webcam profile photo enrollment | Click 'Capture Photo' in profile modal | Photo saved, biometric feature vector enrolled | **Verified & Passed** |
| **TC-10** | Profile | Persistent photo across logins | Logout and re-login to dashboard | Profile photo preserved (no wipe in localStorage) | **Verified & Passed** |
| **TC-11** | Biometrics | Pre-exam face verification match | Registered student aligned in oval (>= 50%) | Identity locked 100%, advances to exam hall | **Verified & Passed** |
| **TC-12** | Biometrics | Pre-exam face mismatch gate | Unregistered person in camera (< 50%) | Access blocked: 'Face Mismatch Cannot Write Exam' | **Verified & Passed** |
| **TC-13** | Biometrics | Candidate missing from oval | Examinee steps away from camera | Scan paused: 'Align face inside camera circle' | **Verified & Passed** |
| **TC-14** | Biometrics | Missing profile photo gate | Candidate with no enrolled photo | Blocked: 'Official Profile Photo Required' | **Verified & Passed** |
| **TC-15** | Proctoring | Single examinee writing exam | Candidate writing alone in center frame | Green badge: 'Verified: Nayana N S', 0 strikes | **Verified & Passed** |
| **TC-16** | Proctoring | Wardrobe door background filter | Candidate sits in front of wooden wardrobe | Wardrobe edge filtered out (col <= 2), 0 false alarms | **Verified & Passed** |
| **TC-17** | Proctoring | Intruder entered camera view | Second individual stands beside candidate | Flags multi-person: 'MULTIPLE PEOPLE DETECTED' | **Verified & Passed** |
| **TC-18** | Proctoring | Violation Alert 1 of 2 | Intruder present for 3 consecutive ticks | Audio Alert 1/2 announced, warning modal shown | **Verified & Passed** |
| **TC-19** | Proctoring | Violation Alert 2 of 2 (Final) | Intruder remains present after 3.5s cooldown | Final Alert 2/2 announced, high-priority modal | **Verified & Passed** |
| **TC-20** | Proctoring | Strike 3 Automatic Termination | 3rd malpractice violation detected | Camera stops, zero score submitted, exits to dashboard | **Verified & Passed** |
| **TC-21** | Speech | Question audio narration | Exam hall loads Question 1 | Question and 4 options read aloud in clear speech | **Verified & Passed** |
| **TC-22** | Speech | Voice character selection | Switch to 'Adam' (Deep Male voice) | Speaks preview in deep male voice (pitch 0.74) | **Verified & Passed** |
| **TC-23** | SOS | Emergency SOS assistance trigger | Candidate clicks or speaks 'SOS Help' | Dispatches alert to Teacher Hub with audible siren | **Verified & Passed** |
| **TC-24** | Teacher | Live proctoring telemetry sync | Candidate writing active exam | Teacher dashboard displays live snapshot & strike count | **Verified & Passed** |

---

## 7. SCREENSHOTS (FIGURES 7.1 TO 7.21)

- **Figure 7.1:** Screen 1 caption and detailed user interface verification.
- **Figure 7.2:** Screen 2 caption and detailed user interface verification.
- **Figure 7.3:** Screen 3 caption and detailed user interface verification.
- **Figure 7.4:** Screen 4 caption and detailed user interface verification.
- **Figure 7.5:** Screen 5 caption and detailed user interface verification.
- **Figure 7.6:** Screen 6 caption and detailed user interface verification.
- **Figure 7.7:** Screen 7 caption and detailed user interface verification.
- **Figure 7.8:** Screen 8 caption and detailed user interface verification.
- **Figure 7.9:** Screen 9 caption and detailed user interface verification.
- **Figure 7.10:** Screen 10 caption and detailed user interface verification.
- **Figure 7.11:** Screen 11 caption and detailed user interface verification.
- **Figure 7.12:** Screen 12 caption and detailed user interface verification.
- **Figure 7.13:** Screen 13 caption and detailed user interface verification.
- **Figure 7.14:** Screen 14 caption and detailed user interface verification.
- **Figure 7.15:** Screen 15 caption and detailed user interface verification.
- **Figure 7.16:** Screen 16 caption and detailed user interface verification.
- **Figure 7.17:** Screen 17 caption and detailed user interface verification.
- **Figure 7.18:** Screen 18 caption and detailed user interface verification.
- **Figure 7.19:** Screen 19 caption and detailed user interface verification.
- **Figure 7.20:** Screen 20 caption and detailed user interface verification.
- **Figure 7.21:** Screen 21 caption and detailed user interface verification.

---

## 8. CONCLUSION

VisionAssist AI successfully demonstrates that modern artificial intelligence, computer vision, and speech synthesis can dismantle long-standing accessibility barriers for visually impaired students in higher education while upholding institutional integrity.

## 9. FUTURE ENHANCEMENT

1. Regional Language Voice Recognition (Kannada, Hindi, Tamil).
2. Edge AI on-device compilation.
3. LaTeX and symbolic equation verbal dictation.
4. Bluetooth refreshable Braille hardware displays.

## 10. BIBLIOGRAPHY

- W3C Web Accessibility Initiative (WAI). (2021). 'Web Content Accessibility Guidelines (WCAG) 2.1.' https://www.w3.org/TR/WCAG21/
- Ding, X., et al. (2021). 'Voice User Interfaces in Assistive Education for the Visually Impaired.' ACM Transactions on Accessible Computing, 14(3), 1-28.
- Prathish, S., et al. (2020). 'Automated Online Exam Proctoring Using Deep Visual Tracking.' IEEE Access, 8, 120150-120162.
- React Official Documentation. (2024). 'React 18 & Accessible Single Page Architecture.' https://react.dev/
- MDN Web Docs. (2024). 'Web Speech API: SpeechRecognition and SpeechSynthesis Interfaces.' Mozilla Developer Network.
- Node.js Foundation. (2024). 'Node.js v20 LTS Microservice Architecture.' https://nodejs.org/docs/
- Express.js Documentation. (2024). 'Fast, Unopinionated, Minimalist Web Framework for Node.js.' https://expressjs.com/
- MongoDB Inc. (2024). 'MongoDB Manual: Document Schema Design and Index Optimization.' https://www.mongodb.com/docs/manual/
- Mongoose ODM Documentation. (2024). 'Mongoose Schemas, Validation, and Population.' https://mongoosejs.com/docs/
- ElevenLabs AI. (2024). 'Neural Text to Speech API: High-Fidelity Voice Synthesis.' https://elevenlabs.io/docs/
- Bradski, G., & Kaehler, A. (2008). 'Learning OpenCV: Computer Vision with the OpenCV Library.' O'Reilly Media.
- Chai, D., & Ngan, K. N. (1999). 'Face Segmentation Using Skin Color Map in Videophone Applications.' IEEE Trans. Circuits Syst. Video Technol., 9(4), 551-564.
