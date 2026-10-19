# FocusFlow

<p align="center">
  <img src="public/icon.svg" width="72" height="72" alt="FocusFlow Logo" />
</p>

<p align="center">
  <strong>A focused, customizable Pomodoro desktop app designed to help you work with intention, take meaningful breaks, and build consistent focus habits.</strong>
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#architecture--tech-stack">Architecture</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#custom-themes--audio-guide">Themes & Audio</a> •
  <a href="#data-storage--privacy">Data Storage</a>
</p>

---

## Overview

**FocusFlow** is a local-first, distraction-light Pomodoro productivity application engineered for the desktop. Built with **Electron**, **React 18**, **TypeScript**, and **Tailwind CSS**, it replaces bloated web timers and notification-heavy tools with a quiet, responsive focus environment.

FocusFlow runs entirely on your local machine: session histories, preferences, and custom themes are stored locally without remote telemetry, tracking, or cloud dependencies. With a dedicated floating companion widget, continuous background audio, rich analytics, and deep session recovery, FocusFlow keeps your attention where it belongs—on your work.

---

## Key Features

### ⏱️ Pomodoro Session Engine
* **Configurable Intervals**: Customize focus sessions (1–120 min), short breaks (1–60 min), and long breaks (1–120 min).
* **Automated Cycle Progression**: Set interval counts before long breaks (1–10 sessions) and define total target cycles (1–16 sessions). FocusFlow automatically transitions between focus periods and breaks.
* **Precise Wall-Clock Timing**: The core `TimerEngine` tracks timestamps against wall-clock deadlines (`sessionDeadlineMs`) rather than depending solely on tick counts, eliminating timer drift when system resources fluctuate.
* **Task Tagging**: Assign task names to focus blocks to track specific objectives across your work sessions.
* **Session Controls**: Instant pause, resume, restart, and skip controls with keyboard shortcut support (<kbd>Spacebar</kbd> to toggle pause/resume).

### 🪟 Floating Desktop Widget
* **Companion Window**: A frameless, transparent Electron overlay that hovers cleanly over your active applications.
* **Always-on-Top Support**: Toggle always-on-top behavior to monitor your remaining time during full-screen coding, reading, or designing.
* **Dual Display Modes**:
  * **Expanded View (220×120 px)**: Shows current stage badge, task label, numerical countdown, session progress bar, and hover action controls.
  * **Compact Capsule (140×36 px)**: Minimalist pill displaying active session indicator and remaining time to conserve screen space.
* **Intelligent Edge Docking**: Detects nearest screen boundaries (`left`, `right`, `top`, `bottom`) and automatically snaps the widget to margins within the active display's work area.
* **Pointer Capture Dragging**: Smooth pointer-capture dragging featuring a 6-pixel threshold discrimination filter to prevent accidental drag triggers on button clicks.
* **Quick-Access Toolbar**: Hovering over the expanded widget reveals controls to pause/resume, skip stages, restart, toggle background music, and jump directly to settings.

### 🎧 Audio & Ambient Sound
* **Bundled Ambient Audio**: Includes a packaged 56 MB continuous **Soft White Noise** (`soft-white-noise.mp3`) track designed for distraction-free deep work.
* **Local Music Library ("My Music")**: Point FocusFlow to any local music directory and stream your own audio files. Supports `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, and `.aac`.
* **Playback Modes**: Choose between **Sequential** (track-by-track), **Shuffle** (randomized selection), or **Single** (repeat current track).
* **Break Audio Policy**: Configure whether background audio continues through rest periods or mutes automatically during short and long breaks.
* **Secure Streaming Protocol**: Custom privileged `local-audio://` Electron protocol with HTTP Range request support for seamless seeking, streaming, and path-traversal security verification.
* **Completion Chimes**: Gentle two-tone chime (880 Hz / 1100 Hz) synthesized via the Web Audio API on session completion, alongside native OS desktop notifications.

### 🎨 Themes & Visual Customization
* **4 Built-in Color Themes**:
  * **Midnight**: Sleek, distraction-free deep dark purple palette (default).
  * **Dark Burgundy**: Deep warm wine tones for low-light environments.
  * **Muted Plum**: Soft, low-contrast violet accents.
  * **Warm Sand**: High-legibility sepia light theme.
* **Extensible Custom Themes**: Create and drop custom `.json` color schemes into the application's `themes/` directory. FocusFlow validates, normalizes (Hex/HSL), and hot-reloads them dynamically.
* **Timer Styles**: Switch between classic digital readout (`MM:SS`) and a circular progress ring.

