# FocusFlow

<p align="center">
  <img src="public/icon.svg" width="80" height="80" alt="FocusFlow Logo" />
</p>

<h3 align="center">Distraction-Light Pomodoro Desktop Application</h3>

<p align="center">
  A local-first, beautifully crafted Pomodoro productivity desktop app engineered for deep work, effortless break scheduling, and sustainable focus habits.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33.2.0-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 33" />
  <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Storage-SQLite_(sql.js)-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="#visual-tour--interface-breakdown">Interface Tour</a> •
  <a href="#key-features">Features</a> •
  <a href="#floating-companion-widget">Floating Widget</a> •
  <a href="#audio--ambient-sound-engine">Audio Engine</a> •
  <a href="#architecture--tech-stack">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#custom-themes--music-guide">Themes & Audio</a>
</p>

---

## Overview

**FocusFlow** is a modern, privacy-respecting desktop application designed to eliminate digital clutter while keeping you immersed in your tasks. Unlike browser-based timers that compete for attention in a sea of tabs or cloud-synced productivity suites loaded with telemetry, FocusFlow runs **entirely offline** on your machine.

It pairs a customizable Pomodoro engine with a lightweight **floating companion widget**, integrated **background ambient audio** (Soft White Noise & local music streaming), rich **visual analytics**, and **session crash recovery**—all wrapped in an ultra-sleek, themeable dark aesthetic.

---

## Visual Tour & Interface Breakdown

FocusFlow is crafted with intention. Here is how each core interface and overlay mode empowers your deep work workflow:

### 1. Home & Session Setup (Interactive Control Center)
```text
┌─────────────────────────────────────────────────────────────┐
│  (⏱) FocusFlow             Distraction-light focus sessions│
│                                                             │
│                          01 : 00                            │
│                     ● Next focus session                    │
│                                                             │
│   Task name (optional)                                      │
│   [ What are you working on?                              ] │
│                                                             │
│   [ ⚡ Start Focus Session                    ]  [ ♫ BGM ]  │
│                                                             │
│   Session setup                                [Collapse ∧] │
│   ┌───────────────────────────┬───────────────────────────┐ │
│   │ Focus          [-] 1 min[+] Short break   [-] 1 min[+]│ │
│   │ Work interval             │ Quick rest                │ │
│   ├───────────────────────────┼───────────────────────────┤ │
│   │ Long break     [-] 1 min[+] Cycle count   [-]   2  [+]│ │
│   │ Extended rest             │ Before long break         │ │
│   └───────────────────────────┴───────────────────────────┘ │
│                                                             │
│   TODAY'S PROGRESS                            [📊 Analytics]│
│   0m of 10m goal                             0 sessions     │
│   ═════════════════════════════════════════════════════════ │
└─────────────────────────────────────────────────────────────┘
```
* **Upcoming Duration Readout**: Immediate, high-contrast digital display of your configured focus period.
* **Inline Stepper Controls**: Rapidly configure intervals with single-click `-` / `+` steppers for focus time (1–120 min), short break (1–60 min), long break (1–120 min), and target cycles (1–16).
* **Collapsible & Persistent**: Collapse the setup panel for an even cleaner view; your preferred expansion state is preserved across launches.
* **Task Tagging & Quick Start**: Add optional task context and launch with one click or hit <kbd>Enter</kbd>.
* **Direct BGM Launcher**: Toggle your background ambient track right from the launchpad.
* **Daily Goal Progress**: Tracks completed sessions and minutes focused against your daily target.

---

### 2. Active Session View (Focus Mode)
```text
┌─────────────────────────────────────────────────────────────┐
│                 ● Focus · Deep work time                    │
│                     ● ○ Focus 1 of 2                        │
│                     Unassigned task                         │
│                                                             │
│                         ╭─────────╮                         │
│                       ╱             ╲                       │
│                      │    29 : 30    │                      │
│                      │     Focus     │                      │
│                       ╲             ╱                       │
│                         ╰─────────╯                         │
│                                                             │
│                    (↺)     [ ⏸ ]     (⏭)                    │
│                                                             │
│           [ ♫ BGM ]        [ ⏹ Stop ]        [ ⚙ Settings ] │
│                                                             │
│   Daily focus goal                              0m / 10m    │
│   ───────────────────────────────────────────────────────── │
└─────────────────────────────────────────────────────────────┘
```
* **Animated Progress Ring**: Smooth circular countdown with SVG progress arc that fills dynamically.
* **Cycle Tracking Dots**: Visual progress indicators display exactly where you are in your cycle (e.g., `Focus 1 of 2`).
* **Essential Controls**: Large central Pause/Resume toggle, Reset interval (`↺`), and Skip stage (`⏭`).
* **Active Toolbar**: Instant access to background audio toggles, session termination, and app settings.

