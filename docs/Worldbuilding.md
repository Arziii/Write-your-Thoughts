# Worldbuilding & Story Bible

A core feature of **Write Your Thoughts** is the integrated Story Bible, enabling authors to build complex lore directly alongside their manuscript.

## Overview
The worldbuilding tools are accessible from the Workspace Sidebar. They allow you to define structured metadata about your fictional universe. This data acts as the ultimate "Source of Truth" for both the author and the Story Intelligence AI system.

## Entities

### Characters
- **Purpose**: Track your cast.
- **Data Points**: Name, Nickname, Age, Appearance, Personality, Goals, Relationships.
- **AI Usage**: Used by the Continuity Engine to check if a character acts out of character or if dialogue doesn't match their historical personality.

### Locations
- **Purpose**: Map out your fictional world.
- **Data Points**: Name, Description, Culture, History, Notes.

### Organizations
- **Purpose**: Factions, guilds, governments, and secret societies.
- **Data Points**: Name, Leader, Goals, Alignments.

### World Rules / Magic Systems
- **Purpose**: Define the immutable physics or magical laws of your universe.
- **AI Usage**: Heavily referenced by the AI during Brainstorming to ensure suggested plot points do not violate established magic constraints.

### Timeline
- **Purpose**: Chronological tracking of story events.
- **Features**: Visual representation of events spanning specific days. The Timeline Analyzer can automatically read your chapter and suggest new Timeline Events based on the narrative.

### Codex / Wiki / Notes
- **Purpose**: Freeform documents for lore that doesn't fit into strict structured fields.

## Technical Implementation
All worldbuilding nodes are stored in the SQLite database and synced to Supabase. When an AI feature is invoked, a compressed JSON representation of these nodes is bundled into the system prompt to provide immediate context without requiring vector-database RAG lookups for small-to-medium-sized projects.
