"use client"

import { useEffect, useRef, useState } from "react"
import { Barline, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CountingNumber } from "@/components/ui/counting-number"
import { Progress } from "@/components/ui/progress"

import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"

// ---------------------------------------------------------------------------
// XP settings
// ---------------------------------------------------------------------------

const XP_PER_ANSWER = 10
const XP_PER_BAR = 100 // the bar fills every 100 XP, then starts over

// ---------------------------------------------------------------------------
// Notes: single source of truth
// ---------------------------------------------------------------------------

type Note = {
  key: string // VexFlow key, e.g. "e/4"
  region: "below" | "staff" | "above" // where it sits relative to the staff
  position: "line" | "space" // whether it sits on a line or in a space
}

const NOTES: Note[] = [
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

// ---------------------------------------------------------------------------
// Practice options: each option carries its own filter
// ---------------------------------------------------------------------------

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
      { value: "all", label: "Full Range", match: () => true },
      {
        value: "staff",
        label: "On the Staff",
        match: (n) => n.region === "staff",
      },
      {
        value: "below_staff",
        label: "Ledger Lines Below",
        match: (n) => n.region === "below",
      },
      {
        value: "above_staff",
        label: "Ledger Lines Above",
        match: (n) => n.region === "above",
      },
    ],
  },
  {
    label: "Beginner",
    options: [
      {
        value: "lines",
        label: "Staff Lines Only",
        match: (n) => n.region === "staff" && n.position === "line",
      },
      {
        value: "spaces",
        label: "Staff Spaces Only",
        match: (n) => n.region === "staff" && n.position === "space",
      },
    ],
  },
]

const ALL_OPTIONS = PRACTICE_GROUPS.flatMap((g) => g.options)

const notePool = (category: Category) => {
  const option = ALL_OPTIONS.find((o) => o.value === category)
  return NOTES.filter(option?.match ?? (() => true)).map((n) => n.key)
}

// ---------------------------------------------------------------------------
// Question helpers
// ---------------------------------------------------------------------------

type Question = { note: string; choices: string[] }

const label = (key: string) => key.replace("/", "").toUpperCase()
const shuffle = <T,>(items: T[]) => {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const newQuestion = (category: Category, previous?: string): Question => {
  const pool = notePool(category)
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Page() {
  const staffRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState<Category>("all")
  const [question, setQuestion] = useState<Question | null>(null)
  const [xp, setXp] = useState(0)
  const [feedback, setFeedback] = useState<{
    selected: string
    correct: boolean
  } | null>(null)

  useEffect(() => {
    const el = staffRef.current
    if (!el || !question) return
    el.innerHTML = ""

    // Squarish logical size
    const W = 160
    const H = 140

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(W, H)
    const ctx = renderer.getContext()
    const stave = new Stave(0, 12, W - 2)
      .addClef("treble")
      .addTimeSignature("4/4")
      .setEndBarType(Barline.type.END)
    stave.setContext(ctx).draw()

    const note = new StaveNote({
      keys: [question.note],
      duration: "w",
      clef: "treble",
    })
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickable(note)
    const formatWidth = stave.getNoteEndX() - stave.getNoteStartX() - 10
    new Formatter().joinVoices([voice]).format([voice], formatWidth)
    voice.draw(ctx, stave)

    const svg = el.querySelector("svg")
    if (svg) {
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
      svg.removeAttribute("width")
      svg.removeAttribute("height")
      svg.style.width = "100%"
      svg.style.height = "auto"
    }
  }, [question])

  function changeCategory(next: Category) {
    setCategory(next)
    setFeedback(null)
    // If a session is already running, switch to the new pool immediately
    if (question) setQuestion(newQuestion(next, question.note))
  }

  function answer(selected: string) {
    if (!question) return
    const correct = selected === question.note
    setFeedback({ selected, correct })
    if (correct) {
      // +10 XP (total keeps growing; only the bar wraps around)
      setXp((prev) => prev + XP_PER_ANSWER)
      setQuestion(newQuestion(category, question.note))
      setFeedback(null)
    } else {
      // -10 XP, never below 0
      setXp((prev) => Math.max(0, prev - XP_PER_ANSWER))
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col space-y-6 bg-background px-5 py-10 text-foreground">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Treble Clef Practice
        </p>
      </header>

      <div className="mx-auto">
        <NativeSelect
          value={category}
          onChange={(e) => changeCategory(e.currentTarget.value as Category)}
        >
          {PRACTICE_GROUPS.map((group) => (
            <NativeSelectOptGroup key={group.label} label={group.label}>
              {group.options.map((opt) => (
                <NativeSelectOption key={opt.value} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </div>

      {!question ? (
        <Button
          size="lg"
          className="mx-auto"
          onClick={() => setQuestion(newQuestion(category))}
        >
          Start
        </Button>
      ) : (
        <>
          <div className="flex flex-col gap-y-1">
            <CountingNumber
              className="ml-auto text-xl font-semibold tracking-tight text-muted-foreground"
              grouping
              value={xp}
            />
            <Progress value={xp % XP_PER_BAR} className="w-full" />
          </div>

          <Card className="flex min-h-48 items-center justify-center overflow-hidden p-4">
            <div
              ref={staffRef}
              className="w-full [&_svg]:mx-auto [&_svg]:max-w-full"
            />
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {question.choices.map((choice) => (
              <Button
                key={choice}
                variant={
                  feedback?.selected === choice && !feedback.correct
                    ? "destructive"
                    : "outline"
                }
                size="lg"
                className="h-16 text-xl"
                onClick={() => answer(choice)}
              >
                {label(choice)}
              </Button>
            ))}
          </div>

          <p
            className="mt-5 min-h-6 text-center text-sm text-muted-foreground"
            aria-live="polite"
          >
            {feedback?.correct
              ? "Correct!"
              : feedback
                ? "Not quite. Try again!"
                : ""}
          </p>
        </>
      )}
    </main>
  )
}
