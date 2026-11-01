"use client"

import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import VexFlow, { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow"
import {
  BadgeCheckIcon,
  CheckIcon,
  EighthNoteIcon,
  MidiPortIcon,
  RotateCcwIcon,
  SettingsIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CountingNumber } from "@/components/ui/counting-number"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Progress } from "@/components/ui/progress"
import { RippleButton } from "@/components/ui/ripple-button"
import { cn } from "@/lib/utils"

/* ==========================================================================
 * 1. CONFIG
 * ======================================================================== */

const XP_PER_ANSWER = 10
const XP_PER_BAR = 100 // the bar fills every 100 XP, then starts over
const DAILY_GOAL_XP = 1000 // reaching this in a day earns the "Practiced today" badge

const STAFF_WIDTH = 100
const STAFF_HEIGHT = 150

/* ==========================================================================
 * 2. DOMAIN: clefs, notes, practice options
 * ======================================================================== */

/** A clef that VexFlow can actually draw. */
type StaffClef = "treble" | "bass"

/** What the user selects. "grand" alternates between treble and bass. */
type Clef = StaffClef | "grand"

type Note = {
  key: string // VexFlow key, e.g. "e/4"
  region: "below" | "staff" | "above" // where it sits relative to the staff
  position: "line" | "space" // whether it sits on a line or in a space
}

const NOTES_TREBLE: Note[] = [
  // Below the staff
  { key: "g/3", region: "below", position: "space" }, // Below the 2nd ledger line
  { key: "a/3", region: "below", position: "line" }, // 2nd ledger line
  { key: "b/3", region: "below", position: "space" }, // Below the 1st ledger line
  { key: "c/4", region: "below", position: "line" }, // 1st ledger line (Middle C)
  { key: "d/4", region: "below", position: "space" }, // Just below the staff

  // On the staff
  { key: "e/4", region: "staff", position: "line" }, // 1st line - 'E'very
  { key: "f/4", region: "staff", position: "space" }, // 1st space - 'F'
  { key: "g/4", region: "staff", position: "line" }, // 2nd line - 'G'ood
  { key: "a/4", region: "staff", position: "space" }, // 2nd space - 'A'
  { key: "b/4", region: "staff", position: "line" }, // 3rd line - 'B'oy
  { key: "c/5", region: "staff", position: "space" }, // 3rd space - 'C'
  { key: "d/5", region: "staff", position: "line" }, // 4th line - 'D'eserves
  { key: "e/5", region: "staff", position: "space" }, // 4th space - 'E'
  { key: "f/5", region: "staff", position: "line" }, // 5th line - 'F'udge

  // Above the staff
  { key: "g/5", region: "above", position: "space" }, // Just above the staff
  { key: "a/5", region: "above", position: "line" }, // 1st ledger line
  { key: "b/5", region: "above", position: "space" }, // Above the 1st ledger line
  { key: "c/6", region: "above", position: "line" }, // 2nd ledger line (High C)
  { key: "d/6", region: "above", position: "space" }, // Above the 2nd ledger line
  { key: "e/6", region: "above", position: "line" }, // 3rd ledger line
  { key: "f/6", region: "above", position: "space" }, // Above the 3rd ledger line
  { key: "g/6", region: "above", position: "line" }, // 4th ledger line
]

// Mirrors the treble layout: 5 notes below, 9 on the staff, 8 above.
const NOTES_BASS: Note[] = [
  // Below the staff
  { key: "b/1", region: "below", position: "space" }, // Below the 2nd ledger line
  { key: "c/2", region: "below", position: "line" }, // 2nd ledger line
  { key: "d/2", region: "below", position: "space" }, // Below the 1st ledger line
  { key: "e/2", region: "below", position: "line" }, // 1st ledger line
  { key: "f/2", region: "below", position: "space" }, // Just below the staff

  // On the staff
  { key: "g/2", region: "staff", position: "line" }, // 1st line - 'G'ood
  { key: "a/2", region: "staff", position: "space" }, // 1st space - 'A'
  { key: "b/2", region: "staff", position: "line" }, // 2nd line - 'B'oys
  { key: "c/3", region: "staff", position: "space" }, // 2nd space - 'C'
  { key: "d/3", region: "staff", position: "line" }, // 3rd line - 'D'o
  { key: "e/3", region: "staff", position: "space" }, // 3rd space - 'E'
  { key: "f/3", region: "staff", position: "line" }, // 4th line - 'F'ine
  { key: "g/3", region: "staff", position: "space" }, // 4th space - 'G'
  { key: "a/3", region: "staff", position: "line" }, // 5th line - 'A'lways

  // Above the staff
  { key: "b/3", region: "above", position: "space" }, // Just above the staff
  { key: "c/4", region: "above", position: "line" }, // 1st ledger line (Middle C)
  { key: "d/4", region: "above", position: "space" }, // Above the 1st ledger line
  { key: "e/4", region: "above", position: "line" }, // 2nd ledger line
  { key: "f/4", region: "above", position: "space" }, // Above the 2nd ledger line
  { key: "g/4", region: "above", position: "line" }, // 3rd ledger line
  { key: "a/4", region: "above", position: "space" }, // Above the 3rd ledger line
  { key: "b/4", region: "above", position: "line" }, // 4th ledger line
]

