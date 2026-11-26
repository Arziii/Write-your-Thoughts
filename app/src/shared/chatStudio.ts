export const DEFAULT_IMAGE_SERVER = 'http://127.0.0.1:8188'
export const SDXL_BASE_CHECKPOINT = 'sd_xl_base_1.0.safetensors'
export const MAX_IMAGE_PROMPT_LENGTH = 2000

export type ImageShape = 'square' | 'landscape' | 'portrait'

export interface StudioImageRequest {
  server: string
  checkpoint: string
  prompt: string
  shape: ImageShape
}
