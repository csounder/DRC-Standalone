# Workshop launchers (macOS & Linux — LAC 2026)

Presenter Desktop shortcuts (symlink to these files):

| Desktop name | Repo launcher |
|--------------|---------------|
| **Dr.C Mac Standalone.command** | `Dr.C Mac Standalone.command` |
| **Dr.C Mac Terminal.command** | `../Dr.C/opencode/launchers/Dr.C Mac Terminal.command` |
| **Dr.C Linux VM Shell.command** | `Dr.C Linux VM Shell.command` |
| **Dr.C Linux Standalone.command** | `Dr.C Linux Standalone.command` |
| **Dr.C Linux Terminal.command** | `Dr.C Linux Terminal.command` |

```bash
ln -sf "$HOME/Dr.C-Standalone/launchers/Dr.C Mac Standalone.command" ~/Desktop/
ln -sf "$HOME/Dr.C/opencode/launchers/Dr.C Mac Terminal.command" ~/Desktop/
ln -sf "$HOME/Dr.C-Standalone/launchers/Dr.C Linux VM Shell.command" ~/Desktop/
ln -sf "$HOME/Dr.C-Standalone/launchers/Dr.C Linux Standalone.command" ~/Desktop/
ln -sf "$HOME/Dr.C-Standalone/launchers/Dr.C Linux Terminal.command" ~/Desktop/
```

| OS | Instructor (Pro+) | Attendee (free tier) |
|----|-----------------|----------------------|
| **macOS** | `Dr.C Mac Standalone.command` or `Dr.C-Standalone.command` | `Dr.C-Workshop-Attendee.command` |
| **macOS → Linux VM** | `Dr.C Linux VM Shell.command`, `Dr.C Linux Standalone.command`, `Dr.C Linux Terminal.command` | — |
| **Linux** | `chmod +x Dr.C-Standalone.sh && ./Dr.C-Standalone.sh` | `chmod +x Dr.C-Workshop-Attendee.sh && ./Dr.C-Workshop-Attendee.sh` |

From repo root:

```bash
./scripts/launch-drc.sh                 # Mac / Linux host Standalone
./scripts/launch-linux-vm.sh            # Multipass shell (lac-2026-linux)
./scripts/launch-linux-standalone.sh    # Standalone inside VM (needs DISPLAY in VM)
./scripts/launch-linux-terminal.sh      # Terminal TUI inside VM
./scripts/launch-workshop-attendee.sh   # attendees
```

**Linux GUI in Multipass:** Electron cannot display on the Mac host. `launch-linux-standalone.sh` runs preflight then attempts `./scripts/launch-drc.sh` in the VM; without an X11/Wayland session you will see a Missing X server error — use **Dr.C Mac Standalone** for on-stage GUI, or run Standalone from a graphical session inside the VM.

Full install steps: **[PARTICIPANTS.md](../PARTICIPANTS.md)**

> Windows `.bat` / `.ps1` launchers remain in the repo for future use but are **not** part of LAC 2026.
