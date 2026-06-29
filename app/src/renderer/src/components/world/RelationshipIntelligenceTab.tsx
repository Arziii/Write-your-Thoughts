import { useState, useEffect, useMemo } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { Plus, Trash2, Save, Sparkles, RefreshCw, Network } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import RelationshipGraph from './RelationshipGraph'
import type { Relationship, RelationshipEvent } from '../../types'

interface Props {
  characterId: string // The SOURCE character
}

export default function RelationshipIntelligenceTab({ characterId }: Props) {
  const { 
    characterProfiles,
    relationships, setRelationships, addRelationship, removeRelationship,
    relationshipEvents, setRelationshipEvents, addRelationshipEvent, removeRelationshipEvent,
    storyBible
  } = useStoryBibleStore()
  const { addToast } = useToastStore()
  const { settings } = useUserStore()
  const { currentBook, characters } = useWorkspaceStore()
  const activeBookId = currentBook?.id

  const [localRelationships, setLocalRelationships] = useState<Relationship[]>([])
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showGraph, setShowGraph] = useState(false)

  // State for creating a new relationship manually
  const [newTargetId, setNewTargetId] = useState('')
  const [newType, setNewType] = useState('Friend')

  // Load all relationships for this source character
  useEffect(() => {
    async function loadData() {
      if (!characterId || !activeBookId) return
      try {
        const allRels = await window.api.relationships.getByBook(activeBookId)
        const myRels = allRels.filter((r: Relationship) => r.source_character_id === characterId)
        setLocalRelationships(myRels)
        
        if (myRels.length > 0) {
          setSelectedRelId(myRels[0].id)
        }

        // Fetch events for each relationship
        for (const rel of myRels) {
          const events = await window.api.relationshipEvents.getByRelationship(rel.id)
          setRelationshipEvents(rel.id, events)
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadData()
  }, [characterId, activeBookId])

  // Current selected relationship
  const currentRel = useMemo(() => localRelationships.find(r => r.id === selectedRelId), [localRelationships, selectedRelId])
  const targetCharacter = currentRel ? characters.find(c => c.id === currentRel.target_character_id) : null
  const currentEvents = currentRel ? (relationshipEvents[currentRel.id] || []) : []

  // Other available characters to form a relationship with
  const availableTargets = characters.filter(c => 
    c.id !== characterId && 
    !localRelationships.some(r => r.target_character_id === c.id)
  )

  const handleCreateRelationship = async () => {
    if (!newTargetId || !activeBookId) return
    try {
      const added = await window.api.relationships.upsert({
        book_id: activeBookId,
        source_character_id: characterId,
        target_character_id: newTargetId,
        relationship_type: newType,
        trust_level: 5,
        affection_level: 5,
        history: '',
        current_state: ''
      })
      const updatedList = [...localRelationships, added]
      setLocalRelationships(updatedList)
      addRelationship(characterId, added)
      setSelectedRelId(added.id)
      setNewTargetId('')
    } catch {
      addToast('Failed to create relationship', 'error')
    }
  }

  const handleDeleteRelationship = async (id: string) => {
    try {
      await window.api.relationships.delete(id)
      const updatedList = localRelationships.filter(r => r.id !== id)
      setLocalRelationships(updatedList)
      removeRelationship(characterId, id)
      if (selectedRelId === id) setSelectedRelId(updatedList[0]?.id || null)
    } catch {
      addToast('Failed to delete relationship', 'error')
    }
  }

  const handleRelChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!currentRel) return
    const updated = localRelationships.map(r => 
      r.id === currentRel.id ? { ...r, [e.target.name]: e.target.value } : r
    )
    setLocalRelationships(updated)
  }

  const handleSaveRelationship = async () => {
    if (!currentRel) return
    setIsSaving(true)
    try {
      const saved = await window.api.relationships.upsert(currentRel)
      addRelationship(characterId, saved)
      addToast('Relationship saved', 'success')
    } catch {
      addToast('Failed to save relationship', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAnalyzeWithAI = async () => {
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
      return
    }
    if (!currentRel || !targetCharacter) return

    // Use ALL chapters as the full story context
    const allContent = chapters
      .filter(c => c.content?.trim())
      .map(c => `--- Chapter: ${c.title} ---\n${c.content}`)
      .join('\n\n')

    if (!allContent) {
      addToast('No chapter content found in this book yet.', 'error')
      return
    }

    setIsAnalyzing(true)
    try {
      const sourceChar = characters.find(c => c.id === characterId)
      const result = await aiService.analyzeRelationshipDynamics({
        content: allContent,
        storyContext: storyBible?.premise,
        provider: settings.ai_provider as any,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings,
        sourceCharacterName: sourceChar?.name || 'Unknown',
        targetCharacterName: targetCharacter.name,
        currentType: currentRel.relationship_type,
        currentTrust: currentRel.trust_level,
        currentAffection: currentRel.affection_level,
        history: currentRel.history,
        currentState: currentRel.current_state
      })

      // Update relationship
      const updatedRel: Relationship = {
        ...currentRel,
        relationship_type: result.relationship_type || currentRel.relationship_type,
        trust_level: result.trust_level ?? currentRel.trust_level,
        affection_level: result.affection_level ?? currentRel.affection_level,
        history: result.history_update || currentRel.history,
        current_state: result.current_state_update || currentRel.current_state
      }

      const savedRel = await window.api.relationships.upsert(updatedRel)
      
      const newList = localRelationships.map(r => r.id === savedRel.id ? savedRel : r)
      setLocalRelationships(newList)
      addRelationship(characterId, savedRel)

      // Add new events (no chapter_id since analyzing the whole story)
      for (const ev of result.events || []) {
        const addedEv = await window.api.relationshipEvents.create({
          relationship_id: savedRel.id,
          chapter_id: null,
          event_description: ev.event_description,
          impact_on_trust: ev.impact_on_trust,
          impact_on_affection: ev.impact_on_affection
        })
        addRelationshipEvent(savedRel.id, addedEv)
      }

      // Record state snapshot
      await window.api.relationshipStates.upsert({
        relationship_id: savedRel.id,
        chapter_id: null,
        trust_level_at_chapter: updatedRel.trust_level,
        affection_level_at_chapter: updatedRel.affection_level,
        state_notes: result.current_state_update
      })

      addToast('Relationship analyzed from whole story!', 'success')
    } catch (e: any) {
      console.error(e)
      addToast(e.message || 'AI analysis failed.', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Target Selector */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-surface-400 mb-1">Select Target Character</label>
          <select
            value={selectedRelId || ''}
            onChange={(e) => setSelectedRelId(e.target.value)}
            className="w-full bg-surface-900 border border-surface-700 rounded-md p-2 text-sm text-surface-100 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
          >
            <option value="" disabled>Select a relationship...</option>
            {localRelationships.map(r => {
              const target = characters.find(c => c.id === r.target_character_id)
              return (
                <option key={r.id} value={r.id}>
                  Towards {target?.name || 'Unknown'} ({r.relationship_type})
                </option>
              )
            })}
          </select>
        </div>

        {/* Create New Rel UI inline for simplicity */}
        <div className="flex-1 flex gap-2">
          <select
            value={newTargetId}
            onChange={(e) => setNewTargetId(e.target.value)}
            className="w-full bg-surface-900 border border-surface-700 rounded-md p-2 text-sm text-surface-100 focus:border-accent-500"
          >
            <option value="">New Target...</option>
            {availableTargets.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-32 bg-surface-900 border border-surface-700 rounded-md p-2 text-sm text-surface-100 focus:border-accent-500"
          >
            <option>Family</option>
            <option>Friend</option>
            <option>Enemy</option>
            <option>Romance</option>
            <option>Rival</option>
            <option>Mentor</option>
            <option>Neutral</option>
          </select>
          <button
            onClick={handleCreateRelationship}
            disabled={!newTargetId}
            className="bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white px-3 py-2 rounded-md transition-colors"
            title="Create Relationship"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowGraph(true)}
            className="bg-surface-700 hover:bg-surface-600 text-surface-200 px-3 py-2 rounded-md transition-colors"
            title="View Global Relationship Map"
          >
            <Network className="w-4 h-4" />
          </button>
        </div>
      </div>

      {currentRel && (
        <>
          {/* AI Banner */}
          <div className="bg-accent-950/40 border border-accent-800/50 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent-300">AI Relationship Analysis</p>
              <p className="text-xs text-surface-400 mt-0.5">
                AI reads <span className="text-accent-400 font-semibold">your whole story</span> to analyze how feelings towards {targetCharacter?.name || 'them'} evolve.
              </p>
            </div>
            <button
              onClick={handleAnalyzeWithAI}
              disabled={isAnalyzing}
              className="flex-shrink-0 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAnalyzing ? 'Analyzing whole story...' : 'AI Analyze'}
            </button>
          </div>

          <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-surface-100">Dynamic Details</h3>
                <p className="text-sm text-surface-400">Directional relationship towards {targetCharacter?.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteRelationship(currentRel.id)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={handleSaveRelationship}
                  disabled={isSaving}
                  className="bg-surface-700 hover:bg-surface-600 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Relationship Type</label>
                <select
                  name="relationship_type"
                  value={currentRel.relationship_type}
                  onChange={handleRelChange}
                  className="w-full bg-surface-900 border border-surface-700 rounded-md p-2 text-sm text-surface-100 focus:border-accent-500"
                >
                  <option>Family</option>
                  <option>Friend</option>
                  <option>Enemy</option>
                  <option>Romance</option>
                  <option>Rival</option>
                  <option>Mentor</option>
                  <option>Neutral</option>
                </select>
              </div>
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                  <span>Trust Level</span>
                  <span className="text-accent-400">{currentRel.trust_level}/10</span>
                </label>
                <input
                  type="range" min="1" max="10" name="trust_level"
                  value={currentRel.trust_level}
                  onChange={handleRelChange}
                  className="w-full accent-accent-500"
                />
              </div>
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                  <span>Affection Level</span>
                  <span className="text-pink-400">{currentRel.affection_level}/10</span>
                </label>
                <input
                  type="range" min="1" max="10" name="affection_level"
                  value={currentRel.affection_level}
                  onChange={handleRelChange}
                  className="w-full accent-pink-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Current State</label>
                <textarea
                  name="current_state"
                  value={currentRel.current_state}
                  onChange={handleRelChange}
                  rows={2}
                  className="w-full bg-surface-900 border border-surface-700 rounded-md p-2 text-sm text-surface-100 placeholder-surface-500 focus:border-accent-500"
                  placeholder="How do they currently interact?"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Shared History</label>
                <textarea
                  name="history"
                  value={currentRel.history}
                  onChange={handleRelChange}
                  rows={3}
                  className="w-full bg-surface-900 border border-surface-700 rounded-md p-2 text-sm text-surface-100 placeholder-surface-500 focus:border-accent-500"
                  placeholder="Important past events between them..."
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
            <h3 className="text-sm font-bold text-surface-100 mb-4">Relationship Events</h3>
            {currentEvents.length === 0 ? (
              <p className="text-sm text-surface-500 italic">No events recorded. Use AI Analyze on a chapter to extract them automatically.</p>
            ) : (
              <div className="space-y-3">
                {currentEvents.map(ev => (
                  <div key={ev.id} className="bg-surface-900 border border-surface-700 rounded p-3 flex gap-4 items-center">
                    <div className="flex-1">
                      <p className="text-sm text-surface-100">{ev.event_description}</p>
                    </div>
                    <div className="flex gap-4 text-xs font-medium">
                      <span className={ev.impact_on_trust > 0 ? 'text-green-400' : ev.impact_on_trust < 0 ? 'text-red-400' : 'text-surface-400'}>
                        Trust {ev.impact_on_trust > 0 ? '+' : ''}{ev.impact_on_trust}
                      </span>
                      <span className={ev.impact_on_affection > 0 ? 'text-green-400' : ev.impact_on_affection < 0 ? 'text-red-400' : 'text-surface-400'}>
                        Affection {ev.impact_on_affection > 0 ? '+' : ''}{ev.impact_on_affection}
                      </span>
                    </div>
                    <button 
                      onClick={async () => {
                        await window.api.relationshipEvents.delete(ev.id)
                        removeRelationshipEvent(currentRel.id, ev.id)
                      }}
                      className="text-surface-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}


      {showGraph && activeBookId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
          <div className="bg-surface-800 rounded-xl border border-surface-700 shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-surface-700 bg-surface-900/50">
              <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                <Network className="w-5 h-5 text-accent-500" />
                Global Relationship Map
              </h2>
              <button 
                onClick={() => setShowGraph(false)}
                className="text-surface-400 hover:text-white px-3 py-1 rounded transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex-1 p-6 relative bg-surface-950 overflow-auto">
              <RelationshipGraph bookId={activeBookId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
