# Database Schema & Authentication

**Write Your Thoughts** utilizes a hybrid dual-database architecture: a local SQLite database for offline-first performance, and a remote Supabase PostgreSQL database for synchronization and auth.

## Authentication System

We use **Supabase Auth** as our identity provider.

### Features
- **Email/Password Login**: Primary authentication method.
- **Deep Linking for Resets**: Password resets trigger `wyt://auth/reset-password` deep links that route natively back to the desktop application.
- **Session Persistence**: Sessions remain active between app launches using secure local storage.
- **Automatic Hydration**: On a fresh sign-in, the system automatically pulls the latest cloud backup to hydrate the local SQLite database.
- **Social Logins**: Infrastructure supports Google, GitHub, and Microsoft (WIP).

### Security Model
Every user owns their own workspace. Row Level Security (RLS) policies enforce strict isolation in the Supabase PostgreSQL instance: users can never access data belonging to another UUID.

---

## Entity Relationship Overview

```text
User
│
├── Books
│     │
│     ├── Chapters ───────┐
│     │                   │
│     ├── Characters      │
│     ├── Locations       ├──> Associated with specific Book IDs
│     ├── Organizations   │
│     ├── Timeline Events │
│     ├── World Rules     │
│     └── Notes ──────────┘
│
└── Settings
```

## Schema Definitions

*(These tables exist identically in both SQLite locally and PostgreSQL remotely).*

### `users`
Stores account and profile information.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key (from Supabase Auth) |
| `email` | String | User's email |
| `display_name` | String | Used for UI greeting |
| `avatar_url` | String | Cloud URL to profile picture |
| `updated_at` | Timestamp | Last modified |

### `settings`
User-specific application preferences.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `user_id` | UUID | Foreign Key |
| `theme` | String | 'dark' or 'light' |
| `ai_provider` | String | openai, gemini, claude |
| `ai_api_key` | String | Securely stored key |

### `books`
Projects or manuscripts.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `user_id` | UUID | Foreign Key |
| `title` | String | Project Title |
| `description` | Text | Synopsis |
| `cover_image` | String | Cloud URL to cover art |

### `chapters`
Individual chapter files for modular editing.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `book_id` | UUID | Foreign Key |
| `title` | String | Chapter Title |
| `content` | Text | HTML string of the Tiptap editor |
| `chapter_order` | Number | Sort integer |
| `updated_at` | Timestamp | Critical for sync conflict resolution |

### `chapter_versions`
Local snapshots and remote milestones.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `chapter_id` | UUID | Foreign Key |
| `content` | Text | HTML string |
| `snapshot_type` | String | 'auto' (15 min) or 'milestone' |
| `milestone_name`| String | Optional user-defined name |

### Worldbuilding Entities
The database includes multiple tables for world lore. They all follow a similar schema structure (`id`, `book_id`, `name`, `description`, `notes`):
- `characters`
- `locations`
- `organizations`
- `world_rules`
- `timeline_events` (includes `story_day` and `duration_days`)
