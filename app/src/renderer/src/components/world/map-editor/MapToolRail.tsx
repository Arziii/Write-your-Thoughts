import {
  BoxSelect, Droplets, Eraser, Hand, Mountain, Paintbrush, PenTool, Pentagon, Route, Ruler, Shapes, Trees, Type, Waves, Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../../utils'

interface ToolEntry {
  value: string
  label: string
  shortcut?: string
  Icon: LucideIcon
}

const toolGroups: ReadonlyArray<ReadonlyArray<ToolEntry>> = [
  [
    { value: '', label: 'Pan and select', shortcut: 'V', Icon: Hand },
    { value: 'Ruler', label: 'Measure ruler', shortcut: 'R', Icon: Ruler },
  ],
  [
    { value: 'Land brush', label: 'Land brush', shortcut: 'B', Icon: Paintbrush },
    { value: 'Water brush', label: 'Water brush', shortcut: 'W', Icon: Waves },
    { value: 'Edge brush', label: 'Edge brush', Icon: PenTool },
    { value: 'Shape brush', label: 'Shape brush', Icon: Shapes },
    { value: 'Land', label: 'Land polygon', Icon: Pentagon },
    { value: 'Eraser brush', label: 'Eraser brush', shortcut: 'E', Icon: Eraser },
  ],
  [
    { value: 'River', label: 'River', Icon: Droplets },
    { value: 'Route', label: 'Road / route', Icon: Route },
    { value: 'Border', label: 'Border', Icon: BoxSelect },
  ],
  [
    { value: 'Mountain', label: 'Mountain stamp', Icon: Mountain },
    { value: 'Forest', label: 'Forest stamp', Icon: Trees },
    { value: 'Town', label: 'Town stamp', Icon: Warehouse },
    { value: 'Label', label: 'Label', shortcut: 'T', Icon: Type },
  ],
]

interface MapToolRailProps {
  activeTool: string
  isScattering: boolean
  moving: boolean
  onSelectTool: (value: string) => void
}

export default function MapToolRail({ activeTool, isScattering, moving, onSelectTool }: MapToolRailProps) {
  return (
    <nav
      aria-label="Map tools"
      className="studio-chapter-toolbar flex w-12 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-[hsl(var(--studio-edge))] py-2"
    >
      {toolGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col items-center gap-1">
          {groupIndex > 0 && <div className="my-1 h-px w-6 bg-[hsl(var(--studio-edge))]" />}
          {group.map(({ value, label, shortcut, Icon }) => {
            const pressed = (activeTool === value || (value === 'Forest' && isScattering)) && !moving
            const tooltip = shortcut ? `${label} (${shortcut})` : label
            return (
              <button
                key={label}
                type="button"
                onClick={() => onSelectTool(value)}
                aria-label={label}
                aria-pressed={pressed}
                title={tooltip}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--brand-green))]',
                  pressed
                    ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))] shadow-sm'
                    : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
