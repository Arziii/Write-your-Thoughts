import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Clock, ChevronRight, Camera, User as UserIcon, Target, Flame, ImagePlus, X, Pencil, Check, Upload } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate } from '../../utils'
import Modal from '../../components/ui/Modal'
import ImportModal from '../../components/import/ImportModal'
import { Button, Input, Textarea } from '../../components/ui/primitives'
import type { Book } from '../../types'
import { uploadImage, deleteImage } from '../../services/storageService'
import { authService } from '../../services/authService'

function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function Dashboard() {
  const { user, localUser, setLocalUser } = useUserStore()
  const { books, addBook, updateBook } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverPhotoRef = useRef<HTMLInputElement>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [coverPhoto, setCoverPhoto] = useState<string>(() => {
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

  useEffect(() => {
    if (user && !coverPhoto) {
      const savedCover = user.user_metadata?.dashboard_cover
        || localStorage.getItem(`dashboardCover_${user.id}`)
      if (savedCover) setCoverPhoto(savedCover)
    }
  }, [user, user?.user_metadata?.dashboard_cover])

  // Daily Goal Stats with calendar rollover check
  const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('dailyGoal') || '1000', 10) || 1000)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal))
  const [dailyProgress] = useState(() => {
    const lastDate = localStorage.getItem('wyt-daily-date')
    if (lastDate && lastDate !== todayKey()) return 0
    return parseInt(localStorage.getItem('dailyProgress') || '0', 10) || 0
  })
  const [streak] = useState(() => parseInt(localStorage.getItem('streak') || '0', 10) || 0)

  const recentBooks = [...books]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)
  const latestBook = recentBooks[0]

  const openBook = (book: Book) => {
    navigate(`/book/${book.id}`)
  }

  const saveGoal = () => {
    const parsed = Math.max(100, Math.min(20000, parseInt(goalDraft, 10) || 1000))
    setDailyGoal(parsed)
    setGoalDraft(String(parsed))
    localStorage.setItem('dailyGoal', String(parsed))
    setEditingGoal(false)
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
      openBook(book as Book)
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
    const reader = new FileReader()
    reader.onload = (ev) => { setPendingCover(ev.target?.result as string) }
    reader.readAsDataURL(file)
    ;(coverPhotoRef.current as any).__pendingFile = file
  }

  const confirmCover = async () => {
    const file = (coverPhotoRef.current as any).__pendingFile
    if (!file || !user) {
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
      if (coverPhotoRef.current) coverPhotoRef.current.value = ''
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
    : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cpath d='M25 75 Q35 50 50 75 Q65 100 75 75' stroke='%23c8dfc5' stroke-width='1.5' fill='none' opacity='0.35'/%3E%3Cpath d='M10 40 Q25 15 40 40 Q55 65 70 40' stroke='%23b5d4b0' stroke-width='1' fill='none' opacity='0.25'/%3E%3C/svg%3E")`

  const goalPct = Math.round((dailyProgress / dailyGoal) * 100)

  return (
    <div
      className="relative flex-1 overflow-y-auto bg-[hsl(var(--studio-desk))]"
      style={{
        backgroundImage: bgImage,
        backgroundSize: (pendingCover || coverPhoto) ? 'cover' : '100px 100px',
        backgroundPosition: 'center',
        backgroundAttachment: 'local',
      }}
    >
      {/* Cover Photo Controls */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
        {pendingCover && (
          <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-3.5 py-1.5 shadow-sm">
            <img src={pendingCover} alt="preview" className="h-[20px] w-[30px] rounded border border-[hsl(var(--studio-edge))] object-cover" />
            <span className="text-xs font-medium text-surface-200">Use this photo?</span>
            <Button variant="primary" size="xs" onClick={confirmCover} disabled={isUploadingCover}>
              {isUploadingCover ? 'Uploading…' : 'Confirm'}
            </Button>
            <Button variant="danger" size="xs" onClick={cancelPending} disabled={isUploadingCover}>✕</Button>
          </div>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCoverMenu(p => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.9)] px-2.5 py-1 text-[11px] font-semibold text-surface-300 shadow-sm backdrop-blur-sm transition-colors hover:bg-[hsl(var(--studio-paper))]"
          >
            <ImagePlus className="h-3 w-3" />
            {coverPhoto ? 'Cover Photo' : 'Add Cover'}
          </button>
          {showCoverMenu && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[165px] overflow-hidden rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] shadow-lg">
              <button
                type="button"
                onClick={() => { setShowCoverMenu(false); coverPhotoRef.current?.click() }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-surface-200 transition-colors hover:bg-surface-850"
              >
                <ImagePlus className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" /> Change Cover
              </button>
              {coverPhoto && (
                <button
                  type="button"
                  onClick={removeCover}
                  className="flex w-full items-center gap-2.5 border-t border-[hsl(var(--studio-edge))] px-4 py-2.5 text-left text-xs font-semibold text-danger-500 transition-colors hover:bg-danger-500/10"
                >
                  <span>✕</span> Remove Cover
                </button>
              )}
            </div>
          )}
        </div>
        <input ref={coverPhotoRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleCoverPhotoChange} />
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1040px] px-8 py-10 pb-14 space-y-6">
        {/* Compact Author Header */}
        <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.96)] px-6 py-4 shadow-sm">
          <div className="group relative h-14 w-14 shrink-0 cursor-pointer">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] shadow-sm">
              {isUploadingAvatar ? (
                <div className="flex h-full w-full items-center justify-center bg-surface-900/80">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--brand-green))] border-t-transparent" />
                </div>
              ) : localUser?.avatar_url
                ? <img src={localUser.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                : <UserIcon className="h-6 w-6 text-[hsl(var(--brand-green))]" />
              }
            </div>
            {!isUploadingAvatar && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5 text-white" />
                {localUser?.avatar_url && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleAvatarDelete() }}
                    className="rounded-full bg-danger-500/80 p-0.5 hover:bg-danger-500"
                    title="Remove photo"
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </button>
                )}
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-bold leading-snug text-surface-50">
              Welcome back, {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Writer'}
            </h1>
            <p className="text-xs text-surface-400">
              {books.length} {books.length === 1 ? 'story' : 'stories'} in your library
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-warning-400/30 bg-warning-500/10 px-3.5 py-1.5">
              <Flame className="h-4 w-4 text-warning-500" />
              <span className="text-xs font-semibold tabular-nums text-warning-400">{streak} Day Streak</span>
            </div>
            <Button id="dashboard-import-book" variant="secondary" size="md" onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button id="dashboard-create-book" variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Story
            </Button>
          </div>
        </div>

        {/* Resume Writing Hero + Daily Goal */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px] items-start">
          <div className="flex flex-col gap-5">
            {latestBook ? (
              <div className="flex flex-col sm:flex-row items-stretch gap-5 rounded-2xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-5 shadow-sm">
                <div className="flex h-36 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[hsl(var(--studio-edge))] bg-surface-850">
                  {latestBook.cover_image
                    ? <img src={latestBook.cover_image} alt={latestBook.title} className="h-full w-full object-cover" />
                    : <BookOpen className="h-8 w-8 text-surface-400 opacity-60" />
                  }
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-[hsl(var(--brand-green-bg))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-green))]">
                        Continue Writing
                      </span>
                      {latestBook.genre && (
                        <span className="text-xs text-surface-400">{latestBook.genre}</span>
                      )}
                    </div>
                    <h2 className="truncate font-serif text-2xl font-bold text-surface-50">{latestBook.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-surface-400">
                      {latestBook.description || 'Pick up your manuscript, worldbuilding lore, and atlas where you left off.'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-surface-500">Updated {formatDate(latestBook.updated_at)}</span>
                    <Button variant="primary" size="md" onClick={() => openBook(latestBook)}>
                      Open Book
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex w-full items-center gap-4 rounded-2xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--brand-green-bg))] p-6 text-left shadow-sm transition-opacity hover:opacity-95"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--brand-green))] text-white dark:text-surface-950">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-serif text-xl font-bold text-surface-50">Start Your First Story</p>
                  <p className="text-sm text-surface-400">Create a book to start drafting chapters, lore, and maps.</p>
                </div>
                <ChevronRight className="h-5 w-5 text-[hsl(var(--brand-green))]" />
              </button>
            )}

            {/* Actionable Daily Progress */}
            <div className="rounded-2xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[hsl(var(--brand-green))]" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-surface-400">Daily Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  {editingGoal ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={100}
                        max={20000}
                        step={100}
                        value={goalDraft}
                        onChange={e => setGoalDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false) }}
                        aria-label="Daily word goal"
                        className="w-20 rounded border border-[hsl(var(--studio-edge))] bg-surface-950 px-2 py-0.5 text-xs text-surface-100 focus:border-[hsl(var(--brand-green))] focus:outline-none"
                        autoFocus
                      />
                      <button type="button" onClick={saveGoal} aria-label="Save goal" className="rounded p-1 text-[hsl(var(--brand-green))] hover:bg-surface-850">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setGoalDraft(String(dailyGoal)); setEditingGoal(true) }}
                      title="Edit daily word goal"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-surface-400 hover:bg-surface-850 hover:text-surface-100"
                    >
                      <Pencil className="h-3 w-3" />
                      Goal
                    </button>
                  )}
                  <span className="rounded-lg bg-[hsl(var(--brand-green-bg))] px-2.5 py-1 text-xs font-bold tabular-nums text-[hsl(var(--brand-green))]">
                    {goalPct}%
                  </span>
                </div>
              </div>
              <p className="font-serif text-3xl font-bold leading-tight text-surface-50 tabular-nums">
                {dailyProgress.toLocaleString()}
                <span className="ml-1.5 text-[15px] font-normal text-surface-400">/ {dailyGoal.toLocaleString()} words</span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-850">
                <div
                  className="h-full rounded-full bg-[hsl(var(--brand-green))] transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(goalPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT — Recent Books */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-surface-400">Recently Opened</span>
            </div>

            {recentBooks.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {recentBooks.map((book) => (
                  <button
                    key={book.id}
                    id={`dashboard-book-${book.id}`}
                    type="button"
                    onClick={() => openBook(book)}
                    className="group/book flex w-full cursor-pointer items-center overflow-hidden rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-left shadow-sm transition-all hover:border-[hsl(var(--brand-green))] hover:shadow-md"
                  >
                    <div className="group/cover relative flex min-h-[80px] w-[62px] shrink-0 items-center justify-center bg-surface-850">
                      {book.cover_image
                        ? <img src={book.cover_image} alt={book.title} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <BookOpen className="h-5 w-5 text-surface-400 opacity-60" />
                      }
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover/cover:opacity-100">
                        <div
                          onClick={e => { e.stopPropagation(); document.getElementById(`cover-input-${book.id}`)?.click() }}
                          className="rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition-colors hover:bg-white/30"
                          title="Change Cover"
                        >
                          <Camera className="h-3.5 w-3.5 text-white" />
                        </div>
                        {book.cover_image && (
                          <div
                            onClick={e => { e.stopPropagation(); handleBookCoverDelete(book.id) }}
                            className="rounded-full bg-danger-500/80 p-0.5 backdrop-blur-sm transition-colors hover:bg-danger-500"
                            title="Remove Cover"
                          >
                            <X className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <input id={`cover-input-${book.id}`} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e => handleBookCoverChange(e, book.id)} />
                    </div>

                    <div className="min-w-0 flex-1 p-3">
                      <p className="mb-1 truncate font-serif text-[15px] font-bold text-surface-100 transition-colors group-hover/book:text-[hsl(var(--brand-green))]">{book.title}</p>
                      <p className="line-clamp-2 text-[11px] leading-snug text-surface-400">{book.description || 'No description yet.'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.5)] p-6 text-center">
                <BookOpen className="mx-auto mb-2 h-6 w-6 text-surface-500 opacity-60" />
                <p className="text-[13px] font-medium text-surface-300">No recent stories</p>
                <p className="mt-1 text-[11px] text-surface-500">When you open a book, it will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Book Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Book">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-200">Title *</label>
            <Input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="My Novel" autoFocus
              onKeyDown={e => e.key === 'Enter' && title.trim() && handleCreate()} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-200">Genre</label>
            <Input type="text" value={genre} onChange={e => setGenre(e.target.value)} placeholder="Fantasy, Sci-Fi, Romance…" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-200">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief summary…" rows={3} className="resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button id="dashboard-create-book-submit" variant="primary" size="md" className="flex-1" onClick={handleCreate} disabled={!title.trim() || isCreating}>
              {isCreating ? 'Creating…' : 'Create Book'}
            </Button>
          </div>
        </div>
      </Modal>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={(res) => {
          navigate(`/book/${res.bookId}`)
        }}
      />
    </div>
  )
}
