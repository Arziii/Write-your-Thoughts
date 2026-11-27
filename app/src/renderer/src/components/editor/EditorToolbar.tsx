import type { Editor } from '@tiptap/react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Undo, Redo, Minus, Focus, MessageSquare,
  History, Save, Type
} from 'lucide-react'
import { cn } from '../../utils'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import ReadAloudControls from './ReadAloudControls'

interface EditorToolbarProps {
  editor: Editor | null
  saveStatus: 'saved' | 'saving' | 'unsaved'
  onSave: () => void
  showHistory?: boolean
  showReadAloud?: boolean
  hideStatus?: boolean
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        isActive
          ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
          : 'text-surface-400 hover:text-surface-100 hover:bg-surface-850',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-[hsl(var(--studio-edge))] mx-0.5" />
}

export default function EditorToolbar({
  editor,
  saveStatus,
  onSave,
  showHistory = true,
  showReadAloud = false,
  hideStatus = false,
}: EditorToolbarProps) {
  const { focusMode, setFocusMode } = useWorkspaceStore()
  const { user, settings, setSettings } = useUserStore()
  const [typographyOpen, setTypographyOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!typographyOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setTypographyOpen(false)
      }
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTypographyOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [typographyOpen])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const updateSetting = (key: string, value: string | number) => {
    if (!user || !settings) return
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings as never)

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await window.api.settings.update({
          userId: user.id,
          aiProvider: newSettings.ai_provider,
          aiApiKey: newSettings.ai_api_key,
          aiStylePrompt: newSettings.ai_style_prompt,
          preserveFormatting: newSettings.preserve_formatting ?? true,
          editorFont: newSettings.editor_font,
          fontSize: newSettings.font_size,
          lineSpacing: newSettings.line_spacing,
        })
      } catch (e) {
        console.error('Failed to update setting', e)
      }
    }, 350)
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

      {/* Typography Popover */}
      <div className="relative" ref={popoverRef}>
        <button
          id="toolbar-typography"
          type="button"
          onClick={() => setTypographyOpen(open => !open)}
          aria-expanded={typographyOpen}
          title="Typography (Font, Size, Spacing)"
          className={cn(
            'flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
            typographyOpen
              ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
              : 'text-surface-300 hover:bg-surface-850 hover:text-surface-100'
          )}
        >
          <Type className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Aa</span>
        </button>

        {typographyOpen && (
          <div className="absolute left-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-3.5 shadow-xl animate-fade-in">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-surface-400">Typography</p>
            <div className="space-y-3">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-surface-300">Font Family</span>
                <select
                  value={settings?.editor_font || 'Georgia'}
                  onChange={(e) => updateSetting('editor_font', e.target.value)}
                  className="w-full rounded-md border border-[hsl(var(--studio-edge))] bg-surface-950 px-2.5 py-1.5 text-xs text-surface-100 focus:border-[hsl(var(--brand-green))] focus:outline-none"
                >
                  <option value="Georgia">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="'Crimson Text', Georgia, serif">Crimson Text</option>
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                </select>
              </label>

              <label className="block text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-surface-300">Font Size</span>
                  <span className="tabular-nums text-surface-400">{settings?.font_size || 16}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={24}
                  step={1}
                  value={settings?.font_size || 16}
                  onChange={(e) => updateSetting('font_size', Number(e.target.value))}
                  className="w-full accent-[hsl(var(--brand-green))]"
                />
              </label>

              <label className="block text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-surface-300">Line Spacing</span>
                  <span className="tabular-nums text-surface-400">{(settings?.line_spacing || 1.8).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.2}
                  max={3.0}
                  step={0.1}
                  value={settings?.line_spacing || 1.8}
                  onChange={(e) => updateSetting('line_spacing', Number(e.target.value))}
                  className="w-full accent-[hsl(var(--brand-green))]"
                />
              </label>
            </div>
          </div>
        )}
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

      {showReadAloud && <ReadAloudControls editor={editor} />}

      {/* Version History & Save */}
      {showHistory && (
        <ToolbarButton
          id="toolbar-history"
          onClick={() => window.dispatchEvent(new CustomEvent('open-version-history'))}
          title="Version History"
        >
          <History className="w-3.5 h-3.5" />
        </ToolbarButton>
      )}
      <ToolbarButton
        id="toolbar-save"
        onClick={onSave}
        title="Save (Ctrl+S)"
      >
        <Save className="w-3.5 h-3.5" />
      </ToolbarButton>

      {!hideStatus && (
        <>
          <Divider />
          <span role="status" className={cn('text-xs mr-2', saveStatus === 'saved' ? 'text-success-400' : 'text-warning-400')}>
            {saveStatus === 'saved' ? 'Saved locally' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
          </span>
          <ToolbarButton
            id="toolbar-focus-mode"
            onClick={() => setFocusMode(!focusMode)}
            isActive={focusMode}
            title="Focus mode"
          >
            <Focus className="w-3.5 h-3.5" />
          </ToolbarButton>
        </>
      )}
    </div>
  )
}
