## **Write Your Thoughts - Architecture** 

## **Architecture Philosophy** 

The system is designed around the following principles: 

- Desktop-first experience. 

- Cloud synchronization. 

- Offline writing capability. 

- AI as an editor, not a replacement author. 

- Modular architecture. 

- Future-proof AI memory system. 

- User retains complete control. 

## **High-Level Architecture** 

```
┌────────────────────┐
│ Desktop Application│
│    Electron App    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ React Frontend     │
│ (UI Layer)         │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Application Layer  │
│ Services & Logic   │
└─────────┬──────────┘
          │
          ├────────────────────┐
          │                    │
          ▼                    ▼
┌───────────────────┐   ┌──────────────────┐
│ SQLite Local DB   │   │ AI Service Layer │
└───────────────────┘   └──────────────────┘
          │                    │
          │                    ▼
          │            OpenAI / Gemini / Claude
```

1 

```
          │
          ▼
┌────────────────────┐
│ Sync Engine        │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Supabase Backend   │
└────────────────────┘
```

## **Recommended Stack** 

## **Desktop** 

Electron 

Purpose: 

- Windows application 

- Cross-platform possibility in future 

## **Frontend** 

React + TypeScript 

Purpose: 

- Maintainability 

- AI agent friendly 

- Large ecosystem 

## **Styling** 

TailwindCSS 

Purpose: 

- Rapid development 

- Consistent design 

2 

## **Components** 

Shadcn UI 

Purpose: 

- Modern interface 

- Reusable components 

## **Editor** 

TipTap 

Purpose: 

- Rich text editing 

- Word-like experience 

- Future AI integration • Extensible 

## **Local Database** 

SQLite 

Purpose: 

- Offline support 

- Fast access 

- Local caching 

## **Cloud Backend** 

Supabase 

Provides: 

- Authentication 

- PostgreSQL database 

- File storage 

- Synchronization 

- User accounts 

3 

## **Project Structure** 

```
src
├── app
│
├── components
│
├── pages
│
├── layouts
│
├── features
│
│     ├── auth
│     ├── workspace
│     ├── books
│     ├── chapters
│     ├── editor
│     ├── ai
│     ├── memory
│     ├── notes
│     ├── timeline
│     ├── characters
│     ├── locations
│     ├── settings
│     └── search
│
├── services
│
├── database
│
├── hooks
│
├── stores
│
├── utils
│
└── types
```

4 

## **Service Layer** 

The UI should never directly talk to databases or AI. 

Everything passes through services. 

```
UI
↓
Services
↓
Database / AI / Sync
```

## **Services** 

## **Auth Service** 

Responsibilities: 

- Login 

- Register 

- Session management 

## **Book Service** 

Responsibilities: 

- Create books 

- Delete books 

- Update metadata 

## **Chapter Service** 

Responsibilities: 

- Create chapters 

- Save chapters 

- Load chapters 

5 

## **Editor Service** 

Responsibilities: 

- Autosave 

- Session restore 

- Version management 

## **AI Service** 

Responsibilities: 

- Grammar polish 

- Rewrite 

- Brainstorming 

## **Memory Service** 

Responsibilities: 

- Formatting memory 

- Writing preferences 

- Story memory 

## **Sync Service** 

Responsibilities: 

- Local ↔ Cloud synchronization 

## **Database Architecture** 

Two layers: 

## **Local Layer** 

SQLite 

6 

Stores: 

- Books 

- Chapters 

- Notes 

- Drafts 

- Workspace state 

Purpose: 

Offline functionality. 

## **Cloud Layer** 

Supabase 

Stores: 

- User accounts 

- Projects 

- AI memory • Backups 

- Versions 

Purpose: 

Cross-device synchronization. 

## **AI Architecture** 

```
Editor
↓
AI Service
↓
Context Builder
↓
Memory System
↓
Provider Layer
↓
OpenAI / Gemini / Claude
```

7 

## **Provider Layer** 

Must support: 

- OpenAI 

- Gemini 

- Claude 

Switching providers should require no changes to UI. 

## **Memory Architecture** 

Three levels. 

## **Global Memory** 

User-wide preferences. 

Examples: 

- Writing style 

- Formatting style 

- Favorite tones 

## **Book Memory** 

Book-specific. 

Examples: 

- Characters 

- Lore 

- Relationships 

- Genre 

## **Chapter Memory** 

Current chapter context. 

8 

Examples: 

- Recent events 

- Dialogue style 

## **Version System** 

Never overwrite files. 

```
Chapter_01
v1 Original
v2 AI Polish
v3 Manual Edit
v4 Revised
```

Everything is recoverable. 

## **Autosave** 

Save every few seconds. 

Triggers: 

- Typing 

- Window close 

- App minimize 

## **Session Recovery** 

Restore: 

- Open project 

- Open chapter 

- Cursor position 

- Scroll position 

9 

Similar to VS Code. 

- Open tabs 

## **Sync Engine** 

Flow: 

```
SQLite
↓
Change Queue
↓
Sync Engine
↓
Supabase
```

Offline changes are queued and synchronized automatically when internet becomes available. 

## **File Storage** 

Cloud: 

Supabase Storage 

Stores: 

- Images • Covers • Attachments 

- Exports 

## **Search Architecture** 

Global search should index: 

- Books 

- Chapters 

- Notes 

- Characters 

- Locations 

10 

- Timeline 

## **State Management** 

Use Zustand. 

Stores: 

- User 

- Workspace 

- Current project 

- Current chapter 

- Editor state 

- Settings 

## **Security** 

Authentication: 

Supabase Auth 

Data isolation: 

Every user owns their own workspace. 

## **Export System** 

Supported formats: 

- DOCX 

- PDF 

- Markdown 

- TXT • EPUB 

## **Future Expansion** 

Plugin System 

11 

Possible plugins: 

- Grammarly 

- DeepL 

- Translation 

- Image generation 

- Voice narration 

## **Scalability** 

Current: 

Single user. 

Future: 

- Teams 

- Collaboration 

- Shared books 

- Comments 

- Real-time editing 

## **Design Principle** 

Write Your Thoughts should feel like: 

Microsoft Word 

+ 

Campfire 

+ 

Scrivener 

+ 

Grammarly 

+ 

12 

An AI editor that quietly learns the writer's style without taking away authorship. 

13 

