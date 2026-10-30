"use client"

import { type ComponentProps, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface CountingNumberProps extends Omit<
  ComponentProps<"span">,
  "children"
> {
  /** How many digits after the decimal point, always shown. @default 0 */
  decimals?: number
  /** How long a count takes from start to finish, in milliseconds. @default 2000 */
  duration?: number
  /** Where the first count starts. @default 0 */
  from?: number
  /** Thousands separators (`12,480`). @default false */
  grouping?: boolean
  /**
   * The locale the number is written in (its digits, decimal point and
   * grouping). Fixed by default, so the server and the browser write it the
   * same way.
   *
   * @default "en-US"
   */
  locale?: string
  /** Called each time a count reaches its value. */
  onComplete?: () => void
  /** At least this many digits before the decimal point (`05`). @default 1 */
  pad?: number
  /**
   * When the count starts: as soon as the page shows it, or once it scrolls
   * into view.
   *
   * @default "mount"
   */
  trigger?: "mount" | "view"
  /** The number. Each new value counts on from wherever the number is. */
  value: number
}

/** The time between one number and the next, in milliseconds. */
const TICK = 30

interface Count {
  from: number
  step: number
  to: number
}

interface Format {
  decimals: number
  grouping: boolean
  locale: string
  pad: number
}

/**
 * Where a count is at a step: eased out, so it races off and slows into the
 * value, the last digits ticking over one by one.
 */
const frameAt = (count: Count, steps: number) => {
  const t = Math.min(count.step / steps, 1)
  const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t)
  return {
    done: count.step >= steps,
    ends: count.step + 1 >= steps,
    next: count.step + 1,
    shown: count.from + (count.to - count.from) * eased,
  }
}

/** A number written out, rounded first so a count through zero never shows `-0`. */
const write = (value: number, format: Format) => {
  const scale = 10 ** format.decimals
  return new Intl.NumberFormat(format.locale, {
    maximumFractionDigits: format.decimals,
    minimumFractionDigits: format.decimals,
    minimumIntegerDigits: format.pad,
    useGrouping: format.grouping,
  }).format(Math.round(value * scale) / scale || 0)
}

/**
 * A number that counts to its value through every number on the way,
 * racing off and slowing into it like a ticker. A timer moves the count on
 * every 30 ms; each step's number comes from how far along the count is,
 * eased out, written with `Intl.NumberFormat` in tabular figures so the
 * digits never jostle. A new value counts on from wherever the number is.
 * Screen readers read the value, never the count; with reduced motion the
 * value shows at once.
 */
export const CountingNumber = (props: CountingNumberProps) => {
  const {
    decimals = 0,
    duration = 2000,
    from = 0,
    grouping = false,
    locale = "en-US",
    onComplete,
    pad = 1,
    trigger = "mount",
    value,
    className,
    ...rest
  } = props
  const root = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(trigger === "mount")
  // The count under way: where it started, where it's going, how far along.
  const [count, setCount] = useState<Count>({ from, step: 0, to: value })
  const steps = Math.max(1, Math.round(duration / TICK))
  const frame = frameAt(count, steps)
  const format = { decimals, grouping, locale, pad }

  useEffect(() => {
    const node = root.current
    if (trigger !== "view" || !node) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          setVisible(true)
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [trigger])

  // A new value: count on to it from the number showing now.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount((last) =>
      last.to === value
        ? last
        : { from: frameAt(last, steps).shown, step: 0, to: value }
    )
  }, [value, steps])

  // One step at a time; with reduced motion, straight to the value.
  useEffect(() => {
    if (!visible || frame.done) {
      return
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const timer = window.setTimeout(
      () => {
        setCount({
          from: count.from,
          step: reduced ? steps : frame.next,
          to: count.to,
        })
        if (reduced || frame.ends) {
          onComplete?.()
        }
      },
      reduced ? 0 : TICK
    )
    return () => window.clearTimeout(timer)
  }, [
    visible,
    frame.done,
    frame.ends,
    frame.next,
    count.from,
    count.to,
    steps,
    onComplete,
  ])

  return (
    <span
      className={cn("tabular-nums", className)}
      data-slot="counting-number"
      ref={root}
      {...rest}
    >
      <span className="sr-only">{write(value, format)}</span>
      <span aria-hidden="true">
        <span className="motion-reduce:hidden noscript:hidden">
          {write(frame.shown, format)}
        </span>
        {/* Reduced motion, or no script: the value itself, never counted. */}
        <span className="hidden motion-reduce:inline noscript:inline">
          {write(value, format)}
        </span>
      </span>
    </span>
  )
}
