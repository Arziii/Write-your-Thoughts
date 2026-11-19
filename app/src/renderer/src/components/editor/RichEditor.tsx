import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { countWords } from '../../utils'
import { scheduleCloudSync, syncNow } from '../../services/syncService'
import { useEditorSave } from '../../hooks/useEditorSave'
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
  const { setSelectedText } = useWorkspaceStore()
  const { settings, user } = useUserStore()
  const { addToast } = useToastStore()
  const lastSnapshotTimeRef = useRef<number>(Date.now())
  const prevWcRef = useRef<number>(countWords(initialContent || ''))
  
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
      onContentChange?.(html, wc)
      saving.stage({ content: html, wordCount: wc })

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
      prevWcRef.current = countWords(initialContent || '')
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

  return (
    <div className="flex flex-col h-full bg-surface-950 relative">
      <EditorFindToolbar editor={editor} chapterId={chapterId} />
      {/* Toolbar */}
      <div className="studio-chapter-toolbar shrink-0">
        <EditorToolbar editor={editor} saveStatus={saving.status} onSave={saving.save} />
      </div>

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
            onContentChange?.(html, wc)
            scheduleCloudSync()
          }
        }}
      />
    </div>
  )
}
