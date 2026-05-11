import { useState, useRef, useEffect } from 'react'
import { cn } from '@renderer/lib/utils'
import { PRESET_THEME_COLORS, hexToHsl, hslToHex } from '@renderer/lib/themeColor'
import { Pipette, RotateCcw } from 'lucide-react'

interface ColorPickerProps {
  value: string // hex color
  onChange: (hex: string) => void
  onClose: () => void
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const [hex, setHex] = useState(value)
  const [hsl, setHsl] = useState<[number, number, number]>(hexToHsl(value))
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleHexInput = (v: string) => {
    setHex(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const newHsl = hexToHsl(v)
      setHsl(newHsl)
      onChange(v)
    }
  }

  const handleHslChange = (idx: 0 | 1 | 2, val: number) => {
    const newHsl: [number, number, number] = [...hsl] as [number, number, number]
    newHsl[idx] = val
    setHsl(newHsl)
    const newHex = hslToHex(newHsl[0], newHsl[1], newHsl[2])
    setHex(newHex)
    onChange(newHex)
  }

  const handlePreset = (presetHex: string) => {
    setHex(presetHex)
    setHsl(hexToHsl(presetHex))
    onChange(presetHex)
  }

  const handleReset = () => {
    const defaultHex = '#8b5cf6'
    handlePreset(defaultHex)
  }

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50 p-4"
    >
      {/* Color preview */}
      <div
        className="w-full h-12 rounded-lg mb-4 border border-gray-200 dark:border-gray-700"
        style={{ backgroundColor: hex }}
      />

      {/* HSL sliders */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>色相 H</span>
            <span>{hsl[0]}°</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }}>
            <input
              type="range" min={0} max={360} value={hsl[0]}
              onChange={(e) => handleHslChange(0, parseInt(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{ left: `calc(${(hsl[0] / 360) * 100}% - 8px)`, backgroundColor: `hsl(${hsl[0]}, 100%, 50%)` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>饱和度 S</span>
            <span>{hsl[1]}%</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{
            background: `linear-gradient(to right, hsl(${hsl[0]}, 0%, ${hsl[2]}%), hsl(${hsl[0]}, 100%, ${hsl[2]}%))`
          }}>
            <input
              type="range" min={0} max={100} value={hsl[1]}
              onChange={(e) => handleHslChange(1, parseInt(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{ left: `calc(${hsl[1]}% - 8px)`, backgroundColor: hex }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>亮度 L</span>
            <span>{hsl[2]}%</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{
            background: `linear-gradient(to right, #000, hsl(${hsl[0]}, ${hsl[1]}%, 50%), #fff)`
          }}>
            <input
              type="range" min={0} max={100} value={hsl[2]}
              onChange={(e) => handleHslChange(2, parseInt(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{ left: `calc(${hsl[2]}% - 8px)`, backgroundColor: hex }}
            />
          </div>
        </div>
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-2 mb-4">
        <Pipette size={13} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={hex}
          onChange={(e) => handleHexInput(e.target.value)}
          className="flex-1 px-2 py-1 text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
          placeholder="#8b5cf6"
          maxLength={7}
        />
        <button
          onClick={handleReset}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="重置为默认色"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Preset colors */}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">预设主题</p>
        <div className="grid grid-cols-8 gap-1.5">
          {PRESET_THEME_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => handlePreset(color.hex)}
              className={cn(
                'w-8 h-8 rounded-lg border-2 transition-all hover:scale-110',
                hex.toLowerCase() === color.hex.toLowerCase()
                  ? 'border-gray-900 dark:border-white scale-110 shadow-md'
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              )}
              style={{ backgroundColor: color.hex }}
              title={color.label}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
