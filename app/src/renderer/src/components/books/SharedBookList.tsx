import { useEffect, useState } from 'react'
import { Cloud, Download, Loader2 } from 'lucide-react'
import { syncService } from '../../services/syncService'
import { useToastStore } from '../../stores/toastStore'

export default function SharedBookList() {
  const [books, setBooks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { addToast } = useToastStore()

  useEffect(() => {
    loadBooks()
  }, [])

  const loadBooks = async () => {
    setIsLoading(true)
    const data = await syncService.getSharedBooks()
    setBooks(data)
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-surface-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-xs">Loading shared...</span>
      </div>
    )
  }

  if (books.length === 0) {
    return null
  }

  return (
    <div style={{ padding: '0 10px', marginTop: 16 }}>
      <div style={{ padding: '0 8px', paddingBottom: 4 }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8c77', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Cloud style={{ width: 12, height: 12 }} />
          Shared with me
        </span>
      </div>
      {books.map(book => (
        <div key={book.id} className="group relative">
          <div
            onClick={() => addToast('Cloud syncing is being developed...', 'info')}
            role="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '6px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: '#3d5c3a', cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e8e2d8'; (e.currentTarget as HTMLElement).style.color = '#1a2e18' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#3d5c3a' }}
          >
            <Download style={{ width: 14, height: 14, flexShrink: 0, color: '#2d5a27' }} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
