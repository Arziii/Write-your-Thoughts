## **DATABASE_SCHEMA.md** 

## **Write Your Thoughts - Database Schema** 

## **Database Philosophy** 

The database should support: 

- Offline-first writing. 

- Cloud synchronization. 

- AI memory. 

- Version history. 

- Future collaboration. 

- Scalability. 

## **Entity Relationship Overview** 

```
User
│
├── Books
│     │
│     ├── Chapters
│     │       └── Chapter Versions
│     │
│     ├── Characters
│     ├── Locations
│     ├── Timeline Events
│     ├── Notes
│     ├── Writing Styles
│     └── AI Memories
│
└── Settings
```

## **users** 

Stores account information. 

1 

|Field|Type|
|---|---|
|id|UUID|
|email|String|
|username|String|
|display_name|String|
|avatar_url|String|
|created_at|Timestamp|
|updated_at|Timestamp|



## **settings** 

User preferences. 

|Field|Type|
|---|---|
|id|UUID|
|user_id|UUID|
|theme|String|
|accent_color|String|
|editor_font|String|
|font_size|Number|
|line_spacing|Number|
|ai_provider|String|
|autosave_interval|Number|
|created_at|Timestamp|



## **books** 

Books/projects. 

2 

|Field|Type|
|---|---|
|id|UUID|
|user_id|UUID|
|title|String|
|genre|String|
|description|Text|
|cover_image|String|
|status|String|
|created_at|Timestamp|
|updated_at|Timestamp|



Status: 

- Planning • Writing • Completed • Archived 

## **chapters** 

Individual chapter files. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|title|String|
|content|Rich Text|
|word_count|Number|
|chapter_order|Number|
|created_at|Timestamp|
|updated_at|Timestamp|



3 

## **chapter_versions** 

Version history. 

|Field|Type|
|---|---|
|id|UUID|
|chapter_id|UUID|
|version_number|Number|
|content|Rich Text|
|source|String|
|created_at|Timestamp|



Source: 

• Manual • AI Polish • Rewrite • Restore 

## **characters** 

Character database. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|name|String|
|nickname|String|
|age|String|
|appearance|Text|
|personality|Text|
|goals|Text|
|relationships|Text|



4 

|Field|Type|
|---|---|
|notes|Text|
|image_url|String|



## **locations** 

World locations. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|name|String|
|description|Text|
|culture|Text|
|history|Text|
|notes|Text|



## **timeline_events** 

Chronological events. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|title|String|
|description|Text|
|event_order|Number|
|created_at|Timestamp|



5 

## **notes** 

Free-form notes. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|title|String|
|content|Rich Text|
|created_at|Timestamp|



## **writing_styles** 

Formatting and style preferences. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|perspective|String|
|tense|String|
|tone|String|
|dialogue_style|Text|
|formatting_rules|Text|
|editing_rules|Text|



Examples: 

- Preserve dialogue. • Avoid adverbs. • Show, don't tell. 

6 

## **ai_memories** 

Long-term AI memory. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|category|String|
|content|Text|
|importance|Number|
|created_at|Timestamp|



Categories: 

- Formatting 

- Character 

- Lore • Style • Preference 

## **ai_conversations** 

Stores AI chat history. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|role|String|
|message|Text|
|created_at|Timestamp|



Role: 

• User • Assistant 

7 

## **exports** 

Export history. 

|Field|Type|
|---|---|
|id|UUID|
|book_id|UUID|
|format|String|
|path|String|
|created_at|Timestamp|



Formats: 

- DOCX • PDF 

- Markdown • TXT • EPUB 

## **workspace_state** 

Session recovery. 

|Field|Type|
|---|---|
|id|UUID|
|user_id|UUID|
|current_book|UUID|
|current_chapter|UUID|
|cursor_position|Number|
|scroll_position|Number|
|open_tabs|JSON|
|panel_state|JSON|
|updated_at|Timestamp|



8 

## **sync_queue** 

Offline synchronization. 

|Field|Type|
|---|---|
|id|UUID|
|entity_type|String|
|entity_id|UUID|
|operation|String|
|status|String|
|created_at|Timestamp|



Operations: 

• Create • Update • Delete 

Status: 

• Pending • Synced 

## **Future Tables** 

Reserved for future versions: 

## **collaborators** 

Real-time collaboration. 

## **comments** 

Chapter comments. 

## **tags** 

Custom tagging system. 

9 

## **templates** 

Writing templates. 

## **plugins** 

Third-party plugin support. 

## **Database Principles** 

1. Never overwrite original work. 

2. Every important change should be recoverable. 

3. AI memory should be independent from chapter data. 

4. Offline mode should always work. 

5. Synchronization should be automatic. 

6. Support future scalability. 

10 

