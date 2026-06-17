# Workshop launchers (macOS & Linux — LAC 2026)

| OS | Instructor (Pro+) | Attendee (free tier) |
|----|-----------------|----------------------|
| **macOS** | `Dr.C-Standalone.command` | `Dr.C-Workshop-Attendee.command` |
| **macOS → Linux VM** | `Dr.C-Linux-VM.command` (Multipass `lac-2026-linux`) | — |
| **Linux** | `chmod +x Dr.C-Standalone.sh && ./Dr.C-Standalone.sh` | `chmod +x Dr.C-Workshop-Attendee.sh && ./Dr.C-Workshop-Attendee.sh` |

From repo root:

```bash
./scripts/launch-drc.sh                 # instructor
./scripts/launch-workshop-attendee.sh   # attendees
```

Full install steps: **[PARTICIPANTS.md](../PARTICIPANTS.md)**

> Windows `.bat` / `.ps1` launchers remain in the repo for future use but are **not** part of LAC 2026.
