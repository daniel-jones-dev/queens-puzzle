---
name: feedback-dev-server
description: Do not stop the dev server during work sessions; leave it running for the user
metadata:
  type: feedback
---

Do not kill or stop the dev server (`pkill -f vite`, etc.) during a work session.

**Why:** The user wants the dev server left running so they can interact with it while work is in progress.

**How to apply:** After builds or testing, leave the dev server running. Only stop it if the user explicitly asks.