### 📊 Local Analytics & Session History
* **SQLite Persistence**: Backed by `sql.js` (WebAssembly SQLite) stored locally at `focusflow.db`.
* **7-Day Interactive Chart**: Visual bar chart powered by Recharts comparing daily active focus duration against your configurable daily goal.
* **Productivity Metrics**: View Focus Today, Completed Sessions, Current Day Streak, and All-Time Best Streak.
* **Task Breakdown**: Summaries detailing total focus time and completed intervals grouped by task label.
* **Searchable Log**: Inspect, search, and delete individual past records (focus, breaks, completed, skipped, or stopped).
* **CSV Export**: Export all session history to a CSV file for personal tracking or external spreadsheet analysis.

### 🛡️ Crash & Interruption Recovery
* **Periodic Checkpoints**: State is automatically serialized to `recovery.json` every 10 seconds and flushed on graceful application shutdown.
* **Unplanned Closure Restoration**: If the app or system closes unexpectedly while a session is running, FocusFlow detects the interrupted state on relaunch and prompts you to resume where you left off.
* **Close-to-Background Handling**: Closing the main window while a focus session is active hides the window while keeping the timer and floating widget running.

---

## Architecture & Tech Stack

FocusFlow implements a multi-process Electron architecture adhering strictly to modern security standards (`contextIsolation: true`, `nodeIntegration: false`, typed IPC boundaries).

```
┌─────────────────────────────────────────────────────────────┐
│                       Electron Main                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   TimerEngine   │  │WindowManager │  │  SQLite DB     │  │
│  │  (Wall-clock)   │  │ (Main/Widget)│  │   (sql.js)     │  │
│  └────────┬────────┘  └──────┬───────┘  └───────┬────────┘  │
│           │                  │                  │           │
│  ┌────────┴────────┐  ┌──────┴───────┐  ┌───────┴────────┐  │
│  │LocalAudioService│  │ ThemeService │  │PreferencesStore│  │
│  │ (local-audio://)│  │ (JSON Engine)│  │(electron-store)│  │
│  └─────────────────┘  └──────────────┘  └────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Typed IPC Channels
┌──────────────────────────────┴──────────────────────────────┐
│                    Preload (contextBridge)                  │
│                     window.focusFlow.*                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                   Renderer (React 18 + Vite)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Zustand Stores: timerStore · audioStore · themeStore   │ │
│  │ Pages: Home · ActiveSession · Analytics · History      │ │
│  │ Components: FloatingWidget · TimerDisplay · Radix UI   │ │
│  │ Styling: Tailwind CSS (HSL CSS Variables)              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Technologies

| Layer | Technologies |
| :--- | :--- |
| **Desktop Shell** | [Electron 33](https://www.electronjs.org/) |
| **Frontend UI** | [React 18](https://react.dev/), [Vite 5](https://vitejs.dev/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling & Icons** | [Tailwind CSS 3](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| **State Management** | [Zustand 5](https://github.com/pmndrs/zustand) |
| **Data & Charts** | [sql.js (SQLite WASM)](https://sql.js.org/), [electron-store 8](https://github.com/sindresorhus/electron-store), [Recharts 2](https://recharts.org/) |
| **Packaging** | [electron-builder 25](https://www.electron.build/) |

---

## Project Structure

```text
FocusFlow/
├── public/                     # Static assets and bundled resources
│   ├── audio/                  # Bundled Soft White Noise audio file
│   └── icon.svg                # Application vector brand icon
├── scripts/                    # Development workflow and binary setup scripts
│   ├── dev.js                  # Concurrently spawns Vite dev server and Electron
│   └── setup-electron.js       # Verifies local Electron runtime binaries
├── src/
│   ├── core/                   # Core business logic isolated from UI
│   │   ├── audio/              # LocalAudioService (file scanner, protocol handler)
│   │   ├── persistence/        # SQLite Database (db.ts), Preferences & Recovery stores
│   │   ├── theme/              # ThemeService (built-in themes, JSON loader, color parser)
│   │   └── timer/              # TimerEngine (wall-clock timing, cycle state machine)
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # App entrypoint, custom protocol registration, lifecycle
│   │   ├── ipcHandlers.ts      # Strongly typed IPC request/reply registrations
│   │   └── windowManager.ts    # Main and widget window creation, dragging, and snapping
│   ├── preload/                # Secure contextBridge preload scripts
│   │   └── index.ts            # Type-safe window.focusFlow API exposed to renderer
│   ├── renderer/               # React application UI
│   │   ├── components/         # Reusable UI controls, Radix primitives, TimerDisplay
│   │   ├── pages/              # Views (Home, ActiveSession, Analytics, History, Settings)
│   │   ├── stores/             # Zustand stores (timerStore, audioStore, settingsStore)
│   │   ├── styles/             # Global CSS variables and Tailwind setup
│   │   ├── widget/             # FloatingWidget companion UI component
│   │   ├── index.html          # Main window HTML host
│   │   └── widget.html         # Floating widget HTML host
│   └── shared/                 # Shared contracts across processes
│       ├── constants.ts        # Default settings, tick rates, and dimension limits
│       └── types.ts            # Universal TypeScript interfaces and IPC channel constants
├── package.json                # Project configuration, dependencies, and build metadata
├── tailwind.config.js          # Tailwind theme configuration with HSL variable mapping
└── tsconfig.json               # TypeScript base configuration
```

---

## Getting Started

### Prerequisites
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Parth-Vaidya/Focus-Flow-POMODORO-app.git
   cd Focus-Flow-POMODORO-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development environment**:
   ```bash
   npm run dev
   ```
   *This starts the Vite renderer server on `http://localhost:5173`, compiles the Electron TypeScript sources, and launches the desktop app.*