---

### 3. Floating Companion Widget (Expanded View)
```text
        ┌───────────────────────────────────┐
        │  ● FOCUS                      0/2 │
        │  FocusFlow                        │
        │                                   │
        │  29 : 30                          │
        │  ═══════════════════════════════  │
        │  [⏸]  [⏭]  [↺]  [♫]  [ℹ]  [👁⃥]    │  <-- Revealed on hover
        └───────────────────────────────────┘
```
* **Ultra-Compact Overlay (220×120 px)**: Transparent, frameless window designed to float unobtrusively over code editors, terminals, or browsers.
* **Always-on-Top**: Keep track of remaining time without switching windows or breaking flow.
* **Hover Action Bar**: Hovering over the widget reveals immediate controls to pause/resume, skip, reset, toggle audio, focus the main app, or minimize the widget.
* **Screen Margin Docking**: Intelligently snaps to the nearest screen edges (left, right, top, bottom) within your monitor's usable work area.

---

### 4. Floating Capsule Mode (Minimalist Pill)
```text
                    ┌─────────────────────────┐
                    │  ●   :::   28 : 30   ∧  │
                    └─────────────────────────┘
```
* **Minimalist Footprint (140×36 px)**: Fits discreetly into menu bars, title bars, or corners.
* **State Dot Indicator (`●`)**: Color-coded indicator matching your active session mode (purple for Focus, teal for Short Break, cyan for Long Break).
* **Pointer-Capture Dragging (`:::`)**: Smooth dragging across monitors with a 6-pixel accidental movement discriminator.
* **1-Click Expand (`∧`)**: Tap the chevron to restore the expanded widget card.

---

## Key Features

### ⏱️ Session Engine
* **Precise Wall-Clock Timing**: The core `TimerEngine` tracks timestamps against wall-clock deadlines (`sessionDeadlineMs`) rather than tick counts, guaranteeing zero timer drift even during system sleep or heavy CPU load.
* **Automatic Stage Progression**: Smooth transitions from focus sessions to short breaks and scheduled long breaks.
* **Configurable Cycles**: Choose how many focus sessions complete a full block before triggering extended rest.
* **Keyboard Hotkeys**: Hit <kbd>Spacebar</kbd> to quickly pause or resume your active timer.

### 🪟 Desktop Companion Widget
* **Dual Display Profiles**: Switch effortlessly between the **Expanded Card** (220×120) and **Compact Capsule** (140×36).
* **Independent Surface Dragging**: Grab and drag the widget anywhere across multi-monitor setups.
* **Boundary Snapping**: Automatically respects Windows Taskbar, macOS Dock, and display work areas.

