import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect, useRef, useState } from 'react'
import { Focus } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { cn, countWords } from '../../utils'
import { scheduleCloudSync, syncNow } from '../../services/syncService'
import { useEditorSave } from '../../hooks/useEditorSave'
import EditorToolbar from './EditorToolbar'
import EditorSelectionBubble from './EditorSelectionBubble'
import { CommentMark } from './extensions/CommentMark'
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace'
import EditorFindToolbar from './EditorFindToolbar'
import VersionHistoryModal from './VersionHistoryModal'

function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function recordDailyWords(delta: number) {
  if (delta <= 0) return
  const today = todayKey()
  const lastDate = localStorage.getItem('wyt-daily-date')
  let progress = parseInt(localStorage.getItem('dailyProgress') || '0', 10) || 0
  let streak = parseInt(localStorage.getItem('streak') || '0', 10) || 0

  if (lastDate !== today) {
    if (lastDate) {
      const prev = new Date(lastDate + 'T00:00:00')
      const curr = new Date(today + 'T00:00:00')
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
      streak = diffDays === 1 ? streak + 1 : 1
    } else {
      streak = Math.max(1, streak)
    }
    progress = 0
    localStorage.setItem('wyt-daily-date', today)
    localStorage.setItem('streak', String(streak))
  }

  localStorage.setItem('dailyProgress', String(progress + delta))
}

interface RichEditorProps {
  chapterId: string
  initialContent: string
  onContentChange?: (content: string, wordCount: number) => void
}

