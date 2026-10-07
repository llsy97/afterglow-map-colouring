import type { Level } from '../types'

/** Quick-record cycle 0→1→2→3→4→0, based on what is shown (trips act as a floor). */
export function nextQuickLevel(current: Level): Level {
  return current >= 4 ? 0 : ((current + 1) as Level)
}
