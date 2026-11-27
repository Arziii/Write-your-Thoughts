import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Bold, Highlighter, Italic, MessageSquare, Sparkles, Underline } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'

export default function EditorSelectionBubble({
  editor,
  containerRef,
}: {
  editor: Editor | null
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null)
  const setSelectedText = useWorkspaceStore(state => state.setSelectedText)

  useEffect(() => {
    if (!editor) return

    const update = () => {
      const container = containerRef.current
      if (!container) { setCoords(null); return }
      const { empty, from, to } = editor.state.selection
      if (empty || !editor.isFocused) {
        setCoords(null)
        return
      }
      try {
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const rect = container.getBoundingClientRect()
        const centerX = (start.left + end.left) / 2 - rect.left
        const top = Math.max(8, start.top - rect.top - 42)
        const clampedLeft = Math.max(120, Math.min(rect.width - 120, centerX))
        setCoords({ left: clampedLeft, top })
      } catch {
        setCoords(null)
      }
    }

    const hide = () => setCoords(null)
    editor.on('selectionUpdate', update)
    editor.on('blur', hide)
    window.addEventListener('resize', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('blur', hide)
      window.removeEventListener('resize', update)
    }
  }, [editor, containerRef])

  if (!editor || !coords) return null

  const getSelectedQuote = () => {
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ').trim()
  }

  return (
    <div
      role="toolbar"
      aria-label="Selection formatting"
      onMouseDown={e => e.preventDefault()}
      style={{ left: coords.left, top: coords.top }}
      className="absolute z-30 -translate-x-1/2 flex items-center gap-0.5 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-1.5 py-1 shadow-lg animate-fade-in"
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
        aria-label="Bold"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          editor.isActive('bold')
            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
            : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
        )}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
        aria-label="Italic"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          editor.isActive('italic')
            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
            : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
        )}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
        aria-label="Underline"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          editor.isActive('underline')
            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
            : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
        )}
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
        aria-label="Highlight"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          editor.isActive('highlight')
            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
            : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
        )}
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-[hsl(var(--studio-edge))]" />
      <button
        type="button"
        onClick={() => {
          const quote = getSelectedQuote()
          if (quote) {
            window.dispatchEvent(new CustomEvent('open-comment-sidebar', { detail: { action: 'add', quote } }))
          }
        }}
        title="Add Comment"
        aria-label="Add Comment"
        className="flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-850 hover:text-surface-100"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Comment</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const quote = getSelectedQuote()
          if (quote) {
            setSelectedText(quote)
            window.dispatchEvent(new CustomEvent('open-ai-polish'))
          }
        }}
        title="Polish selection with AI"
        aria-label="Polish selection with AI"
        className="flex h-7 items-center gap-1 rounded bg-[hsl(var(--brand-green-bg))] px-2 text-xs font-medium text-[hsl(var(--brand-green))] transition-opacity hover:opacity-90"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Polish</span>
      </button>
    </div>
  )
}
