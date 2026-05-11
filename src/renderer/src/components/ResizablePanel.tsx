import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ResizablePanelProps {
  children: React.ReactNode
  side: 'left' | 'right'
  width: number
  collapsed: boolean
  onWidthChange: (width: number) => void
  onToggle: () => void
  minWidth?: number
  maxWidth?: number
  className?: string
}

export function ResizablePanel({
  children,
  side,
  width,
  collapsed,
  onWidthChange,
  onToggle,
  minWidth = 160,
  maxWidth = 600,
  className
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()

      let newWidth: number
      if (side === 'left') {
        newWidth = e.clientX - rect.left
      } else {
        newWidth = rect.right - e.clientX
      }

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      onWidthChange(newWidth)
    }

    const handleMouseUp = () => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, side, minWidth, maxWidth, onWidthChange])

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Chevron direction: when collapsed, points toward expanding; when expanded, points toward collapsing
  const CollapseIcon = side === 'left' ? ChevronLeft : ChevronRight
  const ExpandIcon = side === 'left' ? ChevronRight : ChevronLeft

  return (
    <div
      ref={panelRef}
      className={cn(
        'shrink-0 relative group/panel',
        !isResizing && 'transition-[width] duration-200',
        className
      )}
      style={{ width: collapsed ? 0 : width }}
    >
      {/* Panel content */}
      {!collapsed && (
        <div className="h-full overflow-hidden">
          {children}
        </div>
      )}

      {/* Edge toggle + resize handle */}
      <div
        className={cn(
          'absolute top-0 bottom-0 z-10 flex items-center',
          side === 'left' ? '-right-[6px]' : '-left-[6px]'
        )}
      >
        {/* Resize drag zone (invisible wider area) */}
        {!collapsed && (
          <div
            className={cn(
              'absolute top-0 bottom-0 w-[8px] cursor-col-resize',
              side === 'left' ? '-right-[1px]' : '-left-[1px]',
              'hover:after:opacity-100 after:opacity-0 after:transition-opacity',
              'after:absolute after:inset-y-0 after:w-[2px] after:bg-[hsl(var(--primary)/0.4)]',
              side === 'left' ? 'after:right-[3px]' : 'after:left-[3px]',
              isResizing && 'after:opacity-100 after:bg-[hsl(var(--primary)/0.6)]'
            )}
            onMouseDown={() => setIsResizing(true)}
          />
        )}

        {/* Toggle button — thin pill on the edge */}
        <button
          onClick={onToggle}
          className={cn(
            'relative flex items-center justify-center',
            'w-[14px] h-[36px] rounded-full',
            'bg-[hsl(var(--background))] border border-[hsl(var(--border))]',
            'text-[hsl(var(--muted-foreground))]',
            'hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]',
            'transition-all duration-150',
            // Show on hover or when collapsed
            collapsed
              ? 'opacity-100'
              : 'opacity-0 group-hover/panel:opacity-100'
          )}
        >
          {collapsed ? <ExpandIcon size={12} /> : <CollapseIcon size={12} />}
        </button>
      </div>
    </div>
  )
}
