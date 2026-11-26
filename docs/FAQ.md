# Frequently asked questions

### Can I work offline?

A cached desktop account can reopen local books and draft or edit without a connection. Initial sign-in, cloud sync, and the current portrait upload workflow require Supabase. Read [Data and sync](modules/DATA_AND_SYNC.md) for coverage.

### Will a cloud backup restore my entire atlas?

A SQLite snapshot can include map titles and pins. Imported artwork and drawn layers are separate from the database. See [Database](Database.md#boundaries-outside-sqlite).

### What data goes to AI?

The selected workflow and provider determine the inputs. The editor may send a selection, chapter passages, or story context. Local AI uses the loopback service you configure. See [AI and Story Intelligence](modules/AI_AND_STORY_INTELLIGENCE.md).

### Can I co-edit a book?

Publishing, shared lookup and chapter-lock code is present. Live simultaneous editing has no verified workflow. See [Features](FEATURES.md).

### Where is the database?

Look for `database/write-your-thoughts.db` under the Electron application's `userData` directory. See [Database](Database.md).
