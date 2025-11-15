// src/components/ui/gauge.tsx
"use client"

import { useEffect, useRef } from "react"
import type { SVGProps } from "react"

export function Gauge({
  value = 0,
  min = 0,
  max = 100,
  size = 200,
  label = "Speed",
  unit = "km/h",
  showValue = true,
  primary = "#10b981",
  ...props
}: {
  value: number
  min?: number
  max?: number
  size?: number
  label?: string
  unit?: string
  showValue?: boolean
  primary?: string
} & SVGProps<SVGSVGElement>) {
  const circleRef = useRef<SVGCircleElement>(null)
  const valueRef = useRef<number>(0)

  const radius = 45
  const circumference = 2 * Math.PI * radius

  // Animate the gauge
  useEffect(() => {
    if (!circleRef.current) return

    const animate = () => {
      if (!circleRef.current) return

      const currentValue = valueRef.current
      const targetValue = value

      if (currentValue === targetValue) return

      const difference = targetValue - currentValue
      const step = difference * 0.1

      valueRef.current = Math.abs(step) < 0.1 ? targetValue : currentValue + step

      const currentPercentage = Math.min(Math.max((valueRef.current - min) / (max - min) * 100, 0), 100)
      const currentOffset = circumference - (currentPercentage / 100) * circumference

      circleRef.current.style.strokeDashoffset = currentOffset.toString()

      if (valueRef.current !== targetValue) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, min, max, circumference])

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 20}
        viewBox="0 0 120 80"
        {...props}
      >
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-180 60 60)"
        />

        {/* Progress circle */}
        <circle
          ref={circleRef}
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={primary}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-180 60 60)"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out',
          }}
        />

        {/* Value display */}
        {showValue && (
          <text
            x="60"
            y="50"
            textAnchor="middle"
            className="text-xl font-bold fill-gray-800"
          >
            {value.toFixed(1)} {unit}
          </text>
        )}

        {/* Label */}
        <text
          x="60"
          y="75"
          textAnchor="middle"
          className="text-sm fill-gray-500"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

export default Gauge;