---

## Available Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Runs the full development environment (Vite dev server + Electron main process). |
| `npm run dev:vite` | Starts only the Vite renderer development server. |
| `npm run dev:electron` | Compiles the Electron TypeScript files and launches the Electron application. |
| `npm run build` | Builds both renderer (`vite build`) and Electron main/preload (`tsc`). |
| `npm run build:renderer`| Compiles TypeScript renderer sources and builds production web assets. |
| `npm run build:electron`| Compiles TypeScript source files for main and preload processes. |
| `npm run type-check` | Runs the TypeScript compiler check (`tsc --noEmit`) across the project. |
| `npm run lint` | Runs ESLint over TypeScript source files in `src/`. |

---

## Custom Themes & Audio Guide

### 🎨 Creating Custom Themes
FocusFlow supports user-authored color schemes via JSON files.

1. Open **Settings** → **Appearance & Themes** → click **Open Themes Folder** (or navigate to `<userData>/themes/`).
2. Create a new `.json` file (e.g., `nord-aurora.json`).
3. Define the theme properties using **Hex** (`#10b981`) or **HSL** (`160 84% 39%`):

```json
{
  "id": "nord-aurora",
  "name": "Nord Aurora",
  "version": "1.0",
  "author": "Your Name",
  "colors": {
    "background": "#2e3440",
    "foreground": "#eceff4",
    "card": "#3b4252",
    "cardForeground": "#eceff4",
    "popover": "#3b4252",
    "popoverForeground": "#eceff4",
    "primary": "#88c0d0",
    "primaryForeground": "#2e3440",
    "secondary": "#434c5e",
    "secondaryForeground": "#d8dee9",
    "muted": "#4c566a",
    "mutedForeground": "#d8dee9",
    "accent": "#81a1c1",
    "accentForeground": "#2e3440",
    "destructive": "#bf616a",
    "destructiveForeground": "#eceff4",
    "border": "#434c5e",
    "input": "#434c5e",
    "ring": "#88c0d0",
    "timerFocus": "#88c0d0",
    "timerShortBreak": "#a3be8c",
    "timerLongBreak": "#b48ead"
  }
}
```
4. Click **Refresh Themes** in Settings. Your theme appears immediately in the theme selector.

### 🎵 Adding Custom Music
1. In FocusFlow, go to **Settings** → **Audio & BGM**.
2. Switch Sound Source to **My Music** and click **Open Music Folder**.
3. Place your preferred `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, or `.aac` audio files into the opened folder.
4. Return to FocusFlow and click **Refresh Library**.
5. Select a starting track or enable **Shuffle** / **Sequential** playback.

---

## Data Storage & Privacy

FocusFlow operates with a **strict local-first design**. No session data, task names, timestamps, or usage analytics leave your machine.

All files are stored in your operating system's standard application data directory:
* **Windows**: `%APPDATA%\focusflow\`
* **macOS**: `~/Library/Application Support/focusflow/`
* **Linux**: `~/.config/focusflow/`

### File Manifest

| File / Folder | Purpose |
| :--- | :--- |
| `focusflow.db` | Local SQLite database containing logged sessions, durations, tasks, and streak aggregates. |
| `preferences.json` | User configuration including timer durations, audio choices, volume, and widget preferences. |
| `recovery.json` | Snapshot of active session states saved for checkpoint recovery. |
| `themes/` | Directory where user-defined custom `.json` themes reside. |
| `audio/` | Dedicated folder for user-provided local music files. |

---

## Author

Created and developed by **Parth Vaidya**.

- GitHub: [@Parth-Vaidya](https://github.com/Parth-Vaidya)