import { AvatarConfig } from '../types/avatar.types'

export function generateAvatarFromSeed(seed: string): AvatarConfig {
  return { seed: seed || 'default' }
}
