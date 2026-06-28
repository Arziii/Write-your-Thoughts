import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Clock, ChevronRight, Camera, User as UserIcon, Target, Flame, ImagePlus, X } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate } from '../../utils'
import Modal from '../../components/ui/Modal'
import type { Book, Chapter } from '../../types'
import { uploadImage, deleteImage } from '../../services/storageService'
import { authService } from '../../services/authService'

const statusColors: Record<string, string> = {
  planning: 'text-surface-500 bg-surface-800',
  writing: 'text-accent-400 bg-accent-600/10',
  completed: 'text-success-400 bg-success-400/10',
  archived: 'text-surface-600 bg-surface-800',
}

export default function Dashboard() {
  const { user, localUser, setLocalUser } = useUserStore()
  const { books, addBook, updateBook, setCurrentBook, setChapters } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverPhotoRef = useRef<HTMLInputElement>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [coverPhoto, setCoverPhoto] = useState<string>(() => {
    // Try cloud URL from user metadata or fall back to localStorage (legacy)
    if (!localUser?.id) return ''
    return localUser?.avatar_url?.includes('dashboard') ? localUser.avatar_url : localStorage.getItem(`dashboardCover_${localUser.id}`) || ''
  })
  const [pendingCover, setPendingCover] = useState<string>('')
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showCoverMenu, setShowCoverMenu] = useState(false)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Sync cover photo when user hydrates
  useEffect(() => {
    if (user && !coverPhoto) {
      const savedCover = user.user_metadata?.dashboard_cover 
        || localStorage.getItem(`dashboardCover_${user.id}`)
      if (savedCover) setCoverPhoto(savedCover)
    }
  }, [user, user?.user_metadata?.dashboard_cover])

  // Daily Goal Stats
  const [dailyGoal] = useState(() => parseInt(localStorage.getItem('dailyGoal') || '1000'))
  const [dailyProgress] = useState(() => parseInt(localStorage.getItem('dailyProgress') || '0'))
  const [streak] = useState(() => parseInt(localStorage.getItem('streak') || '0'))

  const recentBooks = [...books]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)

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
      const book = await window.api.books.create({ userId: user.id, title: title.trim(), genre, description })
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
    if (file.size > 5 * 1024 * 1024) { addToast('Image must be under 5MB', 'error'); return }
    setIsUploadingAvatar(true)
    try {
      const url = await uploadImage(file, 'books', `${user.id}-avatar`)
      const updatedUser = await window.api.auth.storeUser({ id: user.id, email: user.email!, displayName: user.user_metadata?.display_name, avatarUrl: url })
      await authService.updateAvatar(url)
      setLocalUser(updatedUser as never)
      addToast('Profile picture updated', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to update picture', 'error')
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleAvatarDelete = async () => {
    if (!user) return
    try {
      await deleteImage('books', `${user.id}-avatar`, 'unknown').catch(() => {})
      const updatedUser = await window.api.auth.storeUser({ id: user.id, email: user.email!, displayName: user.user_metadata?.display_name, avatarUrl: '' })
      await authService.updateAvatar('')
      setLocalUser(updatedUser as never)
      addToast('Profile picture removed', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to remove picture', 'error')
    }
  }

  const handleBookCoverChange = async (e: React.ChangeEvent<HTMLInputElement>, bookId: string) => {
    const file = e.target.files?.[0]
    if (!file || !bookId) return
    if (file.size > 5 * 1024 * 1024) { addToast('Image must be under 5MB', 'error'); return }
    try {
      const url = await uploadImage(file, 'books', bookId)
      const updatedBook = await window.api.books.update({ id: bookId, coverImage: url })
      updateBook(updatedBook as Book)
      addToast('Book cover updated', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to update cover', 'error')
    }
    e.target.value = ''
  }

  const handleBookCoverDelete = async (bookId: string) => {
    try {
      await deleteImage('books', bookId, 'unknown').catch(() => {})
      const updatedBook = await window.api.books.update({ id: bookId, coverImage: '' })
      updateBook(updatedBook as Book)
      addToast('Book cover removed', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to remove cover', 'error')
    }
  }

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { addToast('Cover image must be under 5MB', 'error'); return }
    // Show preview locally before uploading
    const reader = new FileReader()
    reader.onload = (ev) => { setPendingCover(ev.target?.result as string) }
    reader.readAsDataURL(file)
    // Stash the file for upload on confirm
    ;(coverPhotoRef.current as any).__pendingFile = file
  }

  const confirmCover = async () => {
    const file = (coverPhotoRef.current as any).__pendingFile
    if (!file || !user) {
      // Fallback: just save the base64 preview locally
      setCoverPhoto(pendingCover)
      if (user) localStorage.setItem(`dashboardCover_${user.id}`, pendingCover)
      setPendingCover('')
      addToast('Dashboard cover updated!', 'success')
      return
    }
    setIsUploadingCover(true)
    try {
      const url = await uploadImage(file, 'books', `${user.id}-dashboard-cover`)
      setCoverPhoto(url)
      localStorage.setItem(`dashboardCover_${user.id}`, url)
      await authService.updateDashboardCover(url)
      setPendingCover('')
      ;(coverPhotoRef.current as any).__pendingFile = null
      addToast('Dashboard cover updated!', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to upload cover', 'error')
    } finally {
      setIsUploadingCover(false)
      if (coverPhotoRef.current) {
        coverPhotoRef.current.value = ''
      }
    }
  }

  const cancelPending = () => {
    setPendingCover('')
    ;(coverPhotoRef.current as any).__pendingFile = null
  }

  const removeCover = async () => {
    if (user) {
      await deleteImage('books', `${user.id}-dashboard-cover`, 'unknown').catch(() => {})
      localStorage.removeItem(`dashboardCover_${user.id}`)
      await authService.updateDashboardCover(null)
    }
    setCoverPhoto(''); setPendingCover('')
    setShowCoverMenu(false)
    addToast('Cover removed', 'info')
  }

  const bgImage = (pendingCover || coverPhoto)
    ? `url(${pendingCover || coverPhoto})`
    : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cpath d='M25 75 Q35 50 50 75 Q65 100 75 75' stroke='%23c8dfc5' stroke-width='1.5' fill='none' opacity='0.55'/%3E%3Cpath d='M10 40 Q25 15 40 40 Q55 65 70 40' stroke='%23b5d4b0' stroke-width='1' fill='none' opacity='0.4'/%3E%3Cpath d='M60 10 Q75 30 90 10' stroke='%23c8dfc5' stroke-width='1' fill='none' opacity='0.4'/%3E%3Cpath d='M5 80 Q15 65 25 80' stroke='%23b5d4b0' stroke-width='0.8' fill='none' opacity='0.35'/%3E%3C/svg%3E")`

  return (
    <div
      className="flex-1 overflow-y-auto relative bg-surface-900"
      style={{
        backgroundImage: bgImage,
        backgroundSize: (pendingCover || coverPhoto) ? 'cover' : '100px 100px',
        backgroundPosition: 'center',
        backgroundAttachment: 'local',
      }}
    >
      {/* ── Cover Photo Controls ─ top right ────────────────── */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
        {pendingCover && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-950/95 border border-surface-800 shadow-sm backdrop-blur-sm">
            <img src={pendingCover} alt="preview" className="w-[30px] h-[20px] object-cover rounded border border-surface-800" />
             <span className="text-xs font-medium text-surface-300">Use this photo?</span>
             <button onClick={confirmCover} disabled={isUploadingCover} className="text-[11px] font-bold bg-accent-600 text-white border-none rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-70">
               {isUploadingCover ? '⏳ Uploading...' : '✓ Confirm'}
             </button>
             <button onClick={cancelPending} disabled={isUploadingCover} className="text-[11px] font-bold bg-danger-500/10 text-danger-500 border-none rounded-md px-2 py-1 cursor-pointer hover:bg-danger-500/20">✕</button>
          </div>
        )}
        <div className="relative">
          <button
            onClick={() => setShowCoverMenu(p => !p)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer shadow-sm backdrop-blur-sm transition-all",
              (coverPhoto || pendingCover) 
                ? "bg-surface-950/95 text-surface-300 border border-surface-800" 
                : "bg-surface-950/80 text-surface-400 border border-surface-800/50 hover:bg-surface-950"
            )}
          >
            <ImagePlus className="w-3 h-3" />
            {coverPhoto ? 'Cover Photo' : 'Add Cover'}
          </button>
          {showCoverMenu && (
            <div className="absolute right-0 top-[calc(100%+6px)] min-w-[165px] bg-surface-950 border border-surface-800 rounded-xl shadow-lg overflow-hidden z-30">
              <button
                onClick={() => { setShowCoverMenu(false); coverPhotoRef.current?.click() }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-semibold text-surface-300 bg-transparent border-none cursor-pointer text-left hover:bg-surface-900 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5 text-accent-500" /> Change Cover
              </button>
              {coverPhoto && (
                <button
                  onClick={removeCover}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-semibold text-danger-500 bg-transparent border-t border-surface-800 cursor-pointer text-left hover:bg-danger-500/10 transition-colors"
                >
                  <span>✕</span> Remove Cover
                </button>
              )}
            </div>
          )}
        </div>
        <input ref={coverPhotoRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleCoverPhotoChange} />
      </div>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="max-w-[1020px] mx-auto px-9 py-12 pb-14">

        {/* Header card */}
        <div className="flex items-center gap-5 mb-7 px-6 py-5 bg-surface-950/95 border border-surface-800 rounded-[20px] shadow-sm">
          {/* Avatar */}
          <div className="relative w-[68px] h-[68px] shrink-0 cursor-pointer group">
            <div className="w-[68px] h-[68px] rounded-full border-[3px] border-accent-600 overflow-hidden flex items-center justify-center bg-accent-200 dark:bg-accent-900 shadow-sm">
              {isUploadingAvatar ? (
                <div className="flex items-center justify-center w-full h-full bg-surface-900/80">
                  <svg className="animate-spin w-6 h-6 text-accent-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </div>
              ) : localUser?.avatar_url
                ? <img src={localUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                : <UserIcon className="w-7 h-7 text-accent-600 opacity-65" />
              }
            </div>
            {!isUploadingAvatar && (
              <div
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5 text-white" />
                {localUser?.avatar_url && (
                  <button
                    onClick={e => { e.stopPropagation(); handleAvatarDelete() }}
                    className="p-0.5 bg-danger-500/80 hover:bg-danger-500 rounded-full mt-0.5"
                    title="Remove photo"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
          </div>

          {/* Greeting */}
          <div className="flex-1">
            <h1 className="font-serif text-[27px] font-bold text-surface-50 leading-snug mb-1">
              Welcome back, {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Writer'} 🖋️
            </h1>
            <p className="text-sm text-surface-500 font-normal">
              {books.length} {books.length === 1 ? 'story' : 'stories'} waiting in your library.
            </p>
          </div>

          {/* Streak badge */}
          <div className="flex items-center gap-2 bg-warning-500/10 border border-warning-400/30 rounded-full px-4 py-2 shrink-0 shadow-sm">
            <Flame className="w-4 h-4 text-warning-500" />
            <span className="text-[13px] font-semibold text-warning-700 dark:text-warning-400">{streak} Day Streak</span>
          </div>
        </div>

        {/* ── Two-Column Magazine Layout ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">

          {/* LEFT */}
          <div className="flex flex-col gap-5">

            {/* New Story CTA */}
            <button
              id="dashboard-create-book"
              onClick={() => setIsCreateOpen(true)}
              className="w-full flex items-center gap-4 bg-gradient-to-br from-accent-600 to-accent-800 rounded-[18px] p-6 border-none shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all text-left"
            >
              <div className="w-[46px] h-[46px] rounded-[13px] bg-white/15 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-serif text-[19px] font-bold text-white mb-1">Start a New Story</p>
                <p className="text-[13px] text-white/70 italic">Every great tale begins with a single word.</p>
              </div>
              <ChevronRight className="w-[18px] h-[18px] text-white/50" />
            </button>

            {/* Daily Progress */}
            <div className="bg-surface-950 border border-surface-800 rounded-[18px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent-500" />
                  <span className="text-[11px] font-semibold text-surface-300 uppercase tracking-widest">Daily Progress</span>
                </div>
                <span className="text-xs font-bold text-accent-600 bg-accent-200 dark:bg-accent-900 dark:text-accent-300 rounded-lg px-2.5 py-1">
                  {Math.round((dailyProgress / dailyGoal) * 100)}%
                </span>
              </div>
              <p className="font-serif text-3xl font-bold text-surface-50 leading-tight">
                {dailyProgress.toLocaleString()}
                <span className="text-[15px] font-normal text-surface-600 ml-1.5">/ {dailyGoal.toLocaleString()} words</span>
              </p>
              <div className="h-2 bg-surface-800 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${Math.min((dailyProgress / dailyGoal) * 100, 100)}%` }} 
                />
              </div>
            </div>

            {/* Library count */}
            <div className="bg-surface-950 border border-surface-800 rounded-[18px] px-6 py-4 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-[13px] bg-accent-200 dark:bg-accent-900/50 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <p className="font-serif text-xl font-bold text-surface-50">{books.length} {books.length !== 1 ? 'Books' : 'Book'}</p>
                <p className="text-[13px] text-surface-600">In your library</p>
              </div>
            </div>
          </div>

          {/* RIGHT — Recent Books */}
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <Clock className="w-[13px] h-[13px] text-surface-600" />
              <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest">Recently Opened</span>
            </div>

            {recentBooks.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {recentBooks.map((book, idx) => (
                  <button
                    key={book.id}
                    id={`dashboard-book-${book.id}`}
                    onClick={() => openBook(book)}
                    className={cn(
                      "flex items-center bg-surface-950 border border-surface-800 rounded-[14px] overflow-hidden cursor-pointer transition-all text-left w-full group/book",
                      "hover:border-accent-500 hover:shadow-md",
                      idx === 0 ? "shadow-sm" : ""
                    )}
                  >
                    {/* Cover thumbnail */}
                    <div className="relative group/cover shrink-0 w-[66px] min-h-[86px] bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                      {book.cover_image
                        ? <img src={book.cover_image} alt={book.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <BookOpen className="w-[22px] h-[22px] text-surface-400 opacity-50" />
                      }
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer">
                        <div
                          onClick={e => { e.stopPropagation(); document.getElementById(`cover-input-${book.id}`)?.click() }}
                          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-1.5 transition-colors"
                          title="Change Cover"
                        >
                          <Camera className="w-3.5 h-3.5 text-white" />
                        </div>
                        {book.cover_image && (
                          <div
                            onClick={e => { e.stopPropagation(); handleBookCoverDelete(book.id) }}
                            className="bg-danger-500/80 hover:bg-danger-500 backdrop-blur-sm rounded-full p-0.5 transition-colors"
                            title="Remove Cover"
                          >
                            <X className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <input id={`cover-input-${book.id}`} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e => handleBookCoverChange(e, book.id)} />
                    </div>

                    <div className="p-3.5 flex-1 overflow-hidden">
                      <p className="font-serif text-[15px] font-bold text-surface-100 truncate mb-1 group-hover/book:text-accent-400 transition-colors">{book.title}</p>
                      <p className="text-[11px] text-surface-500 line-clamp-2 leading-snug">{book.description || 'No description yet.'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-surface-950/50 border border-dashed border-surface-700 rounded-[14px] p-6 text-center">
                <BookOpen className="w-6 h-6 text-surface-600 mx-auto mb-2 opacity-50" />
                <p className="text-[13px] font-medium text-surface-400">No recent stories</p>
                <p className="text-[11px] text-surface-600 mt-1">When you open a book, it will appear here.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Create Book Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Book">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="My Novel" autoFocus onKeyDown={e => e.key === 'Enter' && title.trim() && handleCreate()}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Genre</label>
            <input type="text" value={genre} onChange={e => setGenre(e.target.value)} placeholder="Fantasy, Sci-Fi, Romance..."
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief summary..." rows={3}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button id="dashboard-create-book-submit" onClick={handleCreate} disabled={!title.trim() || isCreating}
              className="flex-1 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {isCreating ? 'Creating...' : 'Create Book'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
