import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, MoreHorizontal, Pencil, Trash2, Loader2, Cloud, FileDown } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate } from '../../utils'
import { syncService } from '../../services/syncService'
import Modal from '../ui/Modal'
import ExportModal from '../export/ExportModal'
import type { Book } from '../../types'

export default function BookList() {
  const { user } = useUserStore()
  const { books, setBooks, addBook, updateBook, removeBook, setCurrentBook, setChapters } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [deleteBook, setDeleteBook] = useState<Book | null>(null)
  const [exportBook, setExportBook] = useState<Book | null>(null)
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ bookId: string; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!user) return
    window.api.books.getAll(user.id).then((b) => setBooks(b as Book[]))
  }, [user])

  const openBook = async (book: Book) => {
    setCurrentBook(book)
    const chapters = await window.api.chapters.getByBook(book.id)
    setChapters(chapters as never)
    navigate(`/book/${book.id}`)
  }

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    setIsLoading(true)
    try {
      const book = await window.api.books.create({
        userId: user.id, title: title.trim(), authorName: authorName.trim(), genre, description
      })
      addBook(book as Book)
      addToast(`"${title}" created!`, 'success')
      setIsCreateOpen(false)
      resetForm()
      await openBook(book as Book)
    } catch {
      addToast('Failed to create book', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editBook || !title.trim()) return
    setIsLoading(true)
    try {
      const updated = await window.api.books.update({
        id: editBook.id, title: title.trim(), authorName: authorName.trim(), genre, description
      })
      updateBook(updated as Book)
      addToast('Book updated', 'success')
      setEditBook(null)
      resetForm()
    } catch {
      addToast('Failed to update book', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteBook) return
    try {
      await window.api.books.delete(deleteBook.id)
      removeBook(deleteBook.id)
      addToast(`"${deleteBook.title}" deleted`, 'info')
      setDeleteBook(null)
    } catch {
      addToast('Failed to delete book', 'error')
    }
  }

  const openEditModal = (book: Book) => {
    setEditBook(book)
    setTitle(book.title)
    setAuthorName(book.author_name || '')
    setGenre(book.genre || '')
    setDescription(book.description || '')
    setContextMenu(null)
  }

  const resetForm = () => {
    setTitle('')
    setAuthorName('')
    setGenre('')
    setDescription('')
  }

  return (
    <div style={{ padding: '0 10px' }}>
      {books.map((book) => (
        <div key={book.id} className="group relative">
          <div
            onClick={() => openBook(book)}
            role="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '6px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: '#3d5c3a', cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e8e2d8'; (e.currentTarget as HTMLElement).style.color = '#1a2e18' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#3d5c3a' }}
          >
            <BookOpen style={{ width: 14, height: 14, flexShrink: 0, color: '#2d5a27' }} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</span>
            <button
              id={`book-menu-${book.id}`}
              onClick={(e) => { e.stopPropagation(); setContextMenu({ bookId: book.id, x: e.clientX, y: e.clientY }) }}
              className="opacity-0 group-hover:opacity-100 transition-all cursor-default"
              style={{ color: 'hsl(var(--surface-600))', background: 'none', border: 'none' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2d5a27'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0b09e'}
            >
              <MoreHorizontal style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      ))}

      {books.length === 0 && (
        <p style={{ fontSize: 12, color: '#a0b09e', padding: '8px 10px' }}>No books yet.</p>
      )}

      {/* Add book button */}
      <button
        id="create-book-btn"
        onClick={() => { resetForm(); setIsCreateOpen(true) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', marginTop: 4,
          color: '#7a8c77', background: 'none', border: 'none', borderRadius: 6,
          fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e8e2d8'; (e.currentTarget as HTMLElement).style.color = '#2d5a27' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#7a8c77' }}
      >
        <Plus style={{ width: 14, height: 14 }} />
        New Book
      </button>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y, background: 'hsl(var(--surface-950))', border: `1px solid hsl(var(--surface-800))`, borderRadius: 12, boxShadow: '0 4px 18px rgba(0,0,0,0.13)', padding: '4px 0', minWidth: 150 }}
          >
            {(() => {
              const b = books.find((bk) => bk.id === contextMenu.bookId)!
              return (
                <>
                  <button
                    onClick={() => openEditModal(b)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#3d5c3a', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e8f0e5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Pencil style={{ width: 14, height: 14 }} /> Edit
                  </button>
                  <button
                    onClick={async () => {
                      setContextMenu(null)
                      addToast('Publishing to cloud...', 'info')
                      const result = await syncService.publishBook(b.id)
                      if (result.success) {
                        addToast(`"${b.title}" published!`, 'success')
                        window.api.books.getAll(user!.id).then((bks) => setBooks(bks as Book[]))
                      } else {
                        addToast(result.error || 'Failed to publish', 'error')
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#3d5c3a', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e8f0e5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Cloud style={{ width: 14, height: 14 }} /> Publish to Cloud
                  </button>
                  <button
                    onClick={() => { setExportBook(b); setContextMenu(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#3d5c3a', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e8f0e5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <FileDown style={{ width: 14, height: 14 }} /> Export Book
                  </button>
                  <button
                    onClick={() => { setDeleteBook(b); setContextMenu(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fff0f0'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} /> Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Modals */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Book">
        <BookForm
          title={title} setTitle={setTitle}
          authorName={authorName} setAuthorName={setAuthorName}
          genre={genre} setGenre={setGenre}
          description={description} setDescription={setDescription}
          onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} submitLabel="Create Book" isLoading={isLoading}
        />
      </Modal>

      {exportBook && (
        <ExportModal
          book={exportBook}
          isOpen={!!exportBook}
          onClose={() => setExportBook(null)}
        />
      )}

      <Modal isOpen={!!editBook} onClose={() => setEditBook(null)} title="Edit Book">
        <BookForm
          title={title} setTitle={setTitle}
          authorName={authorName} setAuthorName={setAuthorName}
          genre={genre} setGenre={setGenre}
          description={description} setDescription={setDescription}
          onSubmit={handleEdit} onCancel={() => setEditBook(null)} submitLabel="Save Changes" isLoading={isLoading}
        />
      </Modal>

      <Modal isOpen={!!deleteBook} onClose={() => setDeleteBook(null)} title="Delete Book" size="sm">
        <p style={{ fontSize: 14, color: '#7a8c77', marginBottom: 20 }}>
          Are you sure you want to delete <strong style={{ color: '#1a2e18' }}>"{deleteBook?.title}"</strong>?
          All chapters and versions will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteBook(null)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: '#e8e2d8', color: '#3d5c3a' }}>Cancel</button>
          <button id="confirm-delete-book" onClick={handleDelete} className="flex-1 py-2 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: '#ef4444' }}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}

interface BookFormProps {
  title: string; setTitle: (v: string) => void
  authorName: string; setAuthorName: (v: string) => void
  genre: string; setGenre: (v: string) => void
  description: string; setDescription: (v: string) => void
  onSubmit: () => void; onCancel: () => void
  submitLabel: string; isLoading: boolean
}

function BookForm({ title, setTitle, authorName, setAuthorName, genre, setGenre, description, setDescription, onSubmit, onCancel, submitLabel, isLoading }: BookFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-surface-300 mb-1.5">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Novel"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && title.trim() && onSubmit()}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-300 mb-1.5">Author Name</label>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="J.K. Rowling"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-300 mb-1.5">Genre</label>
        <input
          type="text"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="Fantasy, Sci-Fi, Romance..."
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief summary of your story..."
          rows={3}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all resize-none"
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          id="book-form-submit"
          onClick={onSubmit}
          disabled={!title.trim() || isLoading}
          className="flex-1 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
