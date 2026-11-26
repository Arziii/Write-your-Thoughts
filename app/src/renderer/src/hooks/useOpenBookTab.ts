import { useLocation, useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { TabType } from '../types'

export function useOpenBookTab() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (id: string, type: TabType, title: string) => {
    const { currentBook, openTab } = useWorkspaceStore.getState()
    if (!currentBook) return

    openTab(id, type, title)
    const bookPath = `/book/${currentBook.id}`
    if (pathname !== bookPath) navigate(bookPath)
  }
}
