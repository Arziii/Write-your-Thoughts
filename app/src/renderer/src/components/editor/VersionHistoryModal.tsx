import React, { useEffect, useState } from 'react'
import { X, Clock, Save, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'

interface Version {
  id: string
  chapter_id: string
  user_id: string
  content: string
  word_count: number
  snapshot_type: 'auto' | 'milestone'
  milestone_name: string | null
  created_at: string
}

interface VersionHistoryModalProps {
  chapterId: string
  isOpen: boolean
  onClose: () => void
  onRestore: (html: string, wordCount: number) => void
}

export default function VersionHistoryModal({ chapterId, isOpen, onClose, onRestore }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const { addToast } = useToastStore()
  const { user } = useUserStore()

  useEffect(() => {
    if (isOpen) {
      loadVersions()
    }
  }, [isOpen, chapterId])

  const loadVersions = async () => {
    setLoading(true)
    try {
      const data = await window.api.chapters.getVersions(chapterId)
      setVersions(data as Version[])
      if (data.length > 0) setSelectedVersion(data[0] as Version)
    } catch (e) {
      addToast('Failed to load version history', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedVersion || !user) return
    if (!window.confirm('Are you sure you want to restore this version? This will overwrite your current progress.')) return

    try {
      const result = await window.api.chapters.restoreVersion({
        chapterId,
        versionId: selectedVersion.id,
        userId: user.id
      })
      if (result.success) {
        addToast('Version restored successfully', 'success')
        onRestore(result.restoredContent, result.restoredWordCount)
        onClose()
      }
    } catch (e) {
      addToast('Failed to restore version', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-950/50">
          <h2 className="text-lg font-medium text-surface-50 flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-400" />
            Version History
          </h2>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - List of versions */}
          <div className="w-80 border-r border-surface-800 flex flex-col overflow-y-auto bg-surface-900/50">
            {loading ? (
              <div className="p-6 text-center text-surface-400 text-sm">Loading history...</div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-center text-surface-400 text-sm">No version history found.</div>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersion(v)}
                  className={`flex flex-col items-start p-4 border-b border-surface-800/50 transition-colors w-full text-left
                    ${selectedVersion?.id === v.id ? 'bg-accent-900/20 border-l-2 border-l-accent-500' : 'hover:bg-surface-800'}
                  `}
                >
                  <div className="flex items-center gap-2 mb-1 w-full">
                    {v.snapshot_type === 'milestone' ? (
                      <Save className="w-4 h-4 text-primary-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-surface-500" />
                    )}
                    <span className={`font-medium truncate ${v.snapshot_type === 'milestone' ? 'text-primary-300' : 'text-surface-200'}`}>
                      {v.snapshot_type === 'milestone' ? v.milestone_name : 'Autosave'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center w-full text-xs text-surface-400">
                    <span>{format(new Date(v.created_at), 'MMM d, h:mm a')}</span>
                    <span>{v.word_count} words</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Main Content - Preview */}
          <div className="flex-1 flex flex-col bg-surface-950 overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-8">
              {selectedVersion ? (
                <div 
                  className="prose prose-invert prose-surface max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-surface-500">
                  Select a version to preview
                </div>
              )}
            </div>

            {/* Restore Action Bar */}
            {selectedVersion && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-surface-950 via-surface-950 to-transparent border-t border-surface-800/50 flex justify-end">
                <button
                  onClick={handleRestore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-lg font-medium shadow-lg transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore this version
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
