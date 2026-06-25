import { useState } from 'react'
import { FileText, FileDown, BookType, Download, Loader2 } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import Modal from '../ui/Modal'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  bookId: string
  bookTitle: string
  initialAuthorName: string
}

type ExportFormat = 'pdf' | 'docx' | 'epub' | 'md'

export default function ExportModal({ isOpen, onClose, bookId, bookTitle, initialAuthorName }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [authorName, setAuthorName] = useState(initialAuthorName)
  const [isExporting, setIsExporting] = useState(false)
  const { addToast } = useToastStore()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await window.api.export.book(bookId, format, authorName)
      if (result.canceled) {
        // User canceled save dialog
      } else if (result.success) {
        addToast(`Successfully exported to ${format.toUpperCase()}`, 'success')
        onClose()
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      addToast(`Export failed: ${err.message || 'Unknown error'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Export "${bookTitle}"`}>
      <div className="space-y-4">
        <p className="text-sm text-surface-300">
          Customize the author name and choose a format to export your manuscript.
        </p>

        <div className="space-y-1.5 mt-4">
          <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Author Name</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="e.g. Jane Doe"
            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-accent-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => setFormat('pdf')}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded-xl transition-all",
              format === 'pdf' ? "bg-accent-900/40 border-accent-500 text-accent-100" : "bg-surface-800 border-surface-700 text-surface-400 hover:bg-surface-700 hover:text-surface-200"
            )}
          >
            <FileText className="w-8 h-8 mb-2" />
            <span className="font-semibold text-sm">PDF Document</span>
            <span className="text-xs opacity-70 mt-1">Print-ready manuscript</span>
          </button>

          <button
            onClick={() => setFormat('docx')}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded-xl transition-all",
              format === 'docx' ? "bg-accent-900/40 border-accent-500 text-accent-100" : "bg-surface-800 border-surface-700 text-surface-400 hover:bg-surface-700 hover:text-surface-200"
            )}
          >
            <FileDown className="w-8 h-8 mb-2" />
            <span className="font-semibold text-sm">Word (DOCX)</span>
            <span className="text-xs opacity-70 mt-1">Standard editing format</span>
          </button>

          <button
            onClick={() => setFormat('epub')}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded-xl transition-all",
              format === 'epub' ? "bg-accent-900/40 border-accent-500 text-accent-100" : "bg-surface-800 border-surface-700 text-surface-400 hover:bg-surface-700 hover:text-surface-200"
            )}
          >
            <BookType className="w-8 h-8 mb-2" />
            <span className="font-semibold text-sm">EPUB eBook</span>
            <span className="text-xs opacity-70 mt-1">For digital readers</span>
          </button>

          <button
            onClick={() => setFormat('md')}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded-xl transition-all",
              format === 'md' ? "bg-accent-900/40 border-accent-500 text-accent-100" : "bg-surface-800 border-surface-700 text-surface-400 hover:bg-surface-700 hover:text-surface-200"
            )}
          >
            <FileText className="w-8 h-8 mb-2" />
            <span className="font-semibold text-sm">Markdown</span>
            <span className="text-xs opacity-70 mt-1">Plain text with styling</span>
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-800 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
        </div>
      </div>
    </Modal>
  )
}