export default function RichEditor({ chapterId, initialContent, onContentChange }: RichEditorProps) {
  const { setSelectedText, focusMode, setFocusMode } = useWorkspaceStore()
  const { settings, user } = useUserStore()
  const { addToast } = useToastStore()
  const lastSnapshotTimeRef = useRef<number>(Date.now())
  const prevWcRef = useRef<number>(countWords(initialContent || ''))
  const [liveWordCount, setLiveWordCount] = useState<number>(() => countWords(initialContent || ''))
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  const draftContent = useWorkspaceStore(state => state.drafts[chapterId]?.content as string | undefined)
  const saving = useEditorSave(chapterId, async (change: { content: string; wordCount: number }) => {
    const result = await window.api.chapters.save({ id: chapterId, ...change })
    if (!result.success) throw new Error('Chapter could not be saved')
    const store = useWorkspaceStore.getState()
    const chapter = store.chapters.find(item => item.id === chapterId)
    if (chapter) store.updateChapter({ ...chapter, content: change.content, word_count: change.wordCount, updated_at: result.savedAt })
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Start writing your story...' }),
      CharacterCount,
      CommentMark,
      SearchAndReplace.configure({ disableRegex: false }),
    ],
    content: draftContent ?? initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'editor-content outline-none',
        spellcheck: 'true',
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement
        if (target && target.hasAttribute('data-comment-id')) {
          const commentId = target.getAttribute('data-comment-id')
          window.dispatchEvent(new CustomEvent('open-comment-sidebar', { detail: { action: 'view', id: commentId } }))
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const wc = countWords(html)
      setLiveWordCount(wc)
      onContentChange?.(html, wc)
      saving.stage({ content: html, wordCount: wc })

      // Update Daily Progress with calendar rollover
      const diff = wc - prevWcRef.current
      if (diff > 0) recordDailyWords(diff)
      prevWcRef.current = wc

      // 15-minute background snapshots (Phase 5)
      const now = Date.now()
      if (now - lastSnapshotTimeRef.current > 15 * 60 * 1000) {
        lastSnapshotTimeRef.current = now
        if (user) {
          window.api.chapters.saveVersion({
            chapterId,
            userId: user.id,
            content: html,
            wordCount: wc,
            snapshotType: 'auto'
          }).catch(e => console.error('Failed to save background snapshot', e))
        }
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ')
        setSelectedText(text)
      } else {
        setSelectedText('')
      }
    },
  })

  // Update content when chapter changes
  useEffect(() => {
    if (editor && draftContent === undefined && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '', false)
      const wc = countWords(initialContent || '')
      prevWcRef.current = wc
      setLiveWordCount(wc)
    }
  }, [chapterId, initialContent])

  // Handle comment created/removed and toolbar events
  useEffect(() => {
    const handleCommentCreated = (e: any) => {
      if (e.detail?.id && editor) {
        editor.chain().focus().setComment(e.detail.id).run()
      }
    }
    const handleCommentRemoved = (e: any) => {
      if (e.detail?.id && editor) {
        editor.chain().focus().unsetComment(e.detail.id).run()
      }
    }
    const handleOpenHistory = () => {
      setIsHistoryModalOpen(true)
    }
    window.addEventListener('comment-created', handleCommentCreated)
    window.addEventListener('comment-removed', handleCommentRemoved)
    window.addEventListener('open-version-history', handleOpenHistory)
    return () => {
      window.removeEventListener('comment-created', handleCommentCreated)
      window.removeEventListener('comment-removed', handleCommentRemoved)
      window.removeEventListener('open-version-history', handleOpenHistory)
    }
  }, [editor, chapterId, user])

  const readMinutes = Math.max(1, Math.ceil(liveWordCount / 225))

  return (
    <div ref={editorContainerRef} className="flex flex-col h-full bg-surface-950 relative">
      <EditorFindToolbar editor={editor} chapterId={chapterId} />
      {/* Toolbar */}
      <div className="studio-chapter-toolbar shrink-0">
        <EditorToolbar editor={editor} saveStatus={saving.status} onSave={saving.save} showReadAloud hideStatus />
      </div>

      <EditorSelectionBubble editor={editor} containerRef={editorContainerRef} />

      {/* Editor canvas */}
      <div className="studio-desk min-h-0 flex-1 overflow-y-auto">
        <div className="studio-paper">
          <EditorContent
            editor={editor}
            style={{
              fontFamily: settings?.editor_font || 'Georgia, serif',
              fontSize: `${settings?.font_size || 16}px`,
              lineHeight: `${settings?.line_spacing || 1.8}`,
            }}
          />
        </div>
      </div>

      {/* Quiet bottom status bar */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-header))] px-4 text-[11px] text-surface-400">
        <div className="flex items-center gap-3 tabular-nums">
          <span>{liveWordCount.toLocaleString()} {liveWordCount === 1 ? 'word' : 'words'}</span>
          <span aria-hidden="true" className="text-surface-600">·</span>
          <span>~{readMinutes} min read</span>
        </div>
        <div className="flex items-center gap-3">
          <span role="status" className="inline-flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', saving.status === 'saved' ? 'bg-success-400' : 'bg-warning-400')} aria-hidden="true" />
            <span className={saving.status === 'saved' ? 'text-surface-400' : 'text-warning-400'}>
              {saving.status === 'saved' ? 'Saved locally' : saving.status === 'saving' ? 'Saving…' : 'Unsaved'}
            </span>
          </span>
          <button
            id="toolbar-focus-mode"
            type="button"
            onClick={() => setFocusMode(!focusMode)}
            aria-pressed={focusMode}
            title="Toggle focus mode"
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
              focusMode
                ? 'bg-[hsl(var(--brand-green-bg))] font-medium text-[hsl(var(--brand-green))]'
                : 'hover:bg-surface-850 hover:text-surface-100'
            )}
          >
            <Focus className="h-3 w-3" aria-hidden="true" />
            <span>{focusMode ? 'Exit focus' : 'Focus'}</span>
          </button>
        </div>
      </footer>

      <VersionHistoryModal
        chapterId={chapterId}
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onBeforeRestore={saving.flushLocal}
        onCreateMilestone={async name => {
          if (!editor || !user || !await saving.flushLocal()) throw new Error('Could not save the chapter')
          const content = editor.getHTML()
          await window.api.chapters.saveVersion({
            chapterId, userId: user.id, content, wordCount: countWords(content),
            snapshotType: 'milestone', milestoneName: name,
          })
          scheduleCloudSync()
          const result = await syncNow()
          addToast(result.success ? 'Milestone saved and synced.' : 'Milestone saved locally. Cloud sync is pending.', result.success ? 'success' : 'info')
        }}
        onRestore={(html, wc) => {
          if (editor) {
            editor.commands.setContent(html, false)
            const store = useWorkspaceStore.getState()
            const chapter = store.chapters.find(item => item.id === chapterId)
            if (chapter) store.updateChapter({ ...chapter, content: html, word_count: wc })
            prevWcRef.current = wc
            setLiveWordCount(wc)
            onContentChange?.(html, wc)
            scheduleCloudSync()
          }
        }}
      />
    </div>
  )
}
