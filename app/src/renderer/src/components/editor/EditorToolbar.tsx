import type { Editor } from '@tiptap/react'
import type React from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Undo, Redo, Minus, Focus, MessageSquare
} from 'lucide-react'
import { cn } from '../../utils'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'

interface EditorToolbarProps {
  editor: Editor | null
  saveIndicatorRef: React.RefObject<HTMLSpanElement>
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  id?: string
}

function ToolbarButton({ onClick, isActive, disabled, title, children, id }: ToolbarButtonProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-all',
        isActive
          ? 'bg-accent-600/30 text-accent-400'
          : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-surface-700 mx-0.5" />
}

export default function EditorToolbar({ editor, saveIndicatorRef }: EditorToolbarProps) {
  const { focusMode, setFocusMode } = useWorkspaceStore()
  const { user, settings, setSettings } = useUserStore()

  const updateSetting = async (key: string, value: string | number) => {
    if (!user || !settings) return
    const newSettings = { ...settings, [key]: value }
    // Optimistic update
    setSettings(newSettings as never)
    try {
      await window.api.settings.update({
        userId: user.id,
        aiProvider: settings.ai_provider,
        aiApiKey: settings.ai_api_key,
        aiStylePrompt: settings.ai_style_prompt,
        preserveFormatting: settings.preserve_formatting ?? true,
        editorFont: key === 'editor_font' ? (value as string) : settings.editor_font,
        fontSize: key === 'font_size' ? (value as number) : settings.font_size,
        lineSpacing: key === 'line_spacing' ? (value as number) : settings.line_spacing,
      })
    } catch (e) {
      console.error('Failed to update setting', e)
    }
  }

  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap">
      {/* Undo / Redo */}
      <ToolbarButton
        id="toolbar-undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      {/* Editor Settings (Font, Size, Spacing) */}
      <select
        value={settings?.editor_font || 'Georgia'}
        onChange={(e) => updateSetting('editor_font', e.target.value)}
        className="w-32 px-2 h-7 bg-transparent hover:bg-surface-800 border border-transparent hover:border-surface-700 rounded text-surface-200 text-xs focus:outline-none transition-colors"
        title="Font Family"
      >
        <option value="Georgia">Georgia</option>
        <option value="'Times New Roman', serif">Times New Roman</option>
        <option value="'Crimson Text', Georgia, serif">Crimson Text</option>
        <option value="Inter, sans-serif">Inter</option>
        <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
      </select>
      
      <div className="flex items-center gap-1 mx-1" title="Font Size">
        <span className="text-[10px] text-surface-400">Size</span>
        <input
          type="number"
          min={12} max={24}
          value={settings?.font_size || 16}
          onChange={(e) => updateSetting('font_size', Number(e.target.value))}
          className="w-12 h-7 px-1.5 bg-transparent hover:bg-surface-800 border border-transparent hover:border-surface-700 rounded text-surface-200 text-xs focus:outline-none text-center transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      <div className="flex items-center gap-1 mx-1" title="Line Spacing">
        <span className="text-[10px] text-surface-400">Line</span>
        <input
          type="number"
          min={1.2} max={3.0} step={0.1}
          value={settings?.line_spacing || 1.8}
          onChange={(e) => updateSetting('line_spacing', Number(e.target.value))}
          className="w-12 h-7 px-1.5 bg-transparent hover:bg-surface-800 border border-transparent hover:border-surface-700 rounded text-surface-200 text-xs focus:outline-none text-center transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      <Divider />

      {/* Headings */}
      <ToolbarButton
        id="toolbar-h1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-h2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-h3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      {/* Text styles */}
      <ToolbarButton
        id="toolbar-bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-strike"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-highlight"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-comment"
        onClick={() => {
          if (!editor.state.selection.empty) {
            const { from, to } = editor.state.selection
            const quote = editor.state.doc.textBetween(from, to, ' ')
            window.dispatchEvent(new CustomEvent('open-comment-sidebar', { detail: { action: 'add', quote } }))
          }
        }}
        disabled={editor.state.selection.empty}
        title="Add Comment"
      >
        <MessageSquare className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      {/* Alignment */}
      <ToolbarButton
        id="toolbar-align-left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-align-center"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-align-right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        id="toolbar-bullet-list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-ordered-list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        id="toolbar-hr"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Section break"
      >
        <Minus className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      <span ref={saveIndicatorRef} className="text-success-400 text-xs mr-2">Saved</span>

      {/* Focus mode */}
      <ToolbarButton
        id="toolbar-focus-mode"
        onClick={() => setFocusMode(!focusMode)}
        isActive={focusMode}
        title="Focus mode"
      >
        <Focus className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>
  )
}
