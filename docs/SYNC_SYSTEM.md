## **SYNC_SYSTEM.md** 

## **Write Your Thoughts - Synchronization System** 

## **Philosophy** 

The application is offline-first. 

Users should be able to continue writing without internet. 

Synchronization occurs automatically. 

## **Flow** 

```
User
↓
SQLite Local Database
↓
Change Queue
↓
Sync Engine
↓
Supabase Cloud
```

## **Offline Mode** 

Available: 

- Writing 

- Editing 

- Autosave 

- Chapter management 

Unavailable: 

- AI features 

- Cloud backup 

1 

## **Queue System** 

Every change generates a queue item. 

Operations: 

- Create 

- Update • Delete 

Status: 

- Pending 

- Processing 

- Synced 

- Failed 

## **Conflict Resolution** 

Rule: 

Newest timestamp wins. 

Priority: 

1. Local draft 

2. Cloud data 

Never lose user writing. 

## **Workspace Recovery** 

Restore: 

- Open tabs 

- Cursor position 

- Scroll position 

- Active book 

- Active chapter 

2 

## **Sync Trigger** 

Automatic: 

- Internet restored 

- Application launch 

- Manual sync button 

## **Backup Strategy** 

Automatic cloud backup. 

Manual export available. 

No user data should ever be permanently lost. 

3 

