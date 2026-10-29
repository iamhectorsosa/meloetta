"use client"

import { useEffect, useRef, useState } from "react"
import { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const NOTES = [
  "g/3", // Space below the 2nd ledger line below staff
  "a/3", // 2nd ledger line below staff
  "b/3", // Space below the 1st ledger line below staff
  "c/4", // 1st ledger line below staff (Middle C)
  "d/4", // Space just below the staff
  "e/4", // 1st line (Bottom line of staff) - 'E'very
  "f/4", // 1st space (Bottom space) - 'F'
  "g/4", // 2nd line - 'G'ood
  "a/4", // 2nd space - 'A'
  "b/4", // 3rd line (Middle line) - 'B'oy
  "c/5", // 3rd space - 'C'
  "d/5", // 4th line - 'D'eserves
  "e/5", // 4th space (Top space) - 'E'
  "f/5", // 5th line (Top line of staff) - 'F'udge
  "g/5", // Space just above the staff
  "a/5", // 1st ledger line above staff
  "b/5", // Space above the 1st ledger line above staff
  "c/6", // 2nd ledger line above staff (High C)
  "d/6", // Space above the 2nd ledger line above staff
  "e/6", // 3rd ledger line above staff
  "f/6", // Space above the 3rd ledger line above staff
  "g/6", // 4th ledger line above staff
]

type Question = { note: string; choices: string[] }

const label = (key: string) => key.replace("/", "").toUpperCase()
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5)
const newQuestion = (): Question => {
  const note = NOTES[Math.floor(Math.random() * NOTES.length)]
  return {
    note,
    choices: shuffle([
      note,
      ...shuffle(NOTES.filter((n) => n !== note)).slice(0, 2),
    ]),
  }
}

export default function Page() {
  const staffRef = useRef<HTMLDivElement>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<{
    selected: string
    correct: boolean
  } | null>(null)

  useEffect(() => {
    const el = staffRef.current
    if (!el || !question) return
    el.innerHTML = ""

    // Squarish logical size
    const W = 150
    const H = 150

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(W, H)
    const ctx = renderer.getContext()
    const stave = new Stave(0, 12, W - 1).addClef("treble")
    stave.setContext(ctx).draw()

    const note = new StaveNote({
      keys: [question.note],
      duration: "q",
      clef: "treble",
    })
    const voice = new Voice({ numBeats: 1, beatValue: 4 }).addTickable(note)
    new Formatter().joinVoices([voice]).format([voice], 100)
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

  function answer(selected: string) {
    if (!question) return
    const correct = selected === question.note
    setFeedback({ selected, correct })
    if (correct) {
      setQuestion(newQuestion())
      setFeedback(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col space-y-6 bg-background px-5 py-10 text-foreground">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Treble Clef Practice
        </p>
      </header>

      {!question ? (
        <Button
          size="lg"
          className="mx-auto"
          onClick={() => setQuestion(newQuestion())}
        >
          Start
        </Button>
      ) : (
        <>
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