const NOTES_BY_CLEF: Record<StaffClef, Note[]> = {
  treble: NOTES_TREBLE,
  bass: NOTES_BASS,
}

// "Guide notes": a few anchor notes per clef (clef-specific, so not derived
// from region/position)
const GUIDE_KEYS: Record<StaffClef, string[]> = {
  treble: ["c/4", "g/4", "c/5", "f/5"], // C4, G4, C5, F5
  bass: ["g/2", "c/3", "f/3", "c/4"], // G2, C3, F3, C4
}

const CLEF_OPTIONS: { value: Clef; label: string; short: string }[] = [
  { value: "grand", label: "Grand Staff", short: "Grand Staff" },
  { value: "treble", label: "Treble clef", short: "Treble" },
  { value: "bass", label: "Bass clef", short: "Bass" },
]

type Category =
  "all" | "staff" | "below_staff" | "above_staff" | "lines" | "spaces" | "guide"

type PracticeOption = {
  value: Category
  label: string
  // `clef` is the staff clef the note belongs to (never "grand")
  match: (note: Note, clef: StaffClef) => boolean
}

const PRACTICE_GROUPS: { label: string; options: PracticeOption[] }[] = [
  {
    label: "Advanced",
    options: [
      { value: "all", label: "Full range", match: () => true },
      {
        value: "staff",
        label: "On the staff",
        match: (n) => n.region === "staff",
      },
      {
        value: "below_staff",
        label: "Ledger lines below",
        match: (n) => n.region === "below",
      },
      {
        value: "above_staff",
        label: "Ledger lines above",
        match: (n) => n.region === "above",
      },
    ],
  },
  {
    label: "Beginner",
    options: [
      {
        value: "guide",
        label: "Guide notes",
        match: (n, clef) => GUIDE_KEYS[clef].includes(n.key),
      },
      {
        value: "lines",
        label: "Staff lines only",
        match: (n) => n.region === "staff" && n.position === "line",
      },
      {
        value: "spaces",
        label: "Staff spaces only",
        match: (n) => n.region === "staff" && n.position === "space",
      },
    ],
  },
]

const ALL_OPTIONS = PRACTICE_GROUPS.flatMap((g) => g.options)

const DEFAULT_CLEF: Clef = "grand"
const DEFAULT_CATEGORY: Category = "all"

const isClef = (value: string | undefined): value is Clef =>
  CLEF_OPTIONS.some((o) => o.value === value)

const isCategory = (value: string | undefined): value is Category =>
  ALL_OPTIONS.some((o) => o.value === value)

const clefShortLabel = (clef: Clef) =>
  CLEF_OPTIONS.find((o) => o.value === clef)?.short ?? ""

const categoryLabel = (category: Category) =>
  ALL_OPTIONS.find((o) => o.value === category)?.label ?? ""

/** All VexFlow keys available for a given staff clef + practice category. */
const notePool = (category: Category, clef: StaffClef) => {
  const option = ALL_OPTIONS.find((o) => o.value === category)
  return NOTES_BY_CLEF[clef]
    .filter((n) => (option ? option.match(n, clef) : true))
    .map((n) => n.key)
}

/* --- Input: how the user answers ------------------------------------------ */

/** Not persisted: always starts as "touch" because MIDI depends on permissions. */
type InputMode = "touch" | "midi"

const INPUT_OPTIONS: { value: InputMode; label: string }[] = [
  { value: "touch", label: "Touch" },
  { value: "midi", label: "MIDI" },
]

const DEFAULT_INPUT: InputMode = "touch"

/* ==========================================================================
 * 3. QUESTIONS
 * ======================================================================== */

// `clef` is the staff actually shown for this question (never "grand")
type Question = { note: string; clef: StaffClef; choices: string[] }

/** "e/5" -> "E" */
const letterOf = (key: string) => key[0].toUpperCase()
/** "e/5" -> "5" */
const octaveOf = (key: string) => key.slice(2)