### 🎧 Audio & Ambient Sound Engine
* **Bundled Soft White Noise**: Includes an integrated, continuous 56 MB ambient audio track (`soft-white-noise.mp3`) tailored for concentration.
* **Custom Music Library ("My Music")**: Point FocusFlow to any folder on your computer to stream your personal music tracks (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`).
* **Smart Break Handling**: Choose whether music mutes automatically during breaks or keeps playing.
* **Playback Modes**: Loop a single track, cycle sequentially, or shuffle your library.
* **Custom Protocol Streaming**: Audio is served via a privileged `local-audio://` streaming protocol supporting HTTP Range requests for instant seeking and zero memory overhead.
* **Web Audio Chimes**: Gentle two-tone chimes (880 Hz / 1100 Hz) synthesized directly in the browser runtime on session milestones.

### 🎨 Visual Customization & Themes
* **4 Built-in Color Themes**:
  * **Midnight** (Default): High-focus deep dark purple palette.
  * **Dark Burgundy**: Rich, warm wine tones designed for late-night sessions.
  * **Muted Plum**: Soft, low-contrast lavender and violet hues.
  * **Warm Sand**: High-legibility light sepia theme.
* **Extensible JSON Theme Engine**: Drop your own `.json` theme file into the application's `themes/` directory for instant live-reloading.

### 📊 Local Analytics & History
* **SQLite (WASM)**: High-performance local storage powered by `sql.js`.
* **7-Day Trend Visualizer**: Interactive chart comparing actual focus time against your daily target.
* **Streak Tracking**: Monitors current daily streaks and personal best records.
* **Searchable Session Log**: Inspect past sessions by date, duration, completion status, and task label.
* **CSV Export**: Export your historical data anytime for external analysis or backups.

### 🛡️ Crash & State Recovery
* **State Checkpoints**: The active timer state is serialized to `recovery.json` every 10 seconds.
* **Unplanned Exit Protection**: In the event of an unexpected shutdown or reboot, FocusFlow detects the interrupted session upon relaunch and offers to restore it.
* **Close-to-Tray / Background Execution**: Closing the main window while a focus session is active simply hides it, leaving the companion widget and timer active.

---

## Architecture & Tech Stack

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │    TimerEngine     │  │   WindowManager    │  │  SQLite Database  │  │
│  │ (Wall-clock Engine)│  │ (Main & Companion) │  │  (sql.js WASM)    │  │
│  └─────────┬──────────┘  └─────────┬──────────┘  └─────────┬─────────┘  │
│            │                       │                       │            │
│  ┌─────────┴──────────┐  ┌─────────┴──────────┐  ┌─────────┴─────────┐  │
│  │ LocalAudioService  │  │    ThemeService    │  │ PreferencesStore  │  │
│  │ (local-audio://)   │  │ (JSON Color Engine)│  │ (electron-store)  │  │
│  └────────────────────┘  └────────────────────┘  └───────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Typed IPC (preload contextBridge)
┌────────────────────────────────────┴────────────────────────────────────┐
│                    React 18 + Vite Renderer Process                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Zustand Stores (timerStore · audioStore · settingsStore)          │  │
│  │ UI Views: HomePage · SessionPage · AnalyticsPage · HistoryPage    │  │
│  │ Overlays: FloatingWidget (Expanded & Capsule)                     │  │
│  │ Design Tokens: Tailwind CSS 3 (Dynamic HSL Variables)             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Shell** | [Electron 33](https://www.electronjs.org/) | Cross-platform window lifecycle and native OS integration |
| **UI Framework** | [React 18](https://react.dev/) | Declarative component UI and reactive store bindings |
| **Bundler** | [Vite 5](https://vitejs.dev/) | Instant HMR and optimized production bundles |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | End-to-end type safety across Main, Preload, and Renderer |
| **State** | [Zustand 5](https://github.com/pmndrs/zustand) | Lightweight, performant client-side state management |
| **Styles** | [Tailwind CSS 3](https://tailwindcss.com/) | Curated utility classes driven by dynamic HSL CSS tokens |
| **Database** | [sql.js](https://sql.js.org/) | Local-first WebAssembly SQLite database |
| **Charts** | [Recharts 2](https://recharts.org/) | Composable SVG productivity visualization |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, consistent interface iconography |

---

## Project Structure

```text
FocusFlow/
├── public/                     # Static assets, branding, and bundled audio
│   ├── audio/                  # Soft White Noise audio asset
│   └── icon.svg                # Application logo
├── scripts/                    # Development runners and Electron orchestrator
│   ├── dev.js                  # Starts Vite and Electron concurrently
│   └── setup-electron.js       # Pre-flight runtime dependency check
├── src/
│   ├── core/                   # Pure business logic (framework independent)
│   │   ├── audio/              # LocalAudioService & local-audio:// streaming
│   │   ├── persistence/        # SQLite database (db.ts), Preferences & Recovery
│   │   ├── theme/              # Custom theme parser and JSON validator
│   │   └── timer/              # Wall-clock TimerEngine state machine
│   ├── main/                   # Electron Main process
│   │   ├── index.ts            # Entrypoint and app lifecycle management
│   │   ├── ipcHandlers.ts      # Strongly typed IPC handlers
│   │   └── windowManager.ts    # Main and widget window creation & physics
│   ├── preload/                # Secure preload script
│   │   └── index.ts            # window.focusFlow bridge interface
│   ├── renderer/               # React 18 frontend
│   │   ├── components/         # Button, Input, Progress, Dialog primitives
│   │   ├── pages/              # Home, Session, Analytics, History, Settings
│   │   ├── stores/             # timerStore, audioStore, settingsStore
│   │   ├── styles/             # globals.css with HSL theme color definitions
│   │   └── widget/             # FloatingWidget overlay UI component
│   └── shared/                 # Universal types, constants, and contracts
│       ├── constants.ts        # Defaults, tick rates, and widget limits
│       └── types.ts            # Shared TypeScript interfaces & IPC channels
├── package.json
└── tailwind.config.js
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
   *This compiles the Electron TypeScript backend, boots the Vite dev server, and opens the FocusFlow application.*

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Spawns the full development environment with hot-reloading |
| `npm run dev:vite` | Runs only the frontend Vite development server (`http://localhost:5173`) |
| `npm run dev:electron` | Compiles Electron TypeScript and boots the native shell |
| `npm run build` | Compiles both Vite web assets and Electron main/preload binaries |
| `npm run type-check` | Executes `tsc --noEmit` across all project modules |
| `npm run lint` | Runs ESLint across the TypeScript codebase |

---

## Custom Themes & Music Guide

### 🎨 Creating Custom Themes
FocusFlow allows full visual freedom through simple JSON files.

1. Go to **Settings** → **Appearance & Themes** → click **Open Themes Folder** (or navigate to `<userData>/themes/`).
2. Create a JSON file (e.g., `dracula-focus.json`).
3. Define the color values using **Hex** (`#bd93f9`) or **HSL** (`265 89% 78%`):

```json
{
  "id": "dracula-focus",
  "name": "Dracula Focus",
  "version": "1.0",
  "author": "Your Name",
  "colors": {
    "background": "#282a36",
    "foreground": "#f8f8f2",
    "card": "#21222c",
    "cardForeground": "#f8f8f2",
    "popover": "#21222c",
    "popoverForeground": "#f8f8f2",
    "primary": "#bd93f9",
    "primaryForeground": "#282a36",
    "secondary": "#44475a",
    "secondaryForeground": "#f8f8f2",
    "muted": "#44475a",
    "mutedForeground": "#6272a4",
    "accent": "#ff79c6",
    "accentForeground": "#282a36",
    "destructive": "#ff5555",
    "destructiveForeground": "#f8f8f2",
    "border": "#44475a",
    "input": "#44475a",
    "ring": "#bd93f9",
    "timerFocus": "#bd93f9",
    "timerShortBreak": "#50fa7b",
    "timerLongBreak": "#8be9fd"
  }
}
```
4. Click **Refresh Themes** in Settings to activate your custom theme.

### 🎵 Adding Personal Music
1. In FocusFlow, navigate to **Settings** → **Audio & BGM**.
2. Select **My Music** as your sound source and click **Open Music Folder**.
3. Drop your favourite music tracks (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, or `.aac`) into the directory.
4. Click **Refresh Library** in FocusFlow. Your tracks will be indexed and ready for playback.

---

## Data Storage & Privacy

FocusFlow operates under a **zero-telemetry, 100% offline-first principle**. All data is stored in your operating system's local application data folder:

* **Windows**: `%APPDATA%\focusflow\`
* **macOS**: `~/Library/Application Support/focusflow/`
* **Linux**: `~/.config/focusflow/`

| File / Directory | Purpose |
| :--- | :--- |
| `focusflow.db` | Local SQLite database recording session durations, completion rates, and streak logs |
| `preferences.json` | Stores your custom timer durations, volume, and widget preferences |
| `recovery.json` | Periodic session checkpoint state used to resume after unexpected exits |
| `themes/` | Storage location for custom user theme JSON definitions |
| `audio/` | Dedicated folder for personal audio tracks scanned by the audio player |

---

## Author & Acknowledgements

Created and developed by **Parth Vaidya**.

- GitHub: [@Parth-Vaidya](https://github.com/Parth-Vaidya)
- Repository: [Focus-Flow-POMODORO-app](https://github.com/Parth-Vaidya/Focus-Flow-POMODORO-app)

---

## License

This project is licensed under the [MIT License](LICENSE).