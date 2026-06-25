import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, MoreHorizontal, Pencil, Trash2, Loader2, Cloud } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate } from '../../utils'
import { syncService } from '../../services/syncService'
import Modal from '../ui/Modal'
import type { Book } from '../../types'

export default function BookList() {
  const { user } = useUserStore()
  const { books, setBooks, addBook, updateBook, removeBook, setCurrentBook, setChapters } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [deleteBook, setDeleteBook] = useState<Book | null>(null)
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
    <div className="px-1">
      {books.map((book) => (
        <div key={book.id} className="group relative">
          <div
            onClick={() => openBook(book)}
            role="button"
            className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 rounded-md transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-accent-500" />
            <span className="truncate flex-1 text-left">{book.title}</span>
            <button
              id={`book-menu-${book.id}`}
              onClick={(e) => {
                e.stopPropagation()
                setContextMenu({ bookId: book.id, x: e.clientX, y: e.clientY })
              }}
              className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-surface-300 transition-all cursor-default"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {books.length === 0 && (
        <p className="text-xs text-surface-600 px-3 py-2">No books yet.</p>
      )}

      {/* Add book button */}
      <button
        id="create-book-btn"
        onClick={() => { resetForm(); setIsCreateOpen(true) }}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-surface-600 hover:text-accent-400 hover:bg-surface-800/40 rounded-md transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        New Book
      </button>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-36 animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const b = books.find((bk) => bk.id === contextMenu.bookId)!
              return (
                <>
                  <button
                    onClick={() => openEditModal(b)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
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
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-accent-400 transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    Publish to Cloud
                  </button>
                  <button
                    onClick={() => { setDeleteBook(b); setContextMenu(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-danger-400 hover:bg-surface-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Create Book Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Book">
        <BookForm
          title={title} setTitle={setTitle}
          authorName={authorName} setAuthorName={setAuthorName}
          genre={genre} setGenre={setGenre}
          description={description} setDescription={setDescription}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          submitLabel="Create Book"
          isLoading={isLoading}
        />
      </Modal>

      {/* Edit Book Modal */}
      <Modal isOpen={!!editBook} onClose={() => setEditBook(null)} title="Edit Book">
        <BookForm
          title={title} setTitle={setTitle}
          authorName={authorName} setAuthorName={setAuthorName}
          genre={genre} setGenre={setGenre}
          description={description} setDescription={setDescription}
          onSubmit={handleEdit}
          onCancel={() => setEditBook(null)}
          submitLabel="Save Changes"
          isLoading={isLoading}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteBook} onClose={() => setDeleteBook(null)} title="Delete Book" size="sm">
        <p className="text-sm text-surface-300 mb-5">
          Are you sure you want to delete <strong className="text-surface-100">"{deleteBook?.title}"</strong>?
          All chapters and versions will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteBook(null)}
            className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-book"
            onClick={handleDelete}
            className="flex-1 py-2 bg-danger-500 hover:bg-danger-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Delete
          </button>
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
