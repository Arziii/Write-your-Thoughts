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

We also enforce a strict **Exponential Backoff and Account Lockout** policy for logins using Supabase RPC functions (`check_login_attempt`, `record_failed_login`):
- 1-3 failed attempts: No delay.
- 4th failed attempt: 5-second delay.
- 5th failed attempt: 30-second delay.
- 6th failed attempt: 5-minute delay.
- 7th failed attempt: Permanent lockout.
The only way to unlock an account is by successfully resetting the password via the "Forgot Password" email flow. After a successful password reset, the user is redirected to manually sign in with their new credentials.

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
| `synced` | Integer | (0/1) Local sync status flag |

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
| `synced` | Integer | (0/1) Local sync status flag |

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

### `sync_queue` (Local Only)
Tracks pending offline modifications waiting to be pushed to Supabase.
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `entity_type` | String | e.g. 'book', 'chapter', 'character' |
| `entity_id` | UUID | ID of the mutated record |
| `operation` | String | 'create', 'update', 'delete', 'upsert' |
| `status` | String | 'pending', 'processing', 'completed' |
| `created_at` | Timestamp | Queue insertion time |

### `login_attempts` (Cloud Only)
Tracks failed login attempts for security lockouts.
| Field | Type | Description |
|---|---|---|
| `email` | String | Primary Key |
| `failed_attempts` | Integer | Counter |
| `lockout_until` | Timestamp | Time when lockout expires |
| `is_locked` | Boolean | True if permanently locked |
