import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function CalendarView() {
  const { timelineEvents, timelineSettings } = useWorkspaceStore()
  
  // Parse base date
  const baseDate = useMemo(() => {
    const str = timelineSettings?.start_date_string || ''
    let d = new Date(str)
    if (isNaN(d.getTime())) d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [timelineSettings?.start_date_string])

  const [currentDate, setCurrentDate] = useState(baseDate)

  // Reset view to base date if base date changes drastically, 
  // but let's just initialize it once or when the user wants.
  useEffect(() => {
    setCurrentDate(baseDate)
  }, [baseDate.getTime()])

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(baseDate)
  }

  // Calculate grid days
  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    const startDate = new Date(startOfMonth)
    startDate.setDate(startDate.getDate() - startDate.getDay()) // Rewind to Sunday
    
    const endDate = new Date(endOfMonth)
    if (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())) // Forward to Saturday
    }

    const days: Date[] = []
    let curr = new Date(startDate)
    while (curr <= endDate) {
      days.push(new Date(curr))
      curr.setDate(curr.getDate() + 1)
    }
    return days
  }, [currentDate])

  // Map events to date strings (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof timelineEvents>()
    timelineEvents.forEach(ev => {
      const duration = Number(ev.duration_days) || 1
      const storyDay = Number(ev.story_day) || 1
      for (let i = 0; i < duration; i++) {
        const evDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + storyDay - 1 + i)
        const y = evDate.getFullYear()
        const m = String(evDate.getMonth() + 1).padStart(2, '0')
        const d = String(evDate.getDate()).padStart(2, '0')
        const key = `${y}-${m}-${d}`
        
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(ev)
      }
    })
    return map
  }, [timelineEvents, baseDate])

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full bg-[#202020] text-surface-200">
      {/* Header toolbar matching reference */}
      <div className="flex items-center px-4 py-2 border-b border-surface-800 bg-[#2b2b2b] gap-4">
        <div className="flex items-center gap-2">
          <button onClick={goToToday} className="px-3 py-1 text-xs font-medium bg-surface-700 hover:bg-surface-600 rounded text-surface-200 transition-colors">
            First Day
          </button>
          <div className="flex items-center">
            <button onClick={prevMonth} className="p-1 hover:bg-surface-700 rounded transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-1 hover:bg-surface-700 rounded transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-semibold ml-2 text-surface-100">
            {formatMonthYear(currentDate)}
            {timelineSettings?.start_date_string && isNaN(new Date(timelineSettings.start_date_string).getTime()) && ` (${timelineSettings.start_date_string})`}
          </span>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b border-surface-800 flex-shrink-0 bg-[#252525]">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="px-2 py-2 text-xs font-medium text-center text-surface-400 border-r border-surface-800 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full min-h-[600px] auto-rows-fr">
          {calendarDays.map((date, idx) => {
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            
            const y = date.getFullYear()
            const m = String(date.getMonth() + 1).padStart(2, '0')
            const d = String(date.getDate()).padStart(2, '0')
            const key = `${y}-${m}-${d}`
            
            const dayEvents = eventsByDate.get(key) || []

            return (
              <div 
                key={idx} 
                className={`border-r border-b border-surface-800 flex flex-col p-1 transition-colors hover:bg-surface-800/30 ${
                  !isCurrentMonth ? 'bg-[#1a1a1a] opacity-50' : 'bg-[#202020]'
                }`}
              >
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className={`text-xs font-medium ${isCurrentMonth ? 'text-surface-300' : 'text-surface-600'}`}>
                    {date.getDate()}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                  {dayEvents.map(ev => (
                    <div 
                      key={ev.id} 
                      className="text-[11px] truncate px-2 py-1 rounded bg-[#1e3a5f] text-accent-100 border border-[#2b5282] cursor-pointer hover:bg-[#2b5282] transition-colors"
                      title={ev.title}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1.5 align-middle"></span>
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