const shuffle = <T,>(items: T[]) => {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const newQuestion = (
  category: Category,
  clef: Clef,
  previous?: Question
): Question => {
  // Grand Staff: pick treble or bass 50/50 for each question
  const staffClef: StaffClef =
    clef === "grand" ? (Math.random() < 0.5 ? "treble" : "bass") : clef

  const pool = notePool(category, staffClef)
  // Avoid the exact same clef + note back-to-back
  const candidates = pool.filter(
    (n) => !(previous?.clef === staffClef && previous.note === n)
  )
  const note = candidates[Math.floor(Math.random() * candidates.length)]
  return {
    note,
    clef: staffClef,
    choices: shuffle([
      note,
      ...shuffle(pool.filter((n) => n !== note)).slice(0, 2),
    ]),
  }
}

/* ==========================================================================
 * 4. STORAGE: a tiny external store on top of localStorage
 *
 * `useSyncExternalStore` needs three things:
 *   - subscribe:         tell React when the store changes
 *   - getSnapshot:       read the current value on the client
 *   - getServerSnapshot: value used on the server AND during hydration
 *
 * Using the server snapshot during hydration is what avoids mismatches,
 * and React re-renders with the real value right after, with no effect.
 *
 * Resilience: every write also lands in an in-memory map. If localStorage
 * throws (private mode, blocked cookies, sandboxed iframes), the app still
 * works for the session; it just doesn't persist. Reads prefer the memory
 * copy and fall back to localStorage for keys this tab hasn't touched.
 * ======================================================================== */

const storeListeners = new Set<() => void>()

// Session fallback + write-through cache
const memoryStore = new Map<string, string>()

const handleStorageEvent = (event: StorageEvent) => {
  // Another tab changed a key: drop our cached copy so the fresh value wins.
  // `event.key` is null when storage was cleared entirely.
  if (event.key) memoryStore.delete(event.key)
  else memoryStore.clear()
  storeListeners.forEach((l) => l())
}

const subscribeToStorage = (listener: () => void) => {
  storeListeners.add(listener)
  if (storeListeners.size === 1) {
    window.addEventListener("storage", handleStorageEvent) // changes from other tabs
  }
  return () => {
    storeListeners.delete(listener)
    if (storeListeners.size === 0) {
      window.removeEventListener("storage", handleStorageEvent)
    }
  }
}

/** `storage` events only fire in *other* tabs, so notify this tab manually. */
const emitStorageChange = () => storeListeners.forEach((l) => l())

const readStorage = (key: string): string | null => {
  const cached = memoryStore.get(key)
  if (cached !== undefined) return cached
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // Storage unavailable (private mode, blocked, etc.)
  }
}

const writeStorage = (key: string, value: string) => {
  memoryStore.set(key, value) // always works, so the UI always reflects the change
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Not persisted (private mode, quota, etc.), but the session still works
  }
  emitStorageChange()
}

/* --- Keys & (de)serialization ------------------------------------------- */

// Max score: one key per clef + category (shared by Touch and MIDI)
const maxScoreKey = (clef: Clef, category: Category) =>
  `app@meloetta:${clef}:${category}`

// Last-used settings: a single key, value is "<clef>:<category>"
const SETTINGS_KEY = "app@meloetta:settings"

// Daily XP: a single key, value is "<local YYYY-MM-DD>:<xp earned that day>"
const DAILY_KEY = "app@meloetta:daily"

const parseSettings = (raw: string | null) => {
  const [clef, category] = (raw ?? "").split(":")
  return {
    clef: isClef(clef) ? clef : DEFAULT_CLEF,
    category: isCategory(category) ? category : DEFAULT_CATEGORY,
  }
}

