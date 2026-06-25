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
import { debounce } from '../../utils'
import EditorToolbar from '../editor/EditorToolbar'

interface OrganizationEditorProps {
  entityId: string
}

export default function OrganizationEditor({ entityId }: OrganizationEditorProps) {
  const { organizations, markTabDirty, updateOrganization } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const saveStatusRef = useRef<'saved' | 'saving' | 'unsaved'>('saved')
  const saveIndicatorRef = useRef<HTMLSpanElement>(null)
  
  const item = organizations.find(n => n.id === entityId)
  const initialContent = item?.content || ''
  const [title, setTitle] = useState(item?.title || '')

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
        const updated = await window.api.organizations.update({ id: entityId, content: html, title: currentTitle })
        updateOrganization(updated as any)
        markTabDirty(entityId, false)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
        addToast('Failed to save organization', 'error')
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
      Placeholder.configure({ placeholder: 'Write organization details here...' }),
      CharacterCount,
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
    },
  })

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '', false)
      setSaveStatus('saved')
    }
  }, [entityId, initialContent])

  useEffect(() => {
    return () => {
      if (editor && saveStatusRef.current === 'unsaved') {
        window.api.organizations.update({ id: entityId, content: editor.getHTML(), title })
      }
    }
  }, [editor, entityId, title])

  if (!item) return <div>Organization not found</div>

  return (
    <div className="flex flex-col h-full bg-surface-950">
      <div className="px-12 pt-6 pb-2">
        <input 
          type="text" 
          value={title} 
          onChange={handleTitleChange}
          placeholder="Organization Title"
          className="text-2xl font-bold bg-transparent text-surface-100 border-none focus:outline-none focus:ring-0 w-full"
        />
      </div>
      
      <div className="border-b border-surface-800 bg-surface-900 mt-2">
        <EditorToolbar editor={editor} saveIndicatorRef={saveIndicatorRef} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-8">
          <EditorContent
            editor={editor}
            className="min-h-full text-surface-200"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              lineHeight: '1.7',
            }}
          />
        </div>
      </div>
    </div>
  )
}
