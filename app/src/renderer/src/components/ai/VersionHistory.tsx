import { useEffect, useState } from 'react'
import { RotateCcw, Clock, Cpu, PenLine, RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate } from '../../utils'
import type { ChapterVersion, VersionSource } from '../../types'

const sourceInfo: Record<VersionSource, { label: string; icon: typeof Clock; color: string }> = {
  manual: { label: 'Manual', icon: PenLine, color: 'text-surface-400' },
  ai_polish: { label: 'AI Polish', icon: Cpu, color: 'text-accent-400' },
  restore: { label: 'Restored', icon: RefreshCw, color: 'text-warning-400' },
}

export default function VersionHistory() {
  const { activeChapter, updateChapter } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const [versions, setVersions] = useState<ChapterVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({})

  const toggleDate = (dateStr: string) => {
    setCollapsedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }))
  }

  useEffect(() => {
    if (!activeChapter) {
      setVersions([])
      return
    }
    setIsLoading(true)
    window.api.chapters.getVersions(activeChapter.id)
      .then((v) => setVersions(v as ChapterVersion[]))
      .finally(() => setIsLoading(false))
  }, [activeChapter?.id])

  const handleRestore = async (version: ChapterVersion) => {
    if (!activeChapter) return
    setRestoring(version.id)
    try {
      await window.api.chapters.restoreVersion({
        chapterId: activeChapter.id,
        versionId: version.id,
      })
      const wc = version.content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length
      updateChapter({ ...activeChapter, content: version.content, word_count: wc })
      addToast(`Restored to version ${version.version_number}`, 'success')
      // Refresh versions
      const updated = await window.api.chapters.getVersions(activeChapter.id)
      setVersions(updated as ChapterVersion[])
    } catch {
      addToast('Failed to restore version', 'error')
    } finally {
      setRestoring(null)
    }
  }

  if (!activeChapter) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-surface-500">Open a chapter to view its version history.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-surface-500 animate-spin" />
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-surface-500">No versions saved yet.</p>
        <p className="text-[11px] text-surface-600 mt-1">Versions are saved automatically when you use AI polish.</p>
      </div>
    )
  }

  const groupedVersions = versions.reduce((acc, version) => {
    const dateStr = new Date(version.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(version)
    return acc
  }, {} as Record<string, ChapterVersion[]>)

  return (
    <div className="space-y-4">
      {Object.entries(groupedVersions).map(([dateStr, dayVersions]) => {
        const isCollapsed = collapsedDates[dateStr]
        
        return (
          <div key={dateStr} className="space-y-2">
            <button
              onClick={() => toggleDate(dateStr)}
              className="flex items-center gap-2 w-full text-xs font-semibold text-surface-400 hover:text-surface-300 uppercase tracking-wider sticky top-0 bg-surface-900/90 py-1 backdrop-blur-sm z-10 transition-colors"
            >
              <ChevronDown className={cn('w-3 h-3 transition-transform', isCollapsed && '-rotate-90')} />
              {dateStr}
            </button>
            
            {!isCollapsed && dayVersions.map((version, index) => {
              const info = sourceInfo[version.source] ?? sourceInfo.manual
              const Icon = info.icon
              // Reset numbering per day based on array length (assuming ordered descending)
              const dailyVersionNum = dayVersions.length - index

              return (
                <div
                  key={version.id}
                  className="glass-card rounded-lg p-3 group hover:border-surface-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={cn('w-3 h-3 flex-shrink-0', info.color)} />
                        <span className={cn('text-xs font-medium', info.color)}>{info.label}</span>
                        <span className="text-[10px] text-surface-600">v{dailyVersionNum}</span>
                      </div>
                      <p className="text-[10px] text-surface-500">
                        {new Date(version.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <button
                      id={`restore-version-${version.id}`}
                      onClick={() => handleRestore(version)}
                      disabled={!!restoring}
                      title="Restore this version"
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded text-[10px] transition-all flex-shrink-0"
                    >
                      {restoring === version.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Restore
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
