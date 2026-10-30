"use client"

import { type CSSProperties, type ReactNode, useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ButtonProps = React.ComponentProps<typeof Button>

export interface RippleButtonProps extends Omit<ButtonProps, "children"> {
  /** The label; the ripple spreads under it. */
  children?: ReactNode
  /**
   * How long one ripple takes to spread and fade, in milliseconds.
   *
   * @default 600
   */
  duration?: number
  /**
   * The ripple's color, any CSS color, at a third of its strength. By
   * default the label's color.
   */
  rippleColor?: string
}

type PointerDownEvent = Parameters<NonNullable<ButtonProps["onPointerDown"]>>[0]
type KeyDownEvent = Parameters<NonNullable<ButtonProps["onKeyDown"]>>[0]

/**
 * A Button that sends a ripple out from where it was pressed (from its
 * center for Enter and Space), as press feedback. A press writes where it
 * landed into two CSS variables and swaps the ripple between two names of
 * the `ripple-button` keyframes, which restarts it: no state, no
 * re-render. No ripple with reduced motion.
 *
 * @cssvar --ripple-button-color The ripple's color (the label's by default).
 * @cssvar --ripple-button-duration One ripple's spread and fade (`600ms`).
 * @cssvar --ripple-button-x Where the last press landed, from the left.
 * @cssvar --ripple-button-y Where the last press landed, from the top.
 */
export const RippleButton = (props: RippleButtonProps) => {
  const {
    duration,
    rippleColor,
    onPointerDown,
    onKeyDown,
    className,
    children,
    ...rest
  } = props
  const ripple = useRef<HTMLSpanElement>(null)

  const start = (x: string, y: string) => {
    const node = ripple.current
    if (!node) {
      return
    }
    node.style.setProperty("--ripple-button-x", x)
    node.style.setProperty("--ripple-button-y", y)
    node.dataset.wave = node.dataset.wave === "a" ? "b" : "a"
  }

  const pointerDown = (event: PointerDownEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    start(`${event.clientX - rect.left}px`, `${event.clientY - rect.top}px`)
    onPointerDown?.(event)
  }

  const keyDown = (event: KeyDownEvent) => {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      start("50%", "50%")
    }
    onKeyDown?.(event)
  }

  return (
    <Button
      className={cn("relative", className)}
      onKeyDown={keyDown}
      onPointerDown={pointerDown}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="group/ripple pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] motion-reduce:hidden"
        data-slot="ripple-button-ripple"
        ref={ripple}
        style={
          {
            "--ripple-button-color": rippleColor,
            "--ripple-button-duration":
              duration === undefined ? undefined : `${duration}ms`,
          } as CSSProperties
        }
      >
        <span
          className={cn(
            "absolute top-(--ripple-button-y,50%) left-(--ripple-button-x,50%) aspect-square w-[300%] -translate-1/2 scale-0 rounded-full bg-(--ripple-button-color,currentColor) opacity-0",
            "group-data-[wave=a]/ripple:animate-ripple-button group-data-[wave=b]/ripple:animate-ripple-button-again"
          )}
        />
      </span>
      <span className="relative inline-flex items-center gap-[inherit]">
        {children}
      </span>
    </Button>
  )
}
