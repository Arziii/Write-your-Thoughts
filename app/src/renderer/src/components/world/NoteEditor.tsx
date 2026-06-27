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
import { debounce } from '../../utils'
import EditorToolbar from '../editor/EditorToolbar'
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace'
import EditorFindToolbar from '../editor/EditorFindToolbar'

interface NoteEditorProps {
  entityId: string
  onWordCountChange?: (wc: number) => void
}

export default function NoteEditor({ entityId, onWordCountChange }: NoteEditorProps) {
  const { notes, markTabDirty, updateNote, drafts, setDraft, clearDraft } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const { settings } = useUserStore()
  const saveStatusRef = useRef<'saved' | 'saving' | 'unsaved'>('saved')
  const saveIndicatorRef = useRef<HTMLSpanElement>(null)
  
  const note = notes.find(n => n.id === entityId)
  // Seed content from in-memory draft (survives tab switch) or the last saved version
  const draft = drafts[entityId]
  const initialContent = draft?.content ?? note?.content ?? ''
  const [title, setTitle] = useState(draft?.title ?? note?.title ?? '')

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

  const autosave = useCallback(
    debounce(async (html: string, currentTitle: string) => {
      setSaveStatus('saving')
      try {
        const updated = await window.api.notes.update({ id: entityId, content: html, title: currentTitle })
        updateNote(updated as any)
        markTabDirty(entityId, false)
        setSaveStatus('saved')
        clearDraft(entityId)
      } catch {
        setSaveStatus('unsaved')
        addToast('Failed to save note', 'error')
      }
    }, 1500),
    [entityId]
  )

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    markTabDirty(entityId, true)
    setSaveStatus('unsaved')
    if (editor) {
      autosave(editor.getHTML(), newTitle)
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Write your note here...' }),
      CharacterCount,
      SearchAndReplace,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'editor-content outline-none',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      markTabDirty(entityId, true)
      setSaveStatus('unsaved')
      autosave(html, title)
      if (onWordCountChange) {
        onWordCountChange(editor.storage.characterCount.words())
      }
    },
  })

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '', false)
      setSaveStatus('saved')
    }
  }, [entityId, initialContent])

  useEffect(() => {
    if (editor && onWordCountChange) {
      onWordCountChange(editor.storage.characterCount.words())
    }
  }, [editor, entityId, onWordCountChange])

  // On unmount: persist unsaved state to the store draft (not SQLite).
  // This way switching tabs preserves the draft without an unwanted write.
  useEffect(() => {
    return () => {
      if (editor && saveStatusRef.current === 'unsaved') {
        setDraft(entityId, { content: editor.getHTML(), title })
      }
    }
  }, [editor, entityId, title])

  if (!note) return <div>Note not found</div>

  return (
    <div className="flex flex-col h-full bg-surface-950 relative">
      <EditorFindToolbar editor={editor} />
      
      <div className="border-b border-surface-800 bg-surface-900">
        <EditorToolbar editor={editor} saveIndicatorRef={saveIndicatorRef} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-10">
          <input 
            type="text" 
            value={title} 
            onChange={handleTitleChange}
            placeholder="Note Title"
            className="text-3xl font-bold bg-transparent text-surface-100 border-none focus:outline-none focus:ring-0 w-full mb-6 px-0"
            style={{
              fontFamily: settings?.editor_font || 'Georgia, serif',
            }}
          />
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
