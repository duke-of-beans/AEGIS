# AEGIS v3 — VISION DOCUMENT
# "The Cognitive Resource OS"
# Status: VISION LOCKED
# Authors: David + Claude
# Date: 2026-03-24

---

## THE PHILOSOPHY SHIFT

AEGIS v2 is a resource optimizer. It applies profiles, suspends tabs, manages memory. It reacts.

AEGIS v3 is a Cognitive Resource OS. It understands what you are doing, learns the behavioral
fingerprint of every process on your machine, and allocates resources with surgical precision —
in real time, with full explanation, and with earning the right to act before it acts.

The difference between Process Lasso and AEGIS is not features. It is intelligence.
Process Lasso applies rules. AEGIS builds a mental model of your machine.

The sniper metaphor is right. A sniper does not spray. They know the target, the environment,
the wind. They wait for certainty. They take one shot. AEGIS does not "optimize background
processes" — it makes a deliberate decision about every process on the machine based on
context, history, blast radius, and intent. Nothing that is not understood gets touched.
Nothing that is not mapped gets targeted. If it is not mapped, it gets mapped. Period.

**Core principle: What doesn't need to run, doesn't run.
What needs resources, gets them. No exceptions, no compromises.**

---

## WHAT WE ARE ABSORBING (AND BEATING)

| Tool            | What It Does                        | Why AEGIS Wins                              |
|-----------------|-------------------------------------|---------------------------------------------|
| Process Lasso   | CPU priority + ProBalance           | Learning engine + context awareness         |
| HWiNFO64        | Hardware sensors (temps, volts)     | Unified with action layer — not read-only   |
| CrystalDiskInfo | SMART health                        | Integrated with disk management             |
| Autoruns        | Startup management                  | Risk-rated catalog, reversible quarantine   |
| TCPView         | Per-process network                 | Correlated with process intelligence        |
| RAMMap          | Memory deep analysis                | Action-linked, not a museum exhibit         |
| GPU-Z/MSI AB    | GPU monitoring                      | Unified dashboard, action-capable           |
| O&O ShutUp10    | Telemetry/privacy controls          | One-time lockdown tab, gated by tier        |
| WizTree         | Disk space visualization            | Hot path identification + auto-clean        |
| Process Hacker  | Spawn tree + process deep dive      | Tree as default view + sniper intelligence  |

None of these tools talk to each other. None of them know what you are doing.
None of them learn. AEGIS does all three.

---

## THE FIVE INTELLIGENCES

AEGIS v3 is organized around five intelligent systems that compound on each other.

### Intelligence 1: The Process Catalog
The prerequisite for everything. Every process on this machine exists in a knowledge
base with a trust score before AEGIS touches it. The catalog ships with 200+ common
Windows processes pre-labeled with risk tier, blast radius category, publisher, expected
behavioral norms, and action permissions. Unknown processes enter observation-only mode.
AEGIS discovers what they are via hash lookup, cert check, path analysis, network behavior —
and via Claude as the identification layer through the MCP bridge.

The catalog separates factual knowledge (what this process is) from behavioral knowledge
(what it does on *your* machine). These never contaminate each other.
The catalog biases nothing. Observation fills the behavioral layer fresh.

Nothing gets acted on until it is understood. Anything that cannot be understood is
flagged as suspicious. Anything that is suspicious and has network connections gets isolated.

### Intelligence 2: The Baseline Engine
Every understood process builds a behavioral fingerprint over time. The fingerprint
records normal CPU (mean + stddev), normal RAM, normal I/O, normal handle count,
typical run duration, typical spawn pattern — segmented by context and time of day.

Deviation detection uses personal baselines, not absolute thresholds.
Not "node.exe is at 40%." But "node.exe is 3.2x above its personal baseline for this
context for 7 minutes when its historical pattern here is 4%."

This is the sniper's target acquisition. The trigger is deviation, not magnitude.

### Intelligence 3: The Context Engine
AEGIS watches foreground window events via Windows WinEvent hooks. It builds a Context —
the weighted set of apps in active use. Contexts are named, editable, AI-suggestable.
They are not profiles. They are situational labels that unlock policy stacks.

Context is the lens through which every other intelligence is applied. Baseline deviation
in a Build context means something different than baseline deviation in an Idle context.
The Sniper Rules Engine receives context as a first-class input to every decision.

### Intelligence 4: The Sniper Rules Engine
Rules are user-defined and AI-suggested based on learned baselines. Each rule specifies
a target, trigger conditions, duration requirements, cooldown, and a graduated action path:
throttle → suspend → kill. Rules have blast radius awareness — high blast radius targets
get longer duration thresholds and more conservative escalation.

Rules can include context exemptions: "During Build context, skip throttling node.exe."
The engine never acts on a process it does not understand. Unknown processes are
observed only. The gate layer is the prerequisite — if TESSRYX blast radius integration
is active, every action previews its cascade before executing.

### Intelligence 5: The Learning Loop
Every intervention generates a labeled outcome. The feedback layer has three signals:
implicit approval (no undo within 60 seconds), measurable improvement (foreground
process CPU wait time delta), and explicit weighted rating (tray notification 2 minutes
post-action — thumbs up / sideways / down, weighted by intensity of feeling).

Strong negative signals during sacred contexts are worth ten mild positives elsewhere.
The system learns what you consider sacred. Over time it builds a confidence score.
Manual → Suggest → Auto is not just a toggle — it is a journey with a visible milestone.
Auto mode is not offered until confidence is earned.
