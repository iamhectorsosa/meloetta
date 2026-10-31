"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import VexFlow, { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow"
import { CheckIcon, RotateCcwIcon, SettingsIcon } from "lucide-react"
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

const STAFF_WIDTH = 100
const STAFF_HEIGHT = 150

/* ==========================================================================
 * 2. DOMAIN: clefs, notes, practice options
 * ======================================================================== */

type Clef = "treble" | "bass"

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

const NOTES_BY_CLEF: Record<Clef, Note[]> = {
  treble: NOTES_TREBLE,
  bass: NOTES_BASS,
}

const CLEF_OPTIONS: { value: Clef; label: string; short: string }[] = [
  { value: "treble", label: "Treble clef", short: "Treble" },
  { value: "bass", label: "Bass clef", short: "Bass" },
]

type Category =
  "all" | "staff" | "below_staff" | "above_staff" | "lines" | "spaces"

type PracticeOption = {
  value: Category
  label: string
  match: (note: Note) => boolean
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

const DEFAULT_CLEF: Clef = "treble"
const DEFAULT_CATEGORY: Category = "all"

const isClef = (value: string | undefined): value is Clef =>
  CLEF_OPTIONS.some((o) => o.value === value)

const isCategory = (value: string | undefined): value is Category =>
  ALL_OPTIONS.some((o) => o.value === value)

const clefShortLabel = (clef: Clef) =>
  CLEF_OPTIONS.find((o) => o.value === clef)?.short ?? ""

const categoryLabel = (category: Category) =>
  ALL_OPTIONS.find((o) => o.value === category)?.label ?? ""

/** All VexFlow keys available for a given clef + practice category. */
const notePool = (category: Category, clef: Clef) => {
  const option = ALL_OPTIONS.find((o) => o.value === category)
  return NOTES_BY_CLEF[clef]
    .filter(option?.match ?? (() => true))
    .map((n) => n.key)
}

/* ==========================================================================
 * 3. QUESTIONS
 * ======================================================================== */

type Question = { note: string; choices: string[] }

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
  previous?: string
): Question => {
  const pool = notePool(category, clef)
  const candidates = pool.filter((n) => n !== previous)
  const note = candidates[Math.floor(Math.random() * candidates.length)]
  return {
    note,
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
 * ======================================================================== */

const storeListeners = new Set<() => void>()

const subscribeToStorage = (listener: () => void) => {
  storeListeners.add(listener)
  window.addEventListener("storage", listener) // changes from other tabs
  return () => {
    storeListeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/** `storage` events only fire in *other* tabs, so notify this tab manually. */
const emitStorageChange = () => storeListeners.forEach((l) => l())

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // Storage unavailable (private mode, etc.)
  }
}

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode, quota, etc.): fail silently
  }
  emitStorageChange()
}

/* --- Keys & (de)serialization ------------------------------------------- */

// Max score: one key per clef + category
const maxScoreKey = (clef: Clef, category: Category) =>
  `app@meloetta:${clef}:${category}`

// Last-used settings: a single key, value is "<clef>:<category>"
const SETTINGS_KEY = "app@meloetta:settings"

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

/* --- Writers ------------------------------------------------------------ */

const writeSettings = (clef: Clef, category: Category) =>
  writeStorage(SETTINGS_KEY, `${clef}:${category}`)

const writeMaxScore = (clef: Clef, category: Category, score: number) =>
  writeStorage(maxScoreKey(clef, category), String(score))

/* ==========================================================================
 * 5. HOOKS
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

/** All game state and actions. The UI components below stay dumb. */
function useGame() {
  const { clef, category } = useSettings()
  const maxScore = useMaxScore(clef, category)

  const [question, setQuestion] = useState<Question | null>(null)
  const [xp, setXp] = useState(0)
  // Set when the user picks a wrong answer; holds the choice they clicked
  const [wrongChoice, setWrongChoice] = useState<string | null>(null)

  function start() {
    setXp(0)
    setWrongChoice(null)
    setQuestion(newQuestion(category, clef))
  }

  function changeClef(next: Clef) {
    if (next === clef) return
    writeSettings(next, category)
    setXp(0)
    setWrongChoice(null)
    // If a session is already running, switch to the new clef immediately
    if (question) setQuestion(newQuestion(category, next, question.note))
  }

  function changeCategory(next: Category) {
    if (next === category) return
    writeSettings(clef, next)
    setXp(0)
    setWrongChoice(null)
    // If a session is already running, switch to the new pool immediately
    if (question) setQuestion(newQuestion(next, clef, question.note))
  }

  function answer(selected: string) {
    if (!question || wrongChoice) return
    if (selected === question.note) {
      const nextXp = xp + XP_PER_ANSWER
      setXp(nextXp)
      // Only ever store the score when it beats the stored max
      if (nextXp > maxScore) writeMaxScore(clef, category, nextXp)
      setQuestion(newQuestion(category, clef, question.note))
    } else {
      // Wrong answer: keep the XP on screen and reveal the best score.
      // The reset to 0 only happens when the user hits retry.
      setWrongChoice(selected)
    }
  }

  function retry() {
    setWrongChoice(null)
    setXp(0)
    setQuestion(newQuestion(category, clef, question?.note))
  }

  return {
    clef,
    category,
    maxScore,
    question,
    xp,
    wrongChoice,
    start,
    changeClef,
    changeCategory,
    answer,
    retry,
  }
}

/* ==========================================================================
 * 6. COMPONENTS
 * ======================================================================== */

/* --- Shared: a selectable row used in the settings drawer ---------------- */

function OptionButton({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Button
      role="radio"
      aria-checked={selected}
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
  )
}

/* --- Settings drawer ------------------------------------------------------ */

function SettingsDrawer({
  clef,
  category,
  onClefChange,
  onCategoryChange,
}: {
  clef: Clef
  category: Category
  onClefChange: (clef: Clef) => void
  onCategoryChange: (category: Category) => void
}) {
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
            Choose a clef and which notes you see.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5 px-4 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
      <h1 className="text-2xl font-semibold tracking-tight text-foreground underline decoration-primary decoration-wavy decoration-2 underline-offset-4">
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
}: {
  clef: Clef
  category: Category
  xp: number
  maxScore: number
  showBest: boolean
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
  onStart,
}: {
  maxScore: number
  onStart: () => void
}) {
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
    </div>
  )
}

/* --- Staff: renders a single note with VexFlow ---------------------------- */

function StaffView({ note, clef }: { note: string; clef: Clef }) {
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

/* --- Answer buttons -------------------------------------------------------- */

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

/* ==========================================================================
 * 7. PAGE
 * ======================================================================== */

export default function Page() {
  useVexFlowFonts()

  const {
    clef,
    category,
    maxScore,
    question,
    xp,
    wrongChoice,
    start,
    changeClef,
    changeCategory,
    answer,
    retry,
  } = useGame()

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-6 overflow-hidden px-5 py-10 text-foreground">
      <Header
        clef={clef}
        category={category}
        onClefChange={changeClef}
        onCategoryChange={changeCategory}
      />

      <Hud
        clef={clef}
        category={category}
        xp={xp}
        maxScore={maxScore}
        showBest={wrongChoice !== null}
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {question ? (
          <StaffView note={question.note} clef={clef} />
        ) : (
          <StartScreen maxScore={maxScore} onStart={start} />
        )}
      </div>

      <div className="min-h-20 shrink-0 [@media(max-height:700px)]:min-h-16">
        {question && (
          <AnswerChoices
            question={question}
            wrongChoice={wrongChoice}
            onAnswer={answer}
            onRetry={retry}
          />
        )}
      </div>
    </main>
  )
}
