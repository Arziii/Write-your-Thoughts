import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Clock, ChevronRight, Camera, User as UserIcon, Target, Flame, ImagePlus } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate, formatWordCount } from '../../utils'
import Modal from '../../components/ui/Modal'
import type { Book, Chapter } from '../../types'

const statusColors: Record<string, string> = {
  planning: 'text-surface-500 bg-surface-800',
  writing: 'text-accent-400 bg-accent-600/10',
  completed: 'text-success-400 bg-success-400/10',
  archived: 'text-surface-600 bg-surface-800',
}

export default function Dashboard() {
  const { user, localUser, setLocalUser } = useUserStore()
  const { books, addBook, updateBook, setCurrentBook, setChapters, openTab } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverPhotoRef = useRef<HTMLInputElement>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [coverPhoto, setCoverPhoto] = useState<string>(() => localStorage.getItem('dashboardCover') || '')
  const [pendingCover, setPendingCover] = useState<string>('')
  const [showCoverMenu, setShowCoverMenu] = useState(false)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Daily Goal Stats
  const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('dailyGoal') || '1000'))
  const [dailyProgress, setDailyProgress] = useState(() => parseInt(localStorage.getItem('dailyProgress') || '450'))
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('streak') || '3'))

  const recentBooks = [...books].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 6)

  const openBook = async (book: Book) => {
    setCurrentBook(book)
    const chapters = await window.api.chapters.getByBook(book.id)
    setChapters(chapters as Chapter[])
    navigate(`/book/${book.id}`)
  }

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    setIsCreating(true)
    try {
      const book = await window.api.books.create({
        userId: user.id, title: title.trim(), genre, description
      })
      addBook(book as Book)
      addToast(`"${title}" created!`, 'success')
      setIsCreateOpen(false)
      setTitle(''); setGenre(''); setDescription('')
      await openBook(book as Book)
    } catch {
      addToast('Failed to create book', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be under 2MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      try {
        const updatedUser = await window.api.auth.storeUser({
          id: user.id,
          email: user.email!,
          displayName: user.user_metadata?.display_name,
          avatarUrl: base64
        })
        setLocalUser(updatedUser as never)
        addToast('Profile picture updated', 'success')
      } catch (err) {
        addToast('Failed to update picture', 'error')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleBookCoverChange = async (e: React.ChangeEvent<HTMLInputElement>, bookId: string) => {
    const file = e.target.files?.[0]
    if (!file || !bookId) return

    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be under 2MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      try {
        const updatedBook = await window.api.books.update({
          id: bookId,
          coverImage: base64
        })
        updateBook(updatedBook as Book)
        addToast('Book cover updated', 'success')
      } catch (err) {
        addToast('Failed to update cover', 'error')
      }
    }
    reader.readAsDataURL(file)
    // Clear the input value so the same file can be selected again
    e.target.value = ''
  }

  const totalWords = books.reduce((sum, _b) => sum, 0) // Would need chapters for real count

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      addToast('Cover image must be under 5MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setPendingCover(base64)  // Show preview + confirm button, don't commit yet
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const confirmCover = () => {
    setCoverPhoto(pendingCover)
    localStorage.setItem('dashboardCover', pendingCover)
    setPendingCover('')
    addToast('Dashboard cover updated!', 'success')
  }

  const cancelPending = () => {
    setPendingCover('')
  }

  const removeCover = () => {
    setCoverPhoto('')
    setPendingCover('')
    localStorage.removeItem('dashboardCover')
    setShowCoverMenu(false)
    addToast('Cover removed', 'info')
  }

  return (
    <div
      className="flex-1 overflow-y-auto relative"
      style={{
        backgroundColor: 'hsl(220, 20%, 98%)',
        backgroundImage: (pendingCover || coverPhoto) ? `url(${pendingCover || coverPhoto})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'local',
      }}
    >
      {/* No overlay — cover photo shows fully */}

      {/* Cover Photo Button — top right */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-2">

        {/* Pending confirmation bar */}
        {pendingCover && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md"
            style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', backdropFilter: 'blur(8px)' }}
          >
            <img src={pendingCover} alt="preview" style={{ width: 28, height: 20, objectFit: 'cover', borderRadius: 4 }} />
            <span style={{ color: '#334155' }}>Use this photo?</span>
            <button
              onClick={confirmCover}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-white text-xs font-bold transition-colors"
              style={{ background: '#22c55e' }}
              title="Confirm cover"
            >
              ✓ Confirm
            </button>
            <button
              onClick={cancelPending}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold transition-colors"
              style={{ background: '#fee2e2', color: '#ef4444' }}
              title="Cancel"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main cover button */}
        <div className="relative">
          <button
            onClick={() => setShowCoverMenu(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
            style={{
              background: (coverPhoto || pendingCover) ? 'rgba(255,255,255,0.92)' : 'rgba(30,41,59,0.88)',
              color: (coverPhoto || pendingCover) ? '#334155' : '#94a3b8',
              border: '1px solid rgba(148,163,184,0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {coverPhoto ? 'Cover Photo' : 'Add Cover'}
          </button>

          {/* Dropdown menu */}
          {showCoverMenu && (
            <div
              className="absolute right-0 top-full mt-1.5 rounded-xl shadow-xl overflow-hidden z-30"
              style={{ minWidth: 160, background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0', backdropFilter: 'blur(12px)' }}
            >
              <button
                onClick={() => { setShowCoverMenu(false); coverPhotoRef.current?.click() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-blue-50"
                style={{ color: '#334155' }}
              >
                <ImagePlus className="w-3.5 h-3.5 text-blue-500" />
                Change Cover
              </button>
              {coverPhoto && (
                <button
                  onClick={removeCover}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-red-50 border-t border-gray-100"
                  style={{ color: '#ef4444' }}
                >
                  <span className="text-sm">✕</span>
                  Remove Cover
                </button>
              )}
            </div>
          )}
        </div>

        <input
          ref={coverPhotoRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverPhotoChange}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-8 py-10 space-y-10">

        {/* Welcome header */}
        <div className="animate-fade-in flex items-center gap-6"
          style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: '16px 20px', backdropFilter: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
        >
          <div 
            className="relative w-20 h-20 rounded-full bg-surface-800 flex items-center justify-center flex-shrink-0 cursor-pointer group border-2 border-surface-700 overflow-hidden shadow-lg"
            onClick={() => fileInputRef.current?.click()}
          >
            {localUser?.avatar_url ? (
              <img src={localUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-8 h-8 text-surface-400 group-hover:opacity-0 transition-opacity" />
            )}
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white mb-1" />
              <span className="text-[10px] text-white font-medium">Edit</span>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp" 
              onChange={handleAvatarChange} 
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-surface-50 mb-1">
              Welcome back{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ''} 👋
            </h1>
            <p className="text-surface-400">
              {books.length} book{books.length !== 1 ? 's' : ''} in your library.
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <button
            id="dashboard-create-book"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-4 p-5 bg-gradient-to-br from-accent-600 to-accent-700 rounded-xl text-left hover:from-accent-500 hover:to-accent-600 transition-all shadow-lg shadow-accent-900/30 group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">New Book</p>
              <p className="text-accent-200 text-sm">Start a new story</p>
            </div>
            <ChevronRight className="w-4 h-4 text-accent-300 ml-auto group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{books.length} Books</p>
              <p className="text-gray-500 text-sm">In your library</p>
            </div>
          </div>
        </div>

        {/* Daily Goal & Streak */}
        <div className="animate-slide-up" style={{ animationDelay: '75ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-500" />
              Daily Progress
            </h2>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-orange-200 shadow-sm">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-gray-700">{streak} Day Streak</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-3xl font-bold text-gray-800">
                  {dailyProgress} <span className="text-base font-medium text-gray-400">/ {dailyGoal} words</span>
                </p>
              </div>
              <p className="text-sm font-semibold text-accent-600 bg-accent-50 px-2 py-1 rounded-md">
                {Math.round((dailyProgress / dailyGoal) * 100)}%
              </p>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${Math.min((dailyProgress / dailyGoal) * 100, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse-soft" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent books */}
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Recent Books
            </h2>
          </div>

          {recentBooks.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {recentBooks.map((book) => (
                <button
                  key={book.id}
                  id={`dashboard-book-${book.id}`}
                  onClick={() => openBook(book)}
                  className="group p-5 bg-white rounded-xl text-left border border-gray-100 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
                >
                  {/* Book cover area */}
                  <div className="relative w-full h-24 rounded-lg bg-gradient-to-br from-accent-900/40 to-surface-800 mb-4 flex items-center justify-center overflow-hidden border border-surface-700/50 group/cover">
                    {book.cover_image ? (
                      <img 
                        src={book.cover_image} 
                        alt={book.title} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          // Fallback if image fails to load
                          ;(e.target as HTMLImageElement).style.display = 'none'
                          e.currentTarget.parentElement?.classList.add('image-failed')
                        }}
                      />
                    ) : (
                      <BookOpen className="w-8 h-8 text-accent-600 opacity-50" />
                    )}
                    
                    {/* Hover edit overlay */}
                    <div 
                      className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        document.getElementById(`cover-input-${book.id}`)?.click()
                      }}
                    >
                      <Camera className="w-5 h-5 text-white mb-1" />
                      <span className="text-[10px] text-white font-medium">Edit Cover</span>
                    </div>

                    <input 
                      id={`cover-input-${book.id}`}
                      type="file" 
                      className="hidden" 
                      accept="image/jpeg,image/png,image/webp" 
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleBookCoverChange(e, book.id)} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-800 text-sm truncate group-hover:text-accent-600 transition-colors">
                        {book.title}
                      </p>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize font-medium',
                        statusColors[book.status] || statusColors.writing
                      )}>
                        {book.status}
                      </span>
                    </div>
                    {book.genre && (
                      <p className="text-xs text-gray-500">{book.genre}</p>
                    )}
                    <p className="text-[11px] text-gray-400">
                      Updated {formatDate(book.updated_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
              <BookOpen className="w-12 h-12 text-surface-700 mx-auto mb-4" />
              <p className="text-surface-400 font-medium mb-1">No books yet</p>
              <p className="text-surface-600 text-sm mb-5">Create your first book to get started.</p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create a Book
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Book Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Book">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Title *</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="My Novel" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && title.trim() && handleCreate()}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Genre</label>
            <input
              type="text" value={genre} onChange={(e) => setGenre(e.target.value)}
              placeholder="Fantasy, Sci-Fi, Romance..."
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief summary..." rows={3}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button
              id="dashboard-create-book-submit"
              onClick={handleCreate} disabled={!title.trim() || isCreating}
              className="flex-1 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Book'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
