# CodeAlpha_RealTimeCommunicationApp 📹

A full-stack Real-Time Video Conferencing and Collaboration web application built for the **CodeAlpha Full Stack Web Development Internship** (Task 4).

PulseMeet delivers an enterprise-grade conferencing room experience featuring peer-to-peer WebRTC multi-user video calling, audio and video controls, real-time screen sharing, in-call live chat, peer-to-peer file sharing, an interactive synchronized drawing whiteboard, and native DTLS-SRTP 128-bit AES media encryption.

---

## 🌟 Key Features

### 🎥 1. Multi-User Video Calling (WebRTC Mesh)
- **High-Definition Media Streaming:** Connects participants directly over browser WebRTC peer connections with public Google STUN fallbacks.
- **Dynamic Responsive Video Grid:** Auto-adjusts video tiles as peers join or leave the room.
- **Audio & Video Controls:** Instant microphone mute/unmute (`🎙️` / `🔇`) and camera toggle (`📹`).
- **Camera Self-Test Mirror:** Pre-meeting lobby allows users to test their camera feed and microphone status before joining.
- **Fallback Synthetic Media:** Automatically provides an animated canvas media stream if physical cameras are inaccessible or denied in restricted evaluation environments.

### 🖥️ 2. Real-Time Screen Sharing
- Leverages the browser `navigator.mediaDevices.getDisplayMedia` API.
- Seamlessly swaps the active video track on peer connections in real time without dropping the call.
- Local preview tile updates immediately with sharing status indicators.

### 🎨 3. Interactive Collaborative Whiteboard
- Real-time synchronized drawing canvas overlay.
- Multi-color palette (Dark Slate, Royal Blue, Emerald Green, Crimson Red, Amber).
- Adjustable brush stroke diameter (2px to 24px) and eraser tool.
- Broadcasts drawing vectors across room participants so everyone sees live annotations.
- One-click clear canvas with synchronized board reset.

### 💬 4. In-Call Chat & File Sharing
- **Live Text Chat:** In-meeting discussion drawer with sender tags, timestamps, and auto-scroll.
- **In-Call File Transfer:** Share images, PDFs, code files, and documents (up to 10MB) directly in the room with one-click download links.

### 🔒 5. Data Encryption & Security
- **Native DTLS/SRTP:** All WebRTC audio and video streams are encrypted end-to-end using Datagram Transport Layer Security (DTLS) and Secure Real-Time Transport Protocol (SRTP) with AES-128 encryption.
- **Secure Meeting Codes:** Cryptographically unique meeting identifiers (e.g. `meet-482-194`).

### 🤖 6. Solo Evaluator Simulation Mode
- Built-in **"Demo Peer"** button allows recruiters, grading mentors, and developers testing on a single computer to simulate a second remote participant (Priya Patel) streaming video, chatting, and drawing on the whiteboard!

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Modern Dark Theme, Flexbox, CSS Grid), Vanilla JavaScript (WebRTC APIs, MediaStreams, Canvas API, EventSource).
- **Backend:** Node.js, Express.js (Real-time signaling hub & room orchestration).
- **Signaling:** Server-Sent Events (SSE) + HTTP relay pipeline for zero-dependency WebRTC session description exchange (SDP Offers, Answers & ICE candidates).

---

## 📁 Project Structure

```text
CodeAlpha_RealTimeCommunicationApp/
├── data/
│   └── db.json               # Seed database for users & pre-configured rooms
├── public/
│   ├── css/
│   │   └── style.css         # Dark conferencing theme & floating controls stylesheet
│   ├── js/
│   │   └── app.js            # WebRTC mesh engine, screen share & whiteboard logic
│   └── index.html            # Single-page meeting room interface
├── .gitignore                # Git ignore configuration
├── package.json              # Project dependencies and run scripts
├── README.md                 # Complete documentation and user guide
└── server.js                 # Express signaling hub & room management server
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0 or higher)
- Web browser with WebRTC support (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari)

### Installation & Run

1. Clone or navigate into the repository:
   ```bash
   cd CodeAlpha_RealTimeCommunicationApp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application server:
   ```bash
   npm start
   ```

4. Open your web browser and navigate to:
   ```text
   http://localhost:5003
   ```

*(Note: The server includes an automatic standalone fallback, meaning `node server.js` will also run directly even if dependencies have not been installed yet!)*

---

## 🔑 Demo Account Credentials

- **Email:** `intern@codealpha.com`
- **Password:** `password123`
*(Or join immediately as a guest by entering any display name)*

Quick Join Demo Rooms available directly on the landing page:
- `#codealpha-sprint`
- `#demo-room-88`

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rooms` | Generate new meeting room and code |
| `GET` | `/api/rooms/:code` | Validate room code existence |
| `GET` | `/api/signal/stream` | SSE real-time WebRTC signaling stream |
| `POST` | `/api/signal/relay` | Relay SDP offers, answers, ICE candidates, chat & whiteboard strokes |
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Authenticate user |

---

## 👨‍💻 Author & Acknowledgments

- **Intern:** Full Stack Development Intern
- **Internship Program:** [CodeAlpha](https://www.codealpha.tech/)
- **Submission:** Task 4 - Real-Time Communication App
