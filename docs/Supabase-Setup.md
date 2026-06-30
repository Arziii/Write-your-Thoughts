# Supabase Database Setup & Migration

To enable cloud sync and authentication, you must deploy the application's database schema to your Supabase project.

Copy the SQL blocks below and execute them in your Supabase SQL Editor.

## 1. Main Schema Migration

Run this script to create all necessary tables matching the local SQLite database.

```sql
CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

CREATE TABLE IF NOT EXISTS settings (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      theme TEXT DEFAULT 'dark',
      accent_color TEXT DEFAULT 'indigo',
      editor_font TEXT DEFAULT 'Georgia',
      font_size INT DEFAULT 16,
      line_spacing FLOAT DEFAULT 1.8,
      ai_provider TEXT DEFAULT 'openai',
      ai_api_key TEXT,
      ai_settings TEXT DEFAULT '{}',
      ai_style_prompt TEXT DEFAULT '',
      preserve_formatting INT DEFAULT 0,
      autosave_interval INT DEFAULT 3000,
      created_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE TABLE IF NOT EXISTS books (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author_name TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover_image TEXT,
      status TEXT DEFAULT 'writing',
      synced INT DEFAULT 0,
      cloud_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE TABLE IF NOT EXISTS chapters (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      word_count INT DEFAULT 0,
      chapter_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      cloud_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS chapter_versions (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      word_count INT DEFAULT 0,
      snapshot_type TEXT DEFAULT 'auto',
      milestone_name TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS workspace_state (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      current_book_id TEXT,
      current_chapter_id TEXT,
      cursor_position INT DEFAULT 0,
      scroll_position INT DEFAULT 0,
      open_tabs TEXT DEFAULT '[]',
      panel_state TEXT DEFAULT '{"sidebarOpen":true,"aiPanelOpen":true}',
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE TABLE IF NOT EXISTS characters (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      name TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      age TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      appearance TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      goals TEXT DEFAULT '',
      relationships TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      image_url TEXT,
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      culture TEXT DEFAULT '',
      history TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      image_url TEXT,
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS codex (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS wiki (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS timeline_events (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      event_date TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      notes TEXT DEFAULT '',
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS verse_timeline_events (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      event_date TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      notes TEXT DEFAULT '',
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      content TEXT NOT NULL,
      quote TEXT DEFAULT '',
      resolved INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS world_rules (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INT DEFAULT 0,
      synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS story_bibles (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      global_context TEXT DEFAULT '',
      themes TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS character_profiles (
      id UUID PRIMARY KEY,
      character_id TEXT NOT NULL UNIQUE,
      traits TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      motivations TEXT DEFAULT '',
      speech_style TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS location_profiles (
      id UUID PRIMARY KEY,
      location_id TEXT NOT NULL UNIQUE,
      geography TEXT DEFAULT '',
      history TEXT DEFAULT '',
      culture TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS organization_profiles (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      hierarchy TEXT DEFAULT '',
      goals TEXT DEFAULT '',
      relationships TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS lore_entries (
      id UUID PRIMARY KEY,
      codex_id TEXT NOT NULL UNIQUE,
      summary TEXT DEFAULT '',
      facts TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (codex_id) REFERENCES codex(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS character_voice_profiles (
      id UUID PRIMARY KEY,
      character_id TEXT NOT NULL UNIQUE,
      vocabulary TEXT DEFAULT '',
      sentence_length TEXT DEFAULT '',
      formality TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      mood TEXT DEFAULT '',
      emotional_state TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS speech_patterns (
      id UUID PRIMARY KEY,
      character_id TEXT NOT NULL,
      pattern_description TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS dialogue_samples (
      id UUID PRIMARY KEY,
      character_id TEXT NOT NULL,
      sample_text TEXT NOT NULL,
      context TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS chapter_emotions (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL UNIQUE,
      primary_emotion TEXT DEFAULT '',
      secondary_emotion TEXT DEFAULT '',
      intensity INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS scene_emotions (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      scene_description TEXT DEFAULT '',
      primary_emotion TEXT DEFAULT '',
      intensity INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS continuity_events (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      description TEXT NOT NULL,
      event_type TEXT DEFAULT 'General',
      entity_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS continuity_warnings (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      warning_description TEXT NOT NULL,
      severity TEXT DEFAULT 'Medium',
      resolved INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS style_profiles (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      sentence_length TEXT DEFAULT '',
      dialogue_ratio TEXT DEFAULT '',
      vocabulary TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      prose_density TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS chapter_metrics (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL UNIQUE,
      sentence_length TEXT DEFAULT '',
      dialogue_ratio TEXT DEFAULT '',
      vocabulary TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      prose_density TEXT DEFAULT '',
      warning TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS character_relationships (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      source_character_id TEXT NOT NULL,
      target_character_id TEXT NOT NULL,
      relationship_type TEXT DEFAULT 'Neutral',
      trust_level INT DEFAULT 5,
      affection_level INT DEFAULT 5,
      history TEXT DEFAULT '',
      current_state TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (source_character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (target_character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS relationship_events (
      id UUID PRIMARY KEY,
      relationship_id TEXT NOT NULL,
      chapter_id TEXT,
      event_description TEXT NOT NULL,
      impact_on_trust INT DEFAULT 0,
      impact_on_affection INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (relationship_id) REFERENCES character_relationships(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );

CREATE TABLE IF NOT EXISTS relationship_states (
      id UUID PRIMARY KEY,
      relationship_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      trust_level_at_chapter INT DEFAULT 5,
      affection_level_at_chapter INT DEFAULT 5,
      state_notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (relationship_id) REFERENCES character_relationships(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      UNIQUE(relationship_id, chapter_id)
    );

CREATE TABLE IF NOT EXISTS timeline_settings (
      book_id UUID PRIMARY KEY,
      start_date_string TEXT DEFAULT '',
      calendar_system TEXT DEFAULT 'gregorian',
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS timeline_events (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      story_day INT DEFAULT 1,
      chapter_id TEXT,
      characters_involved TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );

CREATE TABLE IF NOT EXISTS story_analysis (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      fatigue_warning TEXT DEFAULT '',
      repetition_warning TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS arc_analysis (
      id UUID PRIMARY KEY,
      character_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      arc_status TEXT DEFAULT '',
      emotional_change TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS pacing_analysis (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      pacing_status TEXT DEFAULT '',
      conflict_density TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS emotion_analysis (
      id UUID PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      emotional_flow_status TEXT DEFAULT '',
      warning TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS chapter_statistics (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL UNIQUE,
      repetition_warnings TEXT DEFAULT '',
      scene_density TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

ALTER TABLE settings ADD COLUMN ai_settings TEXT DEFAULT '{}';

ALTER TABLE settings ADD COLUMN ai_style_prompt TEXT DEFAULT '';

ALTER TABLE settings ADD COLUMN preserve_formatting INT DEFAULT 0;

ALTER TABLE books ADD COLUMN author_name TEXT DEFAULT '';

ALTER TABLE timeline_events ADD COLUMN story_day INT DEFAULT 1;

ALTER TABLE timeline_events ADD COLUMN chapter_id TEXT;

ALTER TABLE timeline_events ADD COLUMN characters_involved TEXT;

ALTER TABLE timeline_events ADD COLUMN duration_days INT DEFAULT 1;

ALTER TABLE ${table} ADD COLUMN sort_order INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS sync_queue (
      id UUID PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now()
    );

ALTER TABLE chapter_versions ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

ALTER TABLE chapter_versions ADD COLUMN word_count INT DEFAULT 0;

ALTER TABLE chapter_versions ADD COLUMN snapshot_type TEXT DEFAULT 'auto';

ALTER TABLE chapter_versions ADD COLUMN milestone_name TEXT;


```

