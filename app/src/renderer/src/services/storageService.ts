import { supabase } from './supabase'

/**
 * Uploads a file (as a base64 data URL or raw File) to the Supabase `images` bucket.
 * Files are stored under the user's own folder: images/<userId>/<type>/<entityId>
 * Returns the public URL of the uploaded image, or throws on failure.
 */
export async function uploadImage(
  file: File,
  type: 'books' | 'characters' | 'locations',
  entityId: string
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userData.user.id}/${type}/${entityId}.${ext}`

  const { error } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from('images').getPublicUrl(path)
  // Add a cache-buster so the browser always shows the fresh image
  return `${data.publicUrl}?t=${Date.now()}`
}

/**
 * Deletes an image from the Supabase `images` bucket by its public URL.
 * Silently ignores errors if the file doesn't exist.
 */
export async function deleteImage(
  type: 'books' | 'characters' | 'locations',
  entityId: string,
  ext: string = 'jpg'
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  // Try deleting all common extensions since we don't know which one was used
  const paths = ext !== 'unknown'
    ? [`${userData.user.id}/${type}/${entityId}.${ext}`]
    : extensions.map(e => `${userData.user!.id}/${type}/${entityId}.${e}`)

  await supabase.storage.from('images').remove(paths)
}

/**
 * Checks whether a URL is a remote Supabase Storage URL.
 */
export function isSupabaseUrl(url: string): boolean {
  return url.startsWith('https://') && url.includes('supabase')
}