const parseScore = (raw: string | null) => {
  const parsed = parseInt(raw ?? "", 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Local calendar date, so "today" matches the user's own midnight. */
const localDateKey = () => {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

/** XP earned on `today`. A stored value from any other day counts as 0. */
const parseDailyXp = (raw: string | null, today: string) => {
  const [date, xp] = (raw ?? "").split(":")
  return date === today ? parseScore(xp ?? null) : 0
}

/* --- Writers ------------------------------------------------------------ */

const writeSettings = (clef: Clef, category: Category) =>
  writeStorage(SETTINGS_KEY, `${clef}:${category}`)

const writeMaxScore = (clef: Clef, category: Category, score: number) =>
  writeStorage(maxScoreKey(clef, category), String(score))

/** Reads storage at write time, so other tabs' progress isn't overwritten. */
const addDailyXp = (delta: number) => {
  const today = localDateKey()
  const current = parseDailyXp(readStorage(DAILY_KEY), today)
  writeStorage(DAILY_KEY, `${today}:${current + delta}`)
}

/* ==========================================================================
 * 5. MIDI
 *
 * Status lifecycle (only while MIDI is the selected input):
 *   pending    -> waiting for the browser's permission / first device scan
 *   no-device  -> access granted, nothing plugged in yet (not an error)
 *   connected  -> at least one input device is connected
 *   error      -> permission denied, request failed, or device lost mid-session
 * ======================================================================== */

type MidiStatus = "off" | "pending" | "connected" | "no-device" | "error"

const MIDI_STATUS_TEXT: Record<MidiStatus, string | null> = {
  off: null,
  pending: "Connecting…",
  connected: "Device connected",
  "no-device": "No device connected",
  error: "Couldn't connect to MIDI",
}

// MIDI pitch class -> natural note letter. Sharps/flats are intentionally
// absent: they have no entry, so they are ignored.
const NATURAL_LETTERS: Record<number, string> = {
  0: "c",
  2: "d",
  4: "e",
  5: "f",
  7: "g",
  9: "a",
  11: "b",
}

/** 60 -> "c/4" (Middle C). Returns null for black keys. */
const midiToKey = (midi: number) => {
  const letter = NATURAL_LETTERS[midi % 12]
  return letter ? `${letter}/${Math.floor(midi / 12) - 1}` : null
}

const NOTE_ON = 0x90

const noopSubscribe = () => () => {}

/** Whether this browser exposes the Web MIDI API. False on the server. */
function useMidiSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => "requestMIDIAccess" in navigator,
    () => false
  )
}

/**
 * Requests MIDI access while `enabled`, listens for note-on messages, and
 * reports the connection status. Everything is torn down when disabled.
 */
function useMidi(enabled: boolean, onNote: (midi: number) => void) {
  const [status, setStatus] = useState<MidiStatus>("pending")

  // Always call the latest handler without re-subscribing to MIDI
  const onNoteRef = useRef(onNote)
  useEffect(() => {
    onNoteRef.current = onNote
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let access: MIDIAccess | null = null
    let hadDevice = false

    const handleMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data) return
      const [command, note, velocity] = data
      // Note-on (any channel). Velocity 0 is a note-off in disguise.
      if ((command & 0xf0) === NOTE_ON && velocity > 0) onNoteRef.current(note)
    }

    // Re-run on connect/disconnect: attach listeners and recompute status
    const sync = () => {
      if (!access) return
      let connected = 0
      access.inputs.forEach((input) => {
        input.onmidimessage = handleMessage
        if (input.state === "connected") connected++
      })
      if (connected > 0) {
        hadDevice = true
        setStatus("connected")
      } else {
        // Losing a device we already had is an error; never having one is not
        setStatus(hadDevice ? "error" : "no-device")
      }
    }

    navigator
      .requestMIDIAccess()
      .then((result) => {
        if (cancelled) return
        access = result
        access.onstatechange = sync
        sync()
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })

    return () => {
      cancelled = true
      if (access) {
        access.onstatechange = null
        access.inputs.forEach((input) => {
          input.onmidimessage = null
        })
      }
      setStatus("pending")
    }
  }, [enabled])

  return enabled ? status : "off"
}

/* ==========================================================================
 * 6. HOOKS
 * ======================================================================== */

/** Last-used clef + category. Falls back to defaults on server/hydration. */
function useSettings(): { clef: Clef; category: Category } {
  // Snapshots are primitive strings, so React can compare them with Object.is
  const raw = useSyncExternalStore(
    subscribeToStorage,
    () => readStorage(SETTINGS_KEY),
    () => null
  )
  return parseSettings(raw)
}

/** Best score for a clef + category. Derived from storage, not duplicated in state. */
function useMaxScore(clef: Clef, category: Category): number {
  const raw = useSyncExternalStore(
    subscribeToStorage,
    () => readStorage(maxScoreKey(clef, category)),
    () => null
  )
  return parseScore(raw)
}

/** XP earned today across all runs. Derived from storage; 0 on server/hydration. */
function useDailyXp(): number {
  const raw = useSyncExternalStore(
    subscribeToStorage,
    () => readStorage(DAILY_KEY),
    () => null
  )
  return parseDailyXp(raw, localDateKey())
}

/** Loads the VexFlow music font once. */
function useVexFlowFonts() {
  useEffect(() => {
    async function loadFonts() {
      await VexFlow.loadFonts("Finale Jazz") // fonts for text and music
      VexFlow.setFonts("Finale Jazz")
    }
    loadFonts()
  }, [])
}

/* --- Game state: a reducer so every event sees the latest state ----------- *
 *
 * Touch taps are safe with plain useState because React flushes discrete
 * events synchronously. MIDI messages are native events: two note-ons in
 * quick succession (a chord, a fast player) can both fire before React
 * re-renders, and each would act on the same stale `question`/`xp`.
 * A reducer applies every action, in order, against the latest state.
 * ------------------------------------------------------------------------- */

