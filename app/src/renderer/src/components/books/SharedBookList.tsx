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
    <div className="px-1 mt-4">
      <div className="px-2 pb-1">
        <span className="text-[10px] uppercase tracking-widest text-surface-600 font-semibold flex items-center gap-1.5">
          <Cloud className="w-3 h-3" />
          Shared with me
        </span>
      </div>
      {books.map(book => (
        <div key={book.id} className="group relative">
          <div
            onClick={() => addToast('Cloud syncing is being developed...', 'info')}
            role="button"
            className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 rounded-md transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0 text-accent-500" />
            <span className="truncate flex-1 text-left">{book.title}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
