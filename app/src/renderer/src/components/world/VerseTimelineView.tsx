import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Calendar as CalendarIcon, AlignLeft } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useToastStore } from '../../stores/toastStore'
import { VerseTimelineEvent } from '../../types'

const F = {
  bg: '#fffefb',          // Main canvas bg
  bgAlt: '#f0ece4',       // Card/Panel bg
  border: '#d0c9bc',      // Borders
  green: '#2d5a27',       // Primary green
  greenLight: '#e8f0e5',  // Hover bg
  text: '#1a2e18',        // Main text
  textSoft: '#7a8c77',    // Subtext
  red: '#dc2626',
  redLight: '#fef2f2'
}

export default function VerseTimelineView() {
  const { currentBook } = useWorkspaceStore()
  const { verseTimelineEvents, setVerseTimelineEvents, addVerseTimelineEvent, updateVerseTimelineEvent, removeVerseTimelineEvent } = useStoryBibleStore()
  const { addToast } = useToastStore()
  
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [sortOrder, setSortOrder] = useState(0)

  useEffect(() => {
    if (currentBook) {
      loadTimeline()
    }
  }, [currentBook])

  const loadTimeline = async () => {
    try {
      const events = await window.api.verseTimeline.getByBook(currentBook!.id)
      setVerseTimelineEvents(events)
    } catch (e) {
      console.error(e)
      addToast('Failed to load verse timeline', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const newEvent = await window.api.verseTimeline.create({
        book_id: currentBook!.id,
        title: 'New Event',
        description: '',
        event_date: 'Year 0',
        sort_order: verseTimelineEvents.length * 10
      })
      addVerseTimelineEvent(newEvent)
      startEditing(newEvent)
    } catch (e) {
      addToast('Failed to add event', 'error')
    }
  }

  const handleSave = async (id: string) => {
    try {
      const updated = await window.api.verseTimeline.update({
        id,
        title,
        description,
        event_date: eventDate,
        sort_order: sortOrder
      })
      updateVerseTimelineEvent(updated)
      setEditingId(null)
      addToast('Event updated', 'success')
    } catch (e) {
      addToast('Failed to save event', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    try {
      await window.api.verseTimeline.delete(id)
      removeVerseTimelineEvent(id)
      addToast('Event deleted', 'success')
    } catch (e) {
      addToast('Failed to delete event', 'error')
    }
  }

  const startEditing = (event: VerseTimelineEvent) => {
    setEditingId(event.id)
    setTitle(event.title)
    setDescription(event.description || '')
    setEventDate(event.event_date || '')
    setSortOrder(event.sort_order || 0)
  }

  if (loading) return <div className="p-8 text-center" style={{ color: F.textSoft }}>Loading timeline...</div>

  // Sort events by sortOrder
  const sortedEvents = [...verseTimelineEvents].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <div className="h-full overflow-y-auto" style={{ background: F.bg, padding: '40px 60px' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: F.text, marginBottom: 8 }}>
              Verse Timeline Record
            </h1>
            <p style={{ color: F.textSoft, fontSize: 14 }}>
              Chronological records of major world events that shape your story's universe.
            </p>
          </div>
          <button
            onClick={handleAdd}
            style={{
              padding: '10px 16px', background: F.green, color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(45, 90, 39, 0.2)'
            }}
          >
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>

        <div className="relative">
          {/* Vertical line connecting timeline events */}
          <div style={{ position: 'absolute', left: 24, top: 20, bottom: 20, width: 2, background: F.border }} />

          <div className="space-y-6">
            {sortedEvents.map(event => {
              const isEditing = editingId === event.id

              return (
                <div key={event.id} className="relative pl-16">
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute', left: 16, top: 20, width: 18, height: 18, borderRadius: '50%',
                    background: F.bg, border: `4px solid ${F.green}`, zIndex: 10
                  }} />

                  <div style={{
                    background: F.bgAlt, border: `1px solid ${F.border}`, borderRadius: 12, padding: 24,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                  }}>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: F.textSoft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Title</label>
                            <input
                              value={title} onChange={e => setTitle(e.target.value)}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${F.border}`, background: F.bg, color: F.text, fontSize: 15 }}
                            />
                          </div>
                          <div className="w-48">
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: F.textSoft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date / Year</label>
                            <div className="relative">
                              <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: F.textSoft }} />
                              <input
                                value={eventDate} onChange={e => setEventDate(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8, border: `1px solid ${F.border}`, background: F.bg, color: F.text, fontSize: 15 }}
                                placeholder="e.g. 1920, Year 43"
                              />
                            </div>
                          </div>
                          <div className="w-32">
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: F.textSoft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort Order</label>
                            <input
                              type="number"
                              value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${F.border}`, background: F.bg, color: F.text, fontSize: 15 }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: F.textSoft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                          <div className="relative">
                            <AlignLeft className="w-4 h-4 absolute left-3 top-3" style={{ color: F.textSoft }} />
                            <textarea
                              value={description} onChange={e => setDescription(e.target.value)}
                              style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8, border: `1px solid ${F.border}`, background: F.bg, color: F.text, fontSize: 14, minHeight: 120, resize: 'vertical' }}
                              placeholder="Describe the event and its impact on the world..."
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => setEditingId(null)}
                            style={{ padding: '8px 16px', background: 'transparent', color: F.textSoft, border: 'none', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(event.id)}
                            style={{ padding: '8px 16px', background: F.green, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Save Event
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-4">
                            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: F.text, margin: 0 }}>
                              {event.title}
                            </h3>
                            {event.event_date && (
                              <span style={{ background: F.greenLight, color: F.green, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock className="w-3.5 h-3.5" /> {event.event_date}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(event)}
                              style={{ background: F.bg, border: `1px solid ${F.border}`, color: F.textSoft, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(event.id)}
                              style={{ background: F.redLight, border: 'none', color: F.red, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p style={{ color: F.textSoft, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                          {event.description || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No description provided.</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {sortedEvents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: F.textSoft }}>
                <Clock className="w-12 h-12 mx-auto mb-4" style={{ opacity: 0.2 }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: F.text, marginBottom: 8 }}>No Timeline Events</h3>
                <p style={{ fontSize: 14 }}>Create your first verse-wide event to start building your universe timeline.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
