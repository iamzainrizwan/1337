import { useEffect, useRef } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"

export function AnimatedNumber({
  value,
  className,
  decimals = 0,
}: {
  value: number
  className?: string
  decimals?: number
}) {
  const motionVal = useMotionValue(0)
  const rounded = useTransform(motionVal, (v) => v.toFixed(decimals))
  const prev = useRef(0)

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.7,
      ease: "easeOut",
    })
    prev.current = value
    return controls.stop
  }, [value, motionVal])

  return <motion.span className={className}>{rounded}</motion.span>
}
