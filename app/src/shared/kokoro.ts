export const KOKORO_PASSAGE_LIMIT = 650

export interface KokoroVoice {
  id: string
  name: string
  language: string
  speaker: number
}

// Speaker order follows Sherpa-ONNX’s Kokoro v1.0 model.
const voiceGroups = [
  { language: 'en-US', prefix: 'af', start: 0, names: ['Alloy', 'Aoede', 'Bella', 'Heart', 'Jessica', 'Kore', 'Nicole', 'Nova', 'River', 'Sarah', 'Sky'] },
  { language: 'en-US', prefix: 'am', start: 11, names: ['Adam', 'Echo', 'Eric', 'Fenrir', 'Liam', 'Michael', 'Onyx', 'Puck', 'Santa'] },
  { language: 'en-GB', prefix: 'bf', start: 20, names: ['Alice', 'Emma', 'Isabella', 'Lily'] },
  { language: 'en-GB', prefix: 'bm', start: 24, names: ['Daniel', 'Fable', 'George', 'Lewis'] },
  { language: 'zh-CN', prefix: 'zf', start: 45, names: ['Xiaobei', 'Xiaoni', 'Xiaoxiao', 'Xiaoyi'] },
  { language: 'zh-CN', prefix: 'zm', start: 49, names: ['Yunjian', 'Yunxi', 'Yunxia', 'Yunyang'] },
]

export const KOKORO_VOICES: KokoroVoice[] = voiceGroups.flatMap(({ language, prefix, start, names }) => (
  names.map((name, index) => ({ id: `${prefix}_${name.toLowerCase()}`, name, language, speaker: start + index }))
))

export interface KokoroSpeechRequest {
  id: string
  voiceId: string
  text: string
  speed?: number
  storytellingPacing?: boolean
}
