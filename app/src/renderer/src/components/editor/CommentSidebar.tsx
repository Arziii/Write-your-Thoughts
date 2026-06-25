import { useState, useEffect } from 'react'
import { X, MessageSquare, Check, Trash2, Send } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { formatRelativeTime } from '../../utils'

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
  chapterId, isOpen, onClose, activeCommentId, onCommentClick, onResolve, onDelete
}: CommentSidebarProps) {
  const { user } = useUserStore()
  const { addToast } = useToastStore()
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [quote, setQuote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  
  const loadComments = async () => {
    if (!chapterId) return
    const data = await window.api.comments.getByChapter(chapterId)
    setComments(data as any[])
  }

  useEffect(() => {
    if (isOpen) {
      loadComments()
    }
  }, [isOpen, chapterId])

  // Expose a way to refresh comments from parent if needed
  useEffect(() => {
    const handleRefresh = () => loadComments()
    const handleOpen = (e: any) => {
      if (e.detail?.action === 'add') {
        setQuote(e.detail.quote || '')
        setIsAdding(true)
      } else if (e.detail?.action === 'view') {
        const id = e.detail.id
        if (id) {
          onCommentClick?.(id)
          // Scroll to the comment if it exists in the list
          setTimeout(() => {
            const el = document.getElementById(`comment-${id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }
      }
    }
    window.addEventListener('refresh-comments', handleRefresh)
    window.addEventListener('open-comment-sidebar', handleOpen)
    return () => {
      window.removeEventListener('refresh-comments', handleRefresh)
      window.removeEventListener('open-comment-sidebar', handleOpen)
    }
  }, [chapterId])

  const handleAddComment = async () => {
    if (!newComment.trim() || !chapterId) return
    try {
      const created = await window.api.comments.create({
        chapterId,
        content: newComment.trim(),
        quote: quote
      })
      setNewComment('')
      setIsAdding(false)
      setQuote('')
      loadComments()
      // Dispatch an event so the Editor can apply the mark
      window.dispatchEvent(new CustomEvent('comment-created', { detail: { id: created.id } }))
    } catch {
      addToast('Failed to add comment', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="w-80 bg-surface-900 border-l border-surface-800 flex flex-col h-full flex-shrink-0 z-10 shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent-500" />
          Comments
        </h3>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-surface-500 text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p>No comments yet.</p>
            <p className="text-xs mt-1">Highlight text in the editor and click "Add Comment" to start.</p>
          </div>
        ) : (
          comments.map(comment => (
            <div 
              key={comment.id}
              id={`comment-${comment.id}`}
              onClick={() => onCommentClick?.(comment.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                activeCommentId === comment.id 
                  ? 'bg-accent-900/20 border-accent-500/50' 
                  : 'bg-surface-800 border-surface-700 hover:border-surface-600'
              } ${comment.resolved ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex-1">
                  <span className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!comment.resolved && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onResolve?.(comment.id) }}
                      className="text-surface-500 hover:text-success-400 p-1 transition-colors"
                      title="Resolve"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(comment.id) }}
                    className="text-surface-500 hover:text-danger-400 p-1 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              {comment.quote && (
                <div className="pl-2 border-l-2 border-surface-600 mb-2">
                  <p className="text-xs text-surface-400 italic line-clamp-2">"{comment.quote}"</p>
                </div>
              )}
              
              <p className="text-sm text-surface-200">{comment.content}</p>
              
              {comment.resolved && (
                <div className="mt-2 text-[10px] text-success-500 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Resolved
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div className="p-4 border-t border-surface-800 bg-surface-900 animate-fade-in">
          {quote && (
            <div className="pl-2 border-l-2 border-accent-500 mb-3">
              <p className="text-[11px] text-surface-400 italic line-clamp-2">"{quote}"</p>
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all resize-none mb-2"
            rows={3}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setIsAdding(false); setNewComment(''); setQuote('') }}
              className="flex-1 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="flex-1 py-1.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
