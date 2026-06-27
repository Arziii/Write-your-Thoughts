import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { countWords, debounce } from '../../utils'
import { scheduleSyncBackup } from '../../services/syncService'
import EditorToolbar from './EditorToolbar'
import { CommentMark } from './extensions/CommentMark'

interface RichEditorProps {
  chapterId: string
  initialContent: string
  onContentChange?: (content: string, wordCount: number) => void
}

export default function RichEditor({ chapterId, initialContent, onContentChange }: RichEditorProps) {
  const { markTabDirty, updateChapter, activeChapter } = useWorkspaceStore()
  const { settings } = useUserStore()
  const { addToast } = useToastStore()
  const saveStatusRef = useRef<'saved' | 'saving' | 'unsaved'>('saved')
  const saveIndicatorRef = useRef<HTMLSpanElement>(null)

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
    },
  })

  // Update content when chapter changes
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '', false)
      setSaveStatus('saved')
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

  // Handle comment created/removed
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
    window.addEventListener('comment-created', handleCommentCreated)
    window.addEventListener('comment-removed', handleCommentRemoved)
    return () => {
      window.removeEventListener('comment-created', handleCommentCreated)
      window.removeEventListener('comment-removed', handleCommentRemoved)
    }
  }, [editor])

  return (
    <div className="flex flex-col h-full bg-surface-950">
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
    </div>
  )
}
