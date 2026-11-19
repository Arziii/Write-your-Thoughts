import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Check, Trash2, Send } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import { EditorToolPanel, PanelEmptyState, panelBadge, panelButton, panelCard, panelField, panelIconButton } from './EditorToolPanel'

interface PanelComment {
  id: string
  content: string
  quote?: string
  resolved: boolean
  created_at: string
}

interface CommentSidebarProps {
  chapterId: string
  isOpen: boolean
  onClose: () => void
  activeCommentId?: string | null
  onCommentClick?: (commentId: string) => void
  onResolve?: (commentId: string) => void
  onDelete?: (commentId: string) => void
}

export default function CommentSidebar({
  chapterId, isOpen, onClose, activeCommentId, onCommentClick, onResolve, onDelete,
}: CommentSidebarProps) {
  const addToast = useToastStore(state => state.addToast)
  const [comments, setComments] = useState<PanelComment[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [newComment, setNewComment] = useState('')
  const [quote, setQuote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const loadRequest = useRef(0)

  async function loadComments() {
    if (!chapterId) return
    const request = ++loadRequest.current
    try {
      const data = await window.api.comments.getByChapter(chapterId)
      if (request !== loadRequest.current) return
      setComments(data)
      setLoadState('loaded')
    } catch {
      if (request === loadRequest.current) setLoadState('error')
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setLoadState('loading')
    void loadComments()
    return () => { loadRequest.current++ }
  }, [isOpen, chapterId])

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    const handleRefresh = () => { void loadComments() }
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ action: 'add' | 'view'; quote?: string; id?: string }>).detail
      if (detail?.action === 'add') {
        setQuote(detail.quote ?? '')
        setIsAdding(true)
      } else if (detail?.action === 'view' && detail.id) {
        const id = detail.id
        onCommentClick?.(id)
        clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
    window.addEventListener('refresh-comments', handleRefresh)
    window.addEventListener('open-comment-sidebar', handleOpen)
    return () => {
      clearTimeout(scrollTimer)
      window.removeEventListener('refresh-comments', handleRefresh)
      window.removeEventListener('open-comment-sidebar', handleOpen)
    }
  }, [chapterId, onCommentClick])

  async function handleAddComment() {
    if (!newComment.trim() || !chapterId || savingComment) return
    setSavingComment(true)
    try {
      const created = await window.api.comments.create({ chapterId, content: newComment.trim(), quote })
      setNewComment('')
      setIsAdding(false)
      setQuote('')
      void loadComments()
      window.dispatchEvent(new CustomEvent('comment-created', { detail: { id: created.id } }))
    } catch {
      addToast('Failed to add comment', 'error')
    } finally {
      setSavingComment(false)
    }
  }

  if (!isOpen) return null

  const composer = isAdding && (
    <form className="space-y-2.5" onSubmit={event => {
      event.preventDefault()
      void handleAddComment()
    }}>
      {quote && <blockquote className="border-l-2 border-[hsl(var(--brand-green))] pl-2.5 text-xs italic text-surface-400">{quote}</blockquote>}
      <textarea autoFocus rows={3} aria-label="New comment" className={cn(panelField, 'resize-y')}
        placeholder="Write a comment…" value={newComment} onChange={event => setNewComment(event.target.value)} disabled={savingComment} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={panelButton} disabled={savingComment}
          onClick={() => { setIsAdding(false); setNewComment(''); setQuote('') }}>Cancel</button>
        <button type="submit" disabled={!newComment.trim() || savingComment} className={panelButton}>
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> {savingComment ? 'Adding…' : 'Add comment'}
        </button>
      </div>
    </form>
  )

  return (
    <EditorToolPanel id="comments-panel" title="Comments" icon={MessageSquare} onClose={onClose} footer={composer}>
      {loadState === 'loading' ? (
        <p role="status" className="text-sm text-surface-400">Loading comments…</p>
      ) : loadState === 'error' ? (
        <PanelEmptyState icon={MessageSquare} title="Could not load comments" description="Reopen this panel to try again." />
      ) : comments.length === 0 ? (
        <PanelEmptyState icon={MessageSquare} title="No comments yet"
          description="Select text in the editor and choose Add Comment to start a thread." />
      ) : (
        <section className="space-y-2.5" aria-label="Comment threads">
          <h4 className="text-sm font-semibold">Threads <span className={panelBadge}>{comments.length}</span></h4>
          <ul className="space-y-2">
            {comments.map(comment => (
              <li key={comment.id} id={`comment-${comment.id}`}
                onClick={() => onCommentClick?.(comment.id)}
                className={cn(panelCard, activeCommentId === comment.id && 'border-[hsl(var(--brand-green))]', Boolean(onCommentClick) && 'cursor-pointer')}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <time dateTime={comment.created_at} className="text-xs text-surface-400">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </time>
                    {comment.resolved && <span className={panelBadge}>Resolved</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!comment.resolved && onResolve && (
                      <button type="button" onClick={event => { event.stopPropagation(); onResolve(comment.id) }}
                        aria-label="Resolve comment" title="Resolve comment" className={`${panelIconButton} hover:text-success-500`}>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    {onDelete && (
                      <button type="button" onClick={event => { event.stopPropagation(); onDelete(comment.id) }}
                        aria-label="Delete comment" title="Delete comment" className={`${panelIconButton} hover:text-danger-500`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {comment.quote && (
                  <blockquote className="mb-2 whitespace-pre-wrap break-words border-l-2 border-[hsl(var(--brand-green))] pl-2.5 text-xs italic text-surface-400">
                    {comment.quote}
                  </blockquote>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </EditorToolPanel>
  )
}