type GameState = {
  question: Question | null
  xp: number
  // Set when the user picks a wrong answer; holds the choice they clicked
  wrongChoice: string | null
  // Lifetime XP earned this page session. Never resets, so the daily total
  // can be fed by its increases even when `xp` resets.
  earned: number
}

type GameAction =
  | { type: "start"; clef: Clef; category: Category }
  | { type: "answer"; selected: string; clef: Clef; category: Category }
  | { type: "retry"; clef: Clef; category: Category }
  | { type: "settingsChanged"; clef: Clef; category: Category }

const INITIAL_GAME: GameState = {
  question: null,
  xp: 0,
  wrongChoice: null,
  earned: 0,
}

// Note: newQuestion uses Math.random, so this reducer isn't strictly pure.
// In Strict Mode dev, React may call it twice and keep one result, which is
// harmless here (either random question is valid).
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "start":
      return {
        question: newQuestion(action.category, action.clef),
        xp: 0,
        wrongChoice: null,
        earned: state.earned,
      }

    case "settingsChanged":
      // Reset the run. If a session is running, swap to the new pool at once.
      return {
        question: state.question
          ? newQuestion(action.category, action.clef, state.question)
          : null,
        xp: 0,
        wrongChoice: null,
        earned: state.earned,
      }

    case "answer": {
      // Ignore answers when there is no question or we're waiting for retry
      if (!state.question || state.wrongChoice) return state

      if (action.selected !== state.question.note) {
        // Keep the XP on screen; the reset only happens on retry
        return { ...state, wrongChoice: action.selected }
      }
      return {
        question: newQuestion(action.category, action.clef, state.question),
        xp: state.xp + XP_PER_ANSWER,
        wrongChoice: null,
        earned: state.earned + XP_PER_ANSWER,
      }
    }

    case "retry":
      return {
        question: newQuestion(
          action.category,
          action.clef,
          state.question ?? undefined
        ),
        xp: 0,
        wrongChoice: null,
        earned: state.earned,
      }
  }
}

/** All game state and actions. The UI components below stay dumb. */
function useGame() {
  const { clef, category } = useSettings()
  const maxScore = useMaxScore(clef, category)
  const dailyXp = useDailyXp()

  // Session-only: not stored, always starts on Touch
  const [input, setInput] = useState<InputMode>(DEFAULT_INPUT)
  const [game, dispatch] = useReducer(gameReducer, INITIAL_GAME)

  const midiSupported = useMidiSupported()

  // Reset the run whenever the effective settings change, whether from this
  // tab's drawer, hydration, or another tab's `storage` event. This is the
  // "adjust state while rendering" pattern: React discards the stale render
  // and re-renders immediately, so no effect ever sees old XP paired with
  // new settings.
  const settingsKey = `${clef}:${category}`
  const [syncedKey, setSyncedKey] = useState(settingsKey)
  if (syncedKey !== settingsKey) {
    setSyncedKey(settingsKey)
    dispatch({ type: "settingsChanged", clef, category })
  }

  // Persist the best score. Only ever writes when the run beats the stored max.
  useEffect(() => {
    if (game.xp > maxScore) writeMaxScore(clef, category, game.xp)
  }, [game.xp, maxScore, clef, category])

  // Feed the daily total with whatever was newly earned. A ref remembers what
  // has already been counted, so each XP point is added exactly once, even when
  // several MIDI answers land in one render.
  const countedEarned = useRef(0)
  useEffect(() => {
    const delta = game.earned - countedEarned.current
    countedEarned.current = game.earned
    if (delta > 0) addDailyXp(delta)
  }, [game.earned])

  function start() {
    dispatch({ type: "start", clef, category })
  }

  // Changing a setting only writes it; the settingsKey sync above resets the run
  function changeClef(next: Clef) {
    if (next === clef) return
    writeSettings(next, category)
  }

  function changeCategory(next: Category) {
    if (next === category) return
    writeSettings(clef, next)
  }

  // Switching input never touches XP, the question, or stored settings
  function changeInput(next: InputMode) {
    setInput(next)
  }

  function answer(selected: string) {
    dispatch({ type: "answer", selected, clef, category })
  }

  function retry() {
    dispatch({ type: "retry", clef, category })
  }

  // A MIDI key press is just another way to call `answer`.
  // Black keys have no matching key, so they're ignored.
  const midiStatus = useMidi(input === "midi", (midi) => {
    const key = midiToKey(midi)
    if (key) answer(key)
  })

  return {
    clef,
    category,
    maxScore,
    dailyXp,
    input,
    midiSupported,
    midiStatus,
    question: game.question,
    xp: game.xp,
    wrongChoice: game.wrongChoice,
    start,
    changeClef,
    changeCategory,
    changeInput,
    answer,
    retry,
  }
}

