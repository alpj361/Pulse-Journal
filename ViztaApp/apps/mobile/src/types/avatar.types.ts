export interface AvatarConfig {
  seed: string
  hair?: string
  eyes?: string
  brows?: string
  nose?: string
  lips?: string
  body?: string
  glasses?: string | null   // undefined=auto by seed, null=force none, string=force variant
  beard?: string | null     // undefined=auto by seed, null=force none, string=force variant
}

export interface AvatarProps {
  seed?: string
  config?: AvatarConfig | null
  size?: number
  showBorder?: boolean
}
