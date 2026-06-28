import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { countWords, debounce } from '../../utils'
import { scheduleSyncBackup } from '../../services/syncService'
import EditorToolbar from './EditorToolbar'
import { CommentMark } from './extensions/CommentMark'
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace'
import EditorFindToolbar from './EditorFindToolbar'
import VersionHistoryModal from './VersionHistoryModal'

interface RichEditorProps {
  chapterId: string
  initialContent: string
  onContentChange?: (content: string, wordCount: number) => void
}

export default function RichEditor({ chapterId, initialContent, onContentChange }: RichEditorProps) {
  const { markTabDirty, updateChapter, activeChapter } = useWorkspaceStore()
  const { settings, user } = useUserStore()
  const { addToast } = useToastStore()
  const saveStatusRef = useRef<'saved' | 'saving' | 'unsaved'>('saved')
  const saveIndicatorRef = useRef<HTMLSpanElement>(null)
  const lastSnapshotTimeRef = useRef<number>(Date.now())
  const prevWcRef = useRef<number>(countWords(initialContent || ''))
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  const setSaveStatus = (status: 'saved' | 'saving' | 'unsaved') => {
    saveStatusRef.current = status
    if (saveIndicatorRef.current) {
      const el = saveIndicatorRef.current
      if (status === 'saving') {
        el.textContent = 'Saving...'
        el.className = 'text-surface-500 text-xs animate-pulse-soft'
      } else if (status === 'saved') {
        el.textContent = 'Saved'
        el.className = 'text-success-400 text-xs'
      } else {
        el.textContent = 'Unsaved'
        el.className = 'text-warning-400 text-xs'
      }
    }
  }

  // Debounced autosave
  const autosave = useCallback(
    debounce(async (html: string, wordCount: number) => {
      setSaveStatus('saving')
      try {
        await window.api.chapters.save({ id: chapterId, content: html, wordCount })
        // Update chapter in store
        if (activeChapter?.id === chapterId) {
          updateChapter({ ...activeChapter, content: html, word_count: wordCount })
        }
        markTabDirty(chapterId, false)
        setSaveStatus('saved')
        // Schedule cloud upload ~15s after the last save (debounced)
        scheduleSyncBackup(15_000)
      } catch {
        setSaveStatus('unsaved')
        addToast('Failed to save', 'error')
      }
    }, 3000),
    [chapterId]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Start writing your story...' }),
      CharacterCount,
      CommentMark,
      SearchAndReplace,
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'editor-content outline-none',
        spellcheck: 'true',
      },
      handleClick: (view, pos, event) => {
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
      markTabDirty(chapterId, true)
      setSaveStatus('unsaved')
      onContentChange?.(html, wc)
      autosave(html, wc)

      // Update Daily Progress in localStorage
      const diff = wc - prevWcRef.current
      if (diff > 0) {
        const currentProgress = parseInt(localStorage.getItem('dailyProgress') || '0')
        localStorage.setItem('dailyProgress', (currentProgress + diff).toString())
      }
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
  })

  // Update content when chapter changes
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '', false)
      setSaveStatus('saved')
      prevWcRef.current = countWords(initialContent || '')
    }
  }, [chapterId, initialContent])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (editor && saveStatusRef.current === 'unsaved') {
        const html = editor.getHTML()
        const wc = countWords(html)
        window.api.chapters.save({ id: chapterId, content: html, wordCount: wc })
      }
    }
  }, [editor, chapterId])

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
    const handleSaveMilestone = async () => {
      if (!editor || !user) return
      const milestoneName = window.prompt('Enter a name for this milestone (e.g., "First Draft Completed"):')
      if (!milestoneName) return // Cancelled or empty
      
      const html = editor.getHTML()
      const wc = countWords(html)
      try {
        await window.api.chapters.saveVersion({
          chapterId,
          userId: user.id,
          content: html,
          wordCount: wc,
          snapshotType: 'milestone',
          milestoneName
        })
        addToast(`Milestone "${milestoneName}" saved to cloud!`, 'success')
      } catch (e) {
        addToast('Failed to save milestone', 'error')
      }
    }

    window.addEventListener('comment-created', handleCommentCreated)
    window.addEventListener('comment-removed', handleCommentRemoved)
    window.addEventListener('open-version-history', handleOpenHistory)
    window.addEventListener('save-milestone', handleSaveMilestone)
    return () => {
      window.removeEventListener('comment-created', handleCommentCreated)
      window.removeEventListener('comment-removed', handleCommentRemoved)
      window.removeEventListener('open-version-history', handleOpenHistory)
      window.removeEventListener('save-milestone', handleSaveMilestone)
    }
  }, [editor, chapterId, user])

  return (
    <div className="flex flex-col h-full bg-surface-950 relative">
      <EditorFindToolbar editor={editor} />
      {/* Toolbar */}
      <div className="border-b border-surface-800 bg-surface-900">
        <EditorToolbar editor={editor} saveIndicatorRef={saveIndicatorRef} />
      </div>

      {/* Editor canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-10">
          <EditorContent
            editor={editor}
            className="min-h-full text-surface-100"
            style={{
              fontFamily: settings?.editor_font || 'Georgia, serif',
              fontSize: `${settings?.font_size || 16}px`,
              lineHeight: `${settings?.line_spacing || 1.8}`,
            }}
          />
        </div>
      </div>

      <VersionHistoryModal 
        chapterId={chapterId}
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onRestore={(html, wc) => {
          if (editor) {
            editor.commands.setContent(html, false)
            onContentChange?.(html, wc)
            setSaveStatus('saved')
          }
        }}
      />
    </div>
  )
}
