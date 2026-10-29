"use client"

import { useEffect, useRef, useState } from "react"
import { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const NOTES = [
  "c/3",
  "d/3",
  "e/3",
  "f/3",
  "g/3",
  "a/3",
  "b/3",
  "c/4",
  "d/4",
  "e/4",
  "f/4",
  "g/4",
  "a/4",
  "b/4",
  "c/5",
  "d/5",
  "e/5",
  "f/5",
  "g/5",
  "a/5",
  "b/5",
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<{
    selected: string
    correct: boolean
  } | null>(null)

  useEffect(() => () => clearTimeout(timeoutRef.current ?? undefined), [])

  useEffect(() => {
    const el = staffRef.current
    if (!el || !question) return
    el.innerHTML = ""

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(320, 160)
    const ctx = renderer.getContext()
    const stave = new Stave(10, 20, 300).addClef("treble")
    stave.setContext(ctx).draw()

    const note = new StaveNote({
      keys: [question.note],
      duration: "q",
      clef: "treble",
    })
    const voice = new Voice({ numBeats: 1, beatValue: 4 }).addTickable(note)
    new Formatter().joinVoices([voice]).format([voice], 100)
    voice.draw(ctx, stave)
  }, [question])

  function answer(selected: string) {
    if (!question) return
    const correct = selected === question.note
    setFeedback({ selected, correct })
    if (correct) {
      timeoutRef.current = setTimeout(() => {
        setQuestion(newQuestion())
        setFeedback(null)
      }, 1000)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-5 py-10 text-foreground">
      <header className="mb-10 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Music practice
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Note reading
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Which note do you see?
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

          <div className="mt-8 grid grid-cols-3 gap-3">
            {question.choices.map((choice) => (
              <Button
                key={choice}
                variant={
                  feedback?.selected === choice && !feedback.correct
                    ? "destructive"
                    : "outline"
                }
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
