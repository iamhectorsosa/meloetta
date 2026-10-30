"use client"

import { useEffect, useRef, useState } from "react"
import VexFlow, { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow"
import { CheckIcon, SettingsIcon } from "lucide-react"
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

/** "e/5" -> "E" and "5" */
const letterOf = (key: string) => key[0].toUpperCase()
const octaveOf = (key: string) => key.slice(2)

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
    async function loadFonts() {
      await VexFlow.loadFonts("Finale Jazz") // fonts for text and music
      VexFlow.setFonts("Finale Jazz")
    }
    loadFonts()
  }, [])

  useEffect(() => {
    const el = staffRef.current
    if (!el || !question) return
    el.innerHTML = ""

    // Squarish logical size
    const W = 100
    const H = 150

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(W, H)
    const ctx = renderer.getContext()
    const stave = new Stave(0, 12, W - 2).addClef("treble")
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
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
      svg.removeAttribute("width")
      svg.removeAttribute("height")
      svg.style.width = "100%"
      svg.style.height = "100%"
      svg.style.opacity = "85%"
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
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-6 overflow-hidden px-5 py-10 text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground underline decoration-primary decoration-wavy decoration-2 underline-offset-4">
          Meloetta
        </h1>

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
              <DrawerDescription>Choose which notes you see.</DrawerDescription>
            </DrawerHeader>
            <div
              role="radiogroup"
              aria-label="Practice set"
              className="flex flex-col gap-5 px-4 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))]"
            >
              {PRACTICE_GROUPS.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {group.options.map((opt) => {
                      const selected = opt.value === category
                      return (
                        <Button
                          key={opt.value}
                          role="radio"
                          aria-checked={selected}
                          variant="outline"
                          className={cn(
                            "h-12 w-full justify-between rounded-xl px-4 text-base",
                            selected && "border-primary bg-accent"
                          )}
                          onClick={() => changeCategory(opt.value)}
                        >
                          {opt.label}
                          {selected && (
                            <CheckIcon
                              aria-hidden="true"
                              className="size-5 text-primary-foreground"
                            />
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </header>

      {/* HUD: always visible so nothing jumps when the game starts ----------- */}
      <section aria-label="Progress" className="flex shrink-0 flex-col gap-2">
        <div className="ml-auto flex items-baseline gap-1 text-muted-foreground">
          <CountingNumber
            className="text-3xl font-semibold tracking-tight"
            grouping
            value={xp}
          />
          <span className="text-sm font-medium">XP</span>
        </div>
        <Progress
          value={xp % XP_PER_BAR}
          aria-label="Experience toward the next 100"
          className="w-full"
        />
      </section>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {question ? (
          <div
            ref={staffRef}
            role="img"
            aria-label="Treble clef staff showing one note"
            className="relative z-10 h-full w-full max-w-[20rem] [&_svg]:mx-auto [&_svg]:h-full [&_svg]:max-w-full"
          />
        ) : (
          <div className="relative z-10 flex flex-col items-center gap-6">
            <RippleButton
              size="lg"
              className="h-16 w-56 text-xl"
              onClick={() => setQuestion(newQuestion(category))}
            >
              Start
            </RippleButton>
            <p className="text-muted-foreground">Name the note you see.</p>
          </div>
        )}
      </div>

      <div className="min-h-20 shrink-0 [@media(max-height:700px)]:min-h-16">
        {question && (
          <div className="grid grid-cols-3 gap-3">
            {question.choices.map((choice) => {
              const wrong = feedback?.selected === choice
              return (
                <RippleButton
                  key={choice}
                  size="lg"
                  variant={wrong ? "destructive" : "outline"}
                  aria-label={`${letterOf(choice)}, octave ${octaveOf(choice)}`}
                  className="h-20 border-2 px-0 active:scale-95 [@media(max-height:700px)]:h-16"
                  onClick={() => answer(choice)}
                >
                  <span className="flex items-baseline gap-0.5">
                    <span className="text-4xl font-semibold">
                      {letterOf(choice)}
                    </span>
                    <span className="font-medium opacity-60">
                      {octaveOf(choice)}
                    </span>
                  </span>
                </RippleButton>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
