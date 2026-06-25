import { useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { BookOpen, Search, X } from 'lucide-react'
import type { Chapter } from '../../types'

interface Props {
  title?: string
  onSelect: (chapter: Chapter) => void
  onClose: () => void
}

export default function ChapterSelectModal({ title, onSelect, onClose }: Props) {
  const { chapters } = useWorkspaceStore()
  const [search, setSearch] = useState('')

  const filtered = chapters.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.content?.slice(0, 100).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl w-full max-w-md">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 text-surface-200">
            <BookOpen className="w-5 h-5 text-accent-400" />
            <h3 className="font-semibold">{title || 'Select Chapter'}</h3>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-surface-400 px-5 pb-3">
          The AI will read this chapter's text to extract the relevant information.
        </p>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chapters..."
              className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500 placeholder-surface-500"
            />
          </div>
        </div>

        {/* Chapter List */}
        <div className="px-3 pb-4 space-y-1 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-8">No chapters found.</p>
          ) : (
            filtered.map(chapter => {
              const wordCount = chapter.content?.split(/\s+/).filter(Boolean).length ?? 0
              const preview = chapter.content?.replace(/<[^>]*>/g, '').slice(0, 80) || 'No content yet.'
              return (
                <button
                  key={chapter.id}
                  onClick={() => onSelect(chapter)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-surface-800 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-surface-100 group-hover:text-accent-300 transition-colors">
                      {chapter.title || 'Untitled Chapter'}
                    </span>
                    <span className="text-xs text-surface-500">{wordCount.toLocaleString()} words</span>
                  </div>
                  <p className="text-xs text-surface-500 truncate">{preview}</p>
                </button>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