## 2. Authentication & Security (Account Lockout Policy)

This script sets up the exponential backoff and account lockout tracking for the login flow.

```sql
-- Run this entire script in your Supabase SQL Editor

-- 1. Create the tracking table
CREATE TABLE IF NOT EXISTS public.login_attempts (
  email TEXT PRIMARY KEY,
  failed_attempts INT DEFAULT 0,
  lockout_until TIMESTAMPTZ,
  is_locked BOOLEAN DEFAULT FALSE
);

-- Allow everyone to execute the functions
GRANT ALL ON public.login_attempts TO anon, authenticated, service_role;

-- 2. Function to check if a login is currently allowed
CREATE OR REPLACE FUNCTION public.check_login_attempt(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_record public.login_attempts%ROWTYPE;
  current_time timestamptz := now();
  time_remaining int;
BEGIN
  SELECT * INTO attempt_record FROM public.login_attempts WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', true);
  END IF;

  IF attempt_record.is_locked THEN
    RETURN json_build_object('allowed', false, 'reason', 'locked');
  END IF;

  IF attempt_record.lockout_until IS NOT NULL AND attempt_record.lockout_until > current_time THEN
    time_remaining := EXTRACT(EPOCH FROM (attempt_record.lockout_until - current_time))::int;
    RETURN json_build_object('allowed', false, 'reason', 'delay', 'retry_after', time_remaining);
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$;

-- 3. Function to record a failed login attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_attempts int;
  lock_duration interval;
BEGIN
  INSERT INTO public.login_attempts (email, failed_attempts)
  VALUES (p_email, 1)
  ON CONFLICT (email) DO UPDATE 
  SET failed_attempts = public.login_attempts.failed_attempts + 1
  RETURNING failed_attempts INTO new_attempts;

  IF new_attempts = 4 THEN
    lock_duration := '5 seconds'::interval;
  ELSIF new_attempts = 5 THEN
    lock_duration := '30 seconds'::interval;
  ELSIF new_attempts = 6 THEN
    lock_duration := '5 minutes'::interval;
  ELSIF new_attempts >= 7 THEN
    UPDATE public.login_attempts 
    SET is_locked = true, lockout_until = NULL 
    WHERE email = p_email;
    RETURN;
  ELSE
    -- attempts 1, 2, 3 have no delay
    RETURN;
  END IF;

  UPDATE public.login_attempts 
  SET lockout_until = now() + lock_duration
  WHERE email = p_email;
END;
$$;

-- 4. Function to clear failures on successful login
CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE email = p_email;
END;
$$;

-- 5. Trigger to automatically unlock account when password is changed/reset
CREATE OR REPLACE FUNCTION public.handle_password_reset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.encrypted_password <> OLD.encrypted_password THEN
    DELETE FROM public.login_attempts WHERE email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_password_reset ON auth.users;
CREATE TRIGGER on_password_reset
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_password_reset();

```

## 3. Realtime Enablement

After running the migrations, ensure you go to **Database > Replication** in your Supabase dashboard and enable **Insert, Update, and Delete** replication for all the tables created above.