/* ==========================================================================
 * 7. COMPONENTS
 * ======================================================================== */

/* --- Shared: a selectable row used in the settings drawer ---------------- */

const HINT_TONES = {
  muted: "text-muted-foreground",
  ok: "text-primary",
  error: "text-destructive",
} as const

function OptionButton({
  label,
  selected,
  disabled,
  hint,
  hintTone = "muted",
  onSelect,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  hint?: string | null
  hintTone?: keyof typeof HINT_TONES
  onSelect: () => void
}) {
  const hintId = useId()

  return (
    <div className="flex flex-col gap-1">
      <Button
        role="radio"
        aria-checked={selected}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        variant="outline"
        className={cn(
          "h-12 w-full justify-between rounded-xl px-4 text-base",
          selected && "border-primary bg-accent"
        )}
        onClick={onSelect}
      >
        {label}
        {selected && (
          <CheckIcon
            aria-hidden="true"
            className="size-5 text-primary-foreground"
          />
        )}
      </Button>
      {hint && (
        <p id={hintId} className={cn("px-1 text-sm", HINT_TONES[hintTone])}>
          {hint}
        </p>
      )}
    </div>
  )
}

/* --- Settings drawer ------------------------------------------------------ */

function SettingsDrawer({
  clef,
  category,
  input,
  midiSupported,
  midiStatus,
  onClefChange,
  onCategoryChange,
  onInputChange,
}: {
  clef: Clef
  category: Category
  input: InputMode
  midiSupported: boolean
  midiStatus: MidiStatus
  onClefChange: (clef: Clef) => void
  onCategoryChange: (category: Category) => void
  onInputChange: (input: InputMode) => void
}) {
  const midiHint = midiSupported
    ? MIDI_STATUS_TEXT[midiStatus]
    : "Not supported in this browser"
  const midiHintTone =
    midiStatus === "error"
      ? "error"
      : midiStatus === "connected"
        ? "ok"
        : "muted"

  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger
        render={
          <RippleButton
            variant="ghost"
            size="icon-lg"
            className="size-11 shrink-0 rounded-full"
            aria-label="Settings"
          >
            <SettingsIcon className="size-5" />
          </RippleButton>
        }
      />
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-xl">Practice set</DrawerTitle>
          <DrawerDescription>
            Choose how you answer, a clef, and which notes you see.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5 px-4 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <section>
              <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                Input
              </h3>
              <div
                role="radiogroup"
                aria-label="Input"
                className="flex flex-col gap-1.5"
              >
                {INPUT_OPTIONS.map((opt) => {
                  const isMidi = opt.value === "midi"
                  return (
                    <OptionButton
                      key={opt.value}
                      label={opt.label}
                      selected={opt.value === input}
                      disabled={isMidi && !midiSupported}
                      hint={isMidi ? midiHint : null}
                      hintTone={isMidi ? midiHintTone : undefined}
                      onSelect={() => onInputChange(opt.value)}
                    />
                  )
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                Clef
              </h3>
              <div
                role="radiogroup"
                aria-label="Clef"
                className="flex flex-col gap-1.5"
              >
                {CLEF_OPTIONS.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    label={opt.label}
                    selected={opt.value === clef}
                    onSelect={() => onClefChange(opt.value)}
                  />
                ))}
              </div>
            </section>

            <div
              role="radiogroup"
              aria-label="Note range"
              className="flex flex-col gap-5"
            >
              {PRACTICE_GROUPS.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {group.options.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        label={opt.label}
                        selected={opt.value === category}
                        onSelect={() => onCategoryChange(opt.value)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* --- Header ---------------------------------------------------------------- */

function Header(props: React.ComponentProps<typeof SettingsDrawer>) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 pb-4">
      <h1
        onClick={() => window.location.reload()}
        className="cursor-pointer text-2xl font-semibold tracking-tight text-foreground underline decoration-primary decoration-wavy decoration-2 underline-offset-4"
      >
        Meloetta
      </h1>
      <SettingsDrawer {...props} />
    </header>
  )
}

/* --- HUD: always visible so nothing jumps when the game starts ------------- */

function Hud({
  clef,
  category,
  xp,
  maxScore,
  showBest,
  dailyXp,
}: {
  clef: Clef
  category: Category
  xp: number
  maxScore: number
  showBest: boolean
  dailyXp: number
}) {
  return (
    <section aria-label="Progress" className="flex shrink-0 flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col text-sm leading-tight">
          <span className="font-medium text-foreground">
            {clefShortLabel(clef)}
          </span>
          <span className="text-muted-foreground">
            {categoryLabel(category)}
          </span>
        </div>
        <div className="flex items-baseline gap-1 whitespace-nowrap text-muted-foreground">
          {dailyXp >= DAILY_GOAL_XP && (
            <BadgeCheckIcon
              className="size-6 self-center text-primary"
              aria-hidden="true"
            />
          )}
          <CountingNumber
            className="text-3xl font-semibold tracking-tight"
            grouping
            value={xp}
          />
          <span className="text-sm font-medium">XP</span>
          {/* After a wrong answer, show the best next to the kept score */}
          {showBest && (
            <span className="ml-1 text-sm font-medium">
              (Best {maxScore.toLocaleString()} XP)
            </span>
          )}
        </div>
      </div>
      <Progress
        value={xp % XP_PER_BAR}
        aria-label="Experience toward the next 100"
        className="w-full"
      />
    </section>
  )
}

/* --- Start screen ---------------------------------------------------------- */

function StartScreen({
  maxScore,
  dailyXp,
  onStart,
}: {
  maxScore: number
  dailyXp: number
  onStart: () => void
}) {
  const practiced = dailyXp >= DAILY_GOAL_XP

  return (
    <div className="relative z-10 flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <span className="text-sm font-medium">Best</span>
        <div className="flex items-baseline gap-1">
          <CountingNumber
            className="text-3xl font-semibold tracking-tight"
            grouping
            value={maxScore}
          />
          <span className="text-sm font-medium">XP</span>
        </div>
      </div>
      <RippleButton size="lg" className="h-16 w-56 text-xl" onClick={onStart}>
        Start
      </RippleButton>
      <p className="text-muted-foreground">Name the note you see.</p>
      {practiced ? (
        <p className="flex items-center gap-1.5 font-medium text-primary">
          <BadgeCheckIcon className="size-5" aria-hidden="true" />
          Practiced today
        </p>
      ) : (
        <p className="text-muted-foreground">
          <CountingNumber grouping value={dailyXp} /> /{" "}
          {DAILY_GOAL_XP.toLocaleString()} XP today
        </p>
      )}
    </div>
  )
}

/* --- Staff: renders a single note with VexFlow ---------------------------- */

function StaffView({ note, clef }: { note: string; clef: StaffClef }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ""

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(STAFF_WIDTH, STAFF_HEIGHT)
    const ctx = renderer.getContext()
    const stave = new Stave(0, 12, STAFF_WIDTH - 2).addClef(clef)
    stave.setContext(ctx).draw()

    const staveNote = new StaveNote({ keys: [note], duration: "w", clef })
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickable(
      staveNote
    )
    const formatWidth = stave.getNoteEndX() - stave.getNoteStartX() - 10
    new Formatter().joinVoices([voice]).format([voice], formatWidth)
    voice.draw(ctx, stave)

    const svg = el.querySelector("svg")
    if (svg) {
      svg.setAttribute("viewBox", `0 0 ${STAFF_WIDTH} ${STAFF_HEIGHT}`)
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
      svg.removeAttribute("width")
      svg.removeAttribute("height")
      svg.style.width = "100%"
      svg.style.height = "100%"
      svg.style.opacity = "85%"
    }
  }, [note, clef])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${clefShortLabel(clef)} clef staff showing one note`}
      className="relative z-10 h-full w-full max-w-[20rem] [&_svg]:mx-auto [&_svg]:h-full [&_svg]:max-w-full"
    />
  )
}

/* --- Answer buttons (Touch) ------------------------------------------------ */

function AnswerChoices({
  question,
  wrongChoice,
  onAnswer,
  onRetry,
}: {
  question: Question
  wrongChoice: string | null
  onAnswer: (choice: string) => void
  onRetry: () => void
}) {
  const answered = wrongChoice !== null

  return (
    <div className="grid grid-cols-3 gap-3">
      {question.choices.map((choice) => {
        const isRight = choice === question.note

        // The wrong answer the user picked becomes a retry button
        if (answered && choice === wrongChoice) {
          return (
            <RippleButton
              key={choice}
              size="lg"
              variant="destructive"
              aria-label="Try again"
              className="h-20 border-2 border-destructive/20 px-0 active:scale-95"
              onClick={onRetry}
            >
              <RotateCcwIcon className="size-7" aria-hidden="true" />
            </RippleButton>
          )
        }

        return (
          <RippleButton
            key={choice}
            size="lg"
            variant="outline"
            disabled={answered}
            aria-label={`${letterOf(choice)}, octave ${octaveOf(choice)}`}
            className={cn(
              "h-20 border-2 px-0 active:scale-95",
              answered && isRight && "border-primary bg-primary/10 opacity-100",
              answered && !isRight && "opacity-40"
            )}
            onClick={() => onAnswer(choice)}
          >
            <span className="flex items-baseline gap-0.5">
              <span className="text-4xl font-semibold">{letterOf(choice)}</span>
              <span className="font-medium opacity-60">{octaveOf(choice)}</span>
            </span>
          </RippleButton>
        )
      })}
    </div>
  )
}

/* --- MIDI controls --------------------------------------------------------- */

/**
 * Replaces the Touch buttons in MIDI mode.
 *  - Left:  eighth note. After a wrong key it shows the correct answer.
 *  - Right: MIDI port. Doubles as connection status and (after a wrong key)
 *           the retry button. It's only interactive as the retry button.
 */
function MidiControls({
  question,
  wrongChoice,
  status,
  onRetry,
}: {
  question: Question | null
  wrongChoice: string | null
  status: MidiStatus
  onRetry: () => void
}) {
  const isRetry = wrongChoice !== null
  const isError = status === "error"
  const isConnected = status === "connected"
  const correct = isRetry && question ? question.note : null

  return (
    <div className="grid grid-cols-2 gap-3">
      <RippleButton
        size="lg"
        variant="outline"
        tabIndex={-1}
        aria-label={
          correct
            ? `Correct answer: ${letterOf(correct)}, octave ${octaveOf(correct)}`
            : "Play the note on your MIDI keyboard"
        }
        className={cn(
          "pointer-events-none h-20 border-2 px-0",
          correct && "border-primary bg-primary/10"
        )}
      >
        {correct ? (
          <span className="flex items-baseline gap-0.5">
            <span className="text-4xl font-semibold">{letterOf(correct)}</span>
            <span className="font-medium opacity-60">{octaveOf(correct)}</span>
          </span>
        ) : (
          <EighthNoteIcon
            className="size-7 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </RippleButton>

      <RippleButton
        size="lg"
        variant={isRetry || isError ? "destructive" : "outline"}
        tabIndex={isRetry ? undefined : -1}
        aria-label={isRetry ? "Try again" : (MIDI_STATUS_TEXT[status] ?? "")}
        onClick={isRetry ? onRetry : undefined}
        className={cn(
          "h-20 border-2 px-0",
          isRetry
            ? "border-destructive/20 active:scale-95"
            : "pointer-events-none",
          isError && "border-destructive/20",
          isConnected &&
            !isRetry &&
            "border-primary/30 bg-primary/10 text-primary"
        )}
      >
        {isRetry ? (
          <RotateCcwIcon className="size-7" aria-hidden="true" />
        ) : (
          <MidiPortIcon
            className={cn(
              "size-7",
              !isConnected && !isError && "text-muted-foreground"
            )}
            aria-hidden="true"
          />
        )}
      </RippleButton>
    </div>
  )
}

/* ==========================================================================
 * 8. PAGE
 * ======================================================================== */

export default function Page() {
  useVexFlowFonts()

  const {
    clef,
    category,
    maxScore,
    dailyXp,
    input,
    midiSupported,
    midiStatus,
    question,
    xp,
    wrongChoice,
    start,
    changeClef,
    changeCategory,
    changeInput,
    answer,
    retry,
  } = useGame()

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-6 overflow-hidden px-5 py-10 text-foreground">
      <Header
        clef={clef}
        category={category}
        input={input}
        midiSupported={midiSupported}
        midiStatus={midiStatus}
        onClefChange={changeClef}
        onCategoryChange={changeCategory}
        onInputChange={changeInput}
      />

      <Hud
        clef={clef}
        category={category}
        xp={xp}
        maxScore={maxScore}
        showBest={wrongChoice !== null}
        dailyXp={dailyXp}
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {question ? (
          // Draw the clef the question belongs to (matters for Grand Staff)
          <StaffView note={question.note} clef={question.clef} />
        ) : (
          <StartScreen maxScore={maxScore} dailyXp={dailyXp} onStart={start} />
        )}
      </div>

      <div className="min-h-20 shrink-0 [@media(max-height:700px)]:min-h-16">
        {input === "midi" ? (
          // Always shown in MIDI mode so the connection status is visible
          // even before the game starts
          <MidiControls
            question={question}
            wrongChoice={wrongChoice}
            status={midiStatus}
            onRetry={retry}
          />
        ) : (
          question && (
            <AnswerChoices
              question={question}
              wrongChoice={wrongChoice}
              onAnswer={answer}
              onRetry={retry}
            />
          )
        )}
      </div>
    </main>
  )
}
