# Meloetta

![Meloetta](app/opengraph-image.png)

A simple music note-reading game. A note appears on the staff, and you name it as fast as you can.

- Practice on the **Grand Staff** (treble and bass mixed), or stick to **treble** or **bass** clef
- Answer by **touch** (tap one of three choices) or with a **MIDI keyboard**
- Choose your range:
  - **Advanced:** full range, notes on the staff, ledger lines below, or ledger lines above
  - **Beginner:** guide notes (a few anchor notes per clef), staff lines only, or staff spaces only
- Earn 10 XP for every correct answer, and one wrong answer ends your run (tap the retry button to start a new one)
- Beat your best score for each clef and range
- Earn the **Practiced today** badge by reaching 1,000 XP in a day
- Install it as a PWA on your phone for a full-screen, app-like experience

## MIDI input

Select **MIDI** in the settings drawer to play answers on a connected MIDI keyboard.

- Uses the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API), so it requires a supporting browser (e.g. Chrome or Edge) and your permission to access MIDI devices
- Press the key that matches the note on the staff, in the correct octave (Middle C is `C4`)
- Black keys are ignored, since the game only uses natural notes
- The connection status is shown in the settings drawer and on the MIDI port button

## Progress and storage

Your progress is saved in your browser's `localStorage`, with no account or backend:

- Last-used clef and range
- Best score for each clef and range combination (shared between Touch and MIDI)
- XP earned today, which resets at your local midnight

If `localStorage` is unavailable (private mode, blocked storage), the app still works, but progress only lasts for the current session. The input mode always starts on Touch, since MIDI depends on browser permissions.