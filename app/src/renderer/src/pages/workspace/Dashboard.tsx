import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Clock, ChevronRight, Camera, User as UserIcon, Target, Flame, ImagePlus, X } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatDate } from '../../utils'
import Modal from '../../components/ui/Modal'
import type { Book, Chapter } from '../../types'
import { uploadImage, deleteImage } from '../../services/storageService'

const statusColors: Record<string, string> = {
  planning: 'text-surface-500 bg-surface-800',
  writing: 'text-accent-400 bg-accent-600/10',
  completed: 'text-success-400 bg-success-400/10',
  archived: 'text-surface-600 bg-surface-800',
}

// Forest literary palette
const F = {
  bg: 'hsl(var(--surface-900))',
  card: 'hsl(var(--surface-950))',
  border: 'hsl(var(--surface-800))',
  green: 'hsl(214, 82%, 48%)',
  greenLight: 'hsl(214, 96%, 88%)',
  greenMid: 'hsl(214, 84%, 55%)',
  text: 'hsl(var(--surface-50))',
  textMid: 'hsl(var(--surface-300))',
  textSoft: 'hsl(var(--surface-500))',
  textMuted: 'hsl(var(--surface-600))',
  amber: 'hsl(38, 95%, 58%)',
  amberBg: 'hsl(38, 92%, 50%, 0.1)',
  amberBorder: 'hsl(38, 95%, 58%, 0.5)',
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
    return localUser?.avatar_url?.includes('dashboard') ? localUser.avatar_url : localStorage.getItem('dashboardCover') || ''
  })
  const [pendingCover, setPendingCover] = useState<string>('')
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showCoverMenu, setShowCoverMenu] = useState(false)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Daily Goal Stats
  const [dailyGoal] = useState(() => parseInt(localStorage.getItem('dailyGoal') || '1000'))
  const [dailyProgress] = useState(() => parseInt(localStorage.getItem('dailyProgress') || '450'))
  const [streak] = useState(() => parseInt(localStorage.getItem('streak') || '3'))

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
    e.target.value = ''
  }

  const confirmCover = async () => {
    const file = (coverPhotoRef.current as any).__pendingFile
    if (!file || !user) {
      // Fallback: just save the base64 preview locally
      setCoverPhoto(pendingCover)
      localStorage.setItem('dashboardCover', pendingCover)
      setPendingCover('')
      addToast('Dashboard cover updated!', 'success')
      return
    }
    setIsUploadingCover(true)
    try {
      const url = await uploadImage(file, 'books', `${user.id}-dashboard-cover`)
      setCoverPhoto(url)
      localStorage.setItem('dashboardCover', url)
      setPendingCover('')
      ;(coverPhotoRef.current as any).__pendingFile = null
      addToast('Dashboard cover updated!', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to upload cover', 'error')
    } finally {
      setIsUploadingCover(false)
    }
  }

  const cancelPending = () => {
    setPendingCover('')
    ;(coverPhotoRef.current as any).__pendingFile = null
  }

  const removeCover = async () => {
    if (user) await deleteImage('books', `${user.id}-dashboard-cover`, 'unknown').catch(() => {})
    setCoverPhoto(''); setPendingCover('')
    localStorage.removeItem('dashboardCover')
    setShowCoverMenu(false)
    addToast('Cover removed', 'info')
  }

  const bgImage = (pendingCover || coverPhoto)
    ? `url(${pendingCover || coverPhoto})`
    : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cpath d='M25 75 Q35 50 50 75 Q65 100 75 75' stroke='%23c8dfc5' stroke-width='1.5' fill='none' opacity='0.55'/%3E%3Cpath d='M10 40 Q25 15 40 40 Q55 65 70 40' stroke='%23b5d4b0' stroke-width='1' fill='none' opacity='0.4'/%3E%3Cpath d='M60 10 Q75 30 90 10' stroke='%23c8dfc5' stroke-width='1' fill='none' opacity='0.4'/%3E%3Cpath d='M5 80 Q15 65 25 80' stroke='%23b5d4b0' stroke-width='0.8' fill='none' opacity='0.35'/%3E%3C/svg%3E")`

  return (
    <div
      className="flex-1 overflow-y-auto relative"
      style={{
        backgroundColor: F.bg,
        backgroundImage: bgImage,
        backgroundSize: (pendingCover || coverPhoto) ? 'cover' : '100px 100px',
        backgroundPosition: 'center',
        backgroundAttachment: 'local',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Cover Photo Controls ─ top right ────────────────── */}
      <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        {pendingCover && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 10, background: 'rgba(255,253,248,0.97)', border: `1px solid ${F.border}`, boxShadow: '0 2px 10px rgba(45,90,39,0.1)' }}>
            <img src={pendingCover} alt="preview" style={{ width: 30, height: 20, objectFit: 'cover', borderRadius: 4, border: `1px solid ${F.border}` }} />
             <span style={{ fontSize: 12, color: F.textMid, fontWeight: 500 }}>Use this photo?</span>
             <button onClick={confirmCover} disabled={isUploadingCover} style={{ fontSize: 11, fontWeight: 700, background: F.green, color: 'white', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', opacity: isUploadingCover ? 0.7 : 1 }}>
               {isUploadingCover ? '⏳ Uploading...' : '✓ Confirm'}
             </button>
             <button onClick={cancelPending} disabled={isUploadingCover} style={{ fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowCoverMenu(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: (coverPhoto || pendingCover) ? 'rgba(255,253,248,0.95)' : 'rgba(45,90,39,0.9)', color: (coverPhoto || pendingCover) ? F.textMid : '#d6f0d0', border: `1px solid ${(coverPhoto || pendingCover) ? F.border : 'rgba(255,255,255,0.15)'}`, boxShadow: '0 2px 8px rgba(45,90,39,0.15)' }}
          >
            <ImagePlus style={{ width: 12, height: 12 }} />
            {coverPhoto ? 'Cover Photo' : 'Add Cover'}
          </button>
          {showCoverMenu && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 165, background: F.card, border: `1px solid ${F.border}`, borderRadius: 12, boxShadow: '0 4px 18px rgba(45,90,39,0.13)', overflow: 'hidden', zIndex: 30 }}>
              <button
                onClick={() => { setShowCoverMenu(false); coverPhotoRef.current?.click() }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = F.greenLight}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: F.textMid, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <ImagePlus style={{ width: 13, height: 13, color: F.green }} /> Change Cover
              </button>
              {coverPhoto && (
                <button
                  onClick={removeCover}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fff0f0'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'transparent', border: 'none', borderTop: `1px solid ${F.border}`, cursor: 'pointer', textAlign: 'left' }}
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
      <div style={{ maxWidth: 1020, margin: '0 auto', padding: '48px 36px 56px' }}>

        {/* Header card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 28, padding: '20px 26px', background: 'rgba(255,253,248,0.95)', border: `1px solid ${F.border}`, borderRadius: 20, boxShadow: '0 2px 16px rgba(45,90,39,0.08)' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0, cursor: 'pointer' }} className="group">
            <div style={{ width: 68, height: 68, borderRadius: '50%', border: `3px solid ${F.green}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: F.greenLight, boxShadow: '0 2px 10px rgba(45,90,39,0.2)' }}>
              {isUploadingAvatar ? (
                <div className="flex items-center justify-center w-full h-full bg-surface-900/80">
                  <svg className="animate-spin w-6 h-6 text-accent-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </div>
              ) : localUser?.avatar_url
                ? <img src={localUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <UserIcon style={{ width: 28, height: 28, color: F.green, opacity: 0.65 }} />
              }
            </div>
            {!isUploadingAvatar && (
              <div
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera style={{ width: 14, height: 14, color: 'white' }} />
                {localUser?.avatar_url && (
                  <button
                    onClick={e => { e.stopPropagation(); handleAvatarDelete() }}
                    className="p-0.5 bg-red-600/80 hover:bg-red-600 rounded-full mt-0.5"
                    title="Remove photo"
                  >
                    <X style={{ width: 9, height: 9, color: 'white' }} />
                  </button>
                )}
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
          </div>

          {/* Greeting */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 27, fontWeight: 700, color: F.text, lineHeight: 1.2, marginBottom: 5 }}>
              Welcome back{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ''} 🌿
            </h1>
            <p style={{ fontSize: 14, color: F.textSoft, fontWeight: 400 }}>
              {books.length} {books.length !== 1 ? 'stories' : 'story'} growing in your library.
            </p>
          </div>

          {/* Streak badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: F.amberBg, border: `1px solid ${F.amberBorder}`, borderRadius: 999, padding: '7px 16px', boxShadow: '0 1px 4px rgba(200,160,40,0.1)', flexShrink: 0 }}>
            <Flame style={{ width: 15, height: 15, color: F.amber }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>{streak} Day Streak</span>
          </div>
        </div>

        {/* ── Two-Column Magazine Layout ──────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* New Story CTA */}
            <button
              id="dashboard-create-book"
              onClick={() => setIsCreateOpen(true)}
              style={{ background: `linear-gradient(135deg, ${F.green} 0%, #1a3a16 100%)`, borderRadius: 18, padding: '22px 26px', border: 'none', boxShadow: '0 4px 20px rgba(45,90,39,0.3)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 18 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(45,90,39,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(45,90,39,0.3)' }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Plus style={{ width: 22, height: 22, color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Start a New Story</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic' }}>Every great tale begins with a single word.</p>
              </div>
              <ChevronRight style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.5)' }} />
            </button>

            {/* Daily Progress */}
            <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 18, padding: '20px 24px', boxShadow: '0 2px 10px rgba(45,90,39,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target style={{ width: 15, height: 15, color: F.green }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: F.textMid, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Daily Progress</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: F.green, background: F.greenLight, borderRadius: 8, padding: '3px 10px' }}>
                  {Math.round((dailyProgress / dailyGoal) * 100)}%
                </span>
              </div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: F.text, lineHeight: 1.1 }}>
                {dailyProgress.toLocaleString()}
                <span style={{ fontSize: 15, fontWeight: 400, color: F.textMuted, marginLeft: 6 }}>/ {dailyGoal.toLocaleString()} words</span>
              </p>
              <div style={{ height: 7, background: '#e0eadd', borderRadius: 99, overflow: 'hidden', marginTop: 16 }}>
                <div style={{ height: '100%', width: `${Math.min((dailyProgress / dailyGoal) * 100, 100)}%`, background: `linear-gradient(90deg, ${F.green}, ${F.greenMid})`, borderRadius: 99, transition: 'width 1s ease-out' }} />
              </div>
            </div>

            {/* Library count */}
            <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 18, padding: '16px 24px', boxShadow: '0 2px 10px rgba(45,90,39,0.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: F.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen style={{ width: 20, height: 20, color: F.green }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: F.text }}>{books.length} {books.length !== 1 ? 'Books' : 'Book'}</p>
                <p style={{ fontSize: 13, color: F.textMuted }}>In your library</p>
              </div>
            </div>
          </div>

          {/* RIGHT — Recent Books */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <Clock style={{ width: 13, height: 13, color: F.textMuted }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: F.textSoft, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recently Opened</span>
            </div>

            {recentBooks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentBooks.map((book, idx) => (
                  <button
                    key={book.id}
                    id={`dashboard-book-${book.id}`}
                    onClick={() => openBook(book)}
                    style={{ display: 'flex', background: F.card, border: `1px solid ${F.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: idx === 0 ? '0 4px 14px rgba(45,90,39,0.1)' : '0 2px 6px rgba(45,90,39,0.05)', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = F.green; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(45,90,39,0.15)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = F.border; (e.currentTarget as HTMLElement).style.boxShadow = idx === 0 ? '0 4px 14px rgba(45,90,39,0.1)' : '0 2px 6px rgba(45,90,39,0.05)' }}
                  >
                    {/* Cover thumbnail */}
                    <div className="relative group/cover flex-shrink-0" style={{ width: 66, minHeight: 86, background: `linear-gradient(135deg, #c8dfc5, #a5c9a0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {book.cover_image
                        ? <img src={book.cover_image} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <BookOpen style={{ width: 22, height: 22, color: F.green, opacity: 0.5 }} />
                      }
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
                        style={{ cursor: 'pointer' }}>
                        <div
                          onClick={e => { e.stopPropagation(); document.getElementById(`cover-input-${book.id}`)?.click() }}
                          className="flex items-center justify-center">
                          <Camera style={{ width: 13, height: 13, color: 'white' }} />
                        </div>
                        {book.cover_image && (
                          <button
                            onClick={e => { e.stopPropagation(); handleBookCoverDelete(book.id) }}
                            className="p-0.5 bg-red-600/80 hover:bg-red-600 rounded-full"
                            title="Remove cover"
                          >
                            <X style={{ width: 10, height: 10, color: 'white' }} />
                          </button>
                        )}
                      </div>
                      <input id={`cover-input-${book.id}`} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onClick={e => e.stopPropagation()} onChange={e => handleBookCoverChange(e, book.id)} />
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: F.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{book.title}</p>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize font-medium', statusColors[book.status] || statusColors.writing)}>{book.status}</span>
                      </div>
                      {book.genre && <p style={{ fontSize: 11, color: F.textSoft, marginBottom: 2 }}>{book.genre}</p>}
                      <p style={{ fontSize: 11, color: F.textMuted }}>Updated {formatDate(book.updated_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ background: F.card, border: `1px dashed #c0cec0`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
                <BookOpen style={{ width: 34, height: 34, color: '#c0cec0', margin: '0 auto 12px' }} />
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: F.textSoft, marginBottom: 6 }}>No stories yet</p>
                <p style={{ fontSize: 13, color: F.textMuted, marginBottom: 16 }}>Start writing your first chapter.</p>
                <button onClick={() => setIsCreateOpen(true)} style={{ fontFamily: "'DM Sans', sans-serif", background: F.green, color: 'white', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Create a Book
                </button>
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
