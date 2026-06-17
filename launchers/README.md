# Workshop launchers (macOS & Linux — LAC 2026)

| OS | Instructor (Pro+) | Attendee (free tier) |
|----|-----------------|----------------------|
| **macOS** | `Dr.C-Standalone.command` | `Dr.C-Workshop-Attendee.command` |
| **macOS → Linux VM** | see [Linux VM on macOS](#linux-vm-on-macos-multipass) below | — |
| **Linux** | `chmod +x Dr.C-Standalone.sh && ./Dr.C-Standalone.sh` | `chmod +x Dr.C-Workshop-Attendee.sh && ./Dr.C-Workshop-Attendee.sh` |

### Linux VM on macOS (Multipass `lac-2026-linux`)

| Launcher | What it does |
|----------|----------------|
| **`Dr.C-Linux-VM-Start.command`** (*Start*) | Starts the VM if needed, prints State / IPv4, optionally opens Multipass — **does not** open a shell |
| **`Dr.C-Linux-VM.command`** (*Shell*) | Same start + status, then `multipass shell` for CLI work inside Ubuntu |
| **`Dr.C-Standalone.sh`** / **`./scripts/launch-drc.sh`** (*Linux Standalone*) | Run Dr.C Electron app **inside** the VM (after you are in the shell or over SSH) |
| **Dr.C Terminal (CLI)** | `~/Dr.C/opencode` or host `Dr.C-Terminal.command` — separate from the VM launchers |

Desktop shortcuts (symlinks into this folder): **Dr.C Linux VM Start** → Start; use **Dr.C Linux VM Shell** naming for the Shell launcher if you add a Desktop symlink to `Dr.C-Linux-VM.command`.

From repo root:

```bash
./scripts/start-linux-vm.sh          # VM on, status only
./scripts/launch-linux-vm.sh         # VM + interactive shell
./scripts/launch-drc.sh              # instructor (macOS or inside VM)
./scripts/launch-workshop-attendee.sh   # attendees
```

Full install steps: **[PARTICIPANTS.md](../PARTICIPANTS.md)**

> Windows `.bat` / `.ps1` launchers remain in the repo for future use but are **not** part of LAC 2026.
