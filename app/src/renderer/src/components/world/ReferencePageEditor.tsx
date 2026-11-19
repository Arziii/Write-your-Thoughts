import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace'
import { BookOpen, Building2, Gavel, Globe, StickyNote } from 'lucide-react'
import { emptyReferenceDetails, referencePages } from '../../../../shared/referencePages'
import type { ReferenceDetails, ReferenceKind } from '../../../../shared/referencePages'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useEditorSave } from '../../hooks/useEditorSave'
import EditorToolbar from '../editor/EditorToolbar'
import EditorFindToolbar from '../editor/EditorFindToolbar'
import ReferenceCards from './ReferenceCards'
import type { ReferenceTarget } from './ReferenceCards'

const recordSources = {
  organization: { list: 'organizations', update: 'updateOrganization', Icon: Building2 },
  world_rule: { list: 'worldRules', update: 'updateWorldRule', Icon: Gavel },
  codex: { list: 'codex', update: 'updateCodex', Icon: BookOpen },
  wiki: { list: 'wiki', update: 'updateWiki', Icon: Globe },
  note: { list: 'notes', update: 'updateNote', Icon: StickyNote },
} as const

const saveMessages = {
  synced: 'Saved. Reference cards stay on this device.',
  pending: 'Saved locally. Text changes may still be queued for cloud sync.',
}

interface Props {
  kind: ReferenceKind
  entityId: string
  onWordCountChange?: (wordCount: number) => void
}

export default function ReferencePageEditor({ kind, entityId, onWordCountChange }: Props) {
  const source = recordSources[kind]
  const { Icon } = source
  const config = referencePages[kind]
  const workspace = useWorkspaceStore()
  const { chapters, characters, locations, organizations, worldRules, codex, wiki, notes } = workspace
  const settings = useUserStore(state => state.settings)
  const item = workspace[source.list].find(record => record.id === entityId)
  const draft = workspace.drafts[entityId]
  const initialDraftDetails = useRef(draft?.details as ReferenceDetails | undefined)
  const current = useRef({
    content: (draft?.content ?? item?.content ?? '') as string,
    title: (draft?.title ?? item?.title ?? '') as string,
    details: (draft?.details ?? emptyReferenceDetails) as ReferenceDetails,
  })
  const [title, setTitle] = useState(current.current.title)
  const [details, setDetails] = useState<ReferenceDetails | null>(null)
  const [loadError, setLoadError] = useState('')
  const bookId = item?.book_id
  const targets = useMemo(() => {
    const all: ReferenceTarget[] = []
    function add(type: ReferenceTarget['type'], records: Array<{ id: string; book_id: string; name?: string; title?: string }>) {
      for (const record of records) {
        if (record.book_id === bookId && !(record.id === entityId && type === kind)) {
          all.push({ id: record.id, type, title: record.title ?? record.name ?? 'Untitled' })
        }
      }
    }
    add('chapter', chapters)
    add('character', characters)
    add('location', locations)
    add('organization', organizations)
    add('world_rule', worldRules)
    add('codex', codex)
    add('wiki', wiki)
    add('note', notes)
    return all
  }, [bookId, entityId, kind, chapters, characters, locations, organizations, worldRules, codex, wiki, notes])

  const saving = useEditorSave(entityId, async (change: typeof current.current) => {
    const updated = await window.api.referencePages.save({ id: entityId, kind, ...change })
    if (!updated?.id) throw new Error('Reference page could not be saved')
    useWorkspaceStore.getState()[source.update](updated)
  }, saveMessages)

  useEffect(() => {
    if (!item || window.api.isMock) return
    let cancelled = false
    window.api.referencePages.load({ id: entityId, kind }).then((stored: ReferenceDetails) => {
      if (cancelled) return
      const pending = useWorkspaceStore.getState().drafts[entityId]
      current.current.details = pending?.details ?? initialDraftDetails.current ?? stored
      setDetails(current.current.details)
    }).catch(() => {
      if (!cancelled) setLoadError('Could not load the reference cards. Reopen this page to retry.')
    })
    return () => { cancelled = true }
  }, [entityId, kind, Boolean(item)])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }), Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: `Write your ${config.body.toLowerCase()} here…` }), CharacterCount, SearchAndReplace,
    ],
    content: current.current.content,
    editorProps: { attributes: { class: 'editor-content outline-none', spellcheck: 'true', 'aria-label': config.body } },
    onUpdate: ({ editor }) => {
      current.current.content = editor.getHTML()
      saving.stage({ ...current.current })
      onWordCountChange?.(editor.storage.characterCount.words())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      workspace.setSelectedText(from === to ? '' : editor.state.doc.textBetween(from, to, ' '))
    },
  })

  useEffect(() => {
    if (!editor || !item || useWorkspaceStore.getState().drafts[entityId]) return
    const storedContent = item.content ?? ''
    if (storedContent !== current.current.content) {
      current.current.content = storedContent
      editor.commands.setContent(storedContent, false)
    }
    if (item.title !== current.current.title) {
      current.current.title = item.title
      setTitle(item.title)
    }
    onWordCountChange?.(editor.storage.characterCount.words())
  }, [editor, entityId, item?.title, item?.content])

  if (!item) return <p className="p-6 text-surface-400">{config.label} could not be found.</p>
  if (window.api.isMock) return <p className="p-6 text-surface-400">Open the desktop app to edit reference pages.</p>
  if (loadError) return <p role="alert" className="p-6 text-surface-400">{loadError}</p>
  if (!details) return <p role="status" className="p-6 text-surface-400">Loading reference page…</p>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorFindToolbar editor={editor} />
      <div className="studio-chapter-toolbar shrink-0">
        <EditorToolbar editor={editor} saveStatus={saving.status} onSave={saving.save} showHistory={false} />
      </div>

      <div className="reference-workspace min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
          <header className="reference-card flex items-center gap-3.5">
            <span className="shrink-0 rounded-lg bg-[hsl(var(--brand-green-bg))] p-2.5 text-[hsl(var(--brand-green))]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <label className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[hsl(var(--brand-green))]">{config.label}</span>
              <input value={title} placeholder={`${config.label} title`} aria-label={`${config.label} title`}
                className="w-full rounded-sm bg-transparent py-0.5 font-serif text-xl font-semibold text-surface-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-current md:text-2xl"
                onChange={event => {
                  const value = event.target.value
                  setTitle(value)
                  current.current.title = value
                  saving.stage({ ...current.current })
                }} />
            </label>
          </header>

          <details open className="space-y-3">
            <summary className="cursor-pointer rounded-md px-1 py-1 text-sm font-semibold text-surface-200">Reference cards</summary>
            <ReferenceCards kind={kind} details={details} targets={targets}
              onChange={update => {
                current.current.details = update(current.current.details)
                setDetails(current.current.details)
                saving.stage({ ...current.current })
              }}
              onOpen={target => workspace.openTab(target.id, target.type, target.title)} />
          </details>

          <section className="reference-card">
            <h3 className="mb-3 border-b border-surface-800 pb-2 font-serif text-lg font-semibold">{config.body}</h3>
            <EditorContent editor={editor} className="min-h-48 text-surface-100" style={{
              fontFamily: settings?.editor_font || 'Georgia, serif',
              fontSize: `${settings?.font_size || 16}px`,
              lineHeight: settings?.line_spacing || 1.8,
            }} />
          </section>
        </div>
      </div>
    </div>
  )
}
