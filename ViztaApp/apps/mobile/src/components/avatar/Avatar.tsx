import React, { useMemo } from 'react'
import { View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { createAvatar } from '@dicebear/core'
import * as notionists from '@dicebear/notionists'
import { AvatarProps } from '../../types/avatar.types'

const BG_COLORS = ['b6e3f4', 'c0aede', 'ffd5dc', 'ffdfbf', 'd1d4f9', 'c1f4c5']

function buildAvatarSvg(
  seed: string,
  hair?: string,
  eyes?: string,
  brows?: string,
  nose?: string,
  lips?: string,
  body?: string,
  glasses?: string | null,
  beard?: string | null,
): string {
  const opts: Record<string, unknown> = {
    seed,
    backgroundColor: BG_COLORS,
  }

  if (hair !== undefined) opts.hair = [hair]
  if (eyes !== undefined) opts.eyes = [eyes]
  if (brows !== undefined) opts.brows = [brows]
  if (nose !== undefined) opts.nose = [nose]
  if (lips !== undefined) opts.lips = [lips]
  if (body !== undefined) opts.body = [body]

  if (glasses === null) {
    opts.glassesProbability = 0
  } else if (glasses !== undefined) {
    opts.glasses = [glasses]
    opts.glassesProbability = 100
  }

  if (beard === null) {
    opts.beardProbability = 0
  } else if (beard !== undefined) {
    opts.beard = [beard]
    opts.beardProbability = 100
  }

  return createAvatar(notionists, opts).toString()
}

const Avatar = React.memo(function Avatar({
  seed,
  config,
  size = 40,
  showBorder = false,
}: AvatarProps) {
  const avatarSeed = config?.seed ?? seed ?? 'default'

  const svgXml = useMemo(() => {
    return buildAvatarSvg(
      avatarSeed,
      config?.hair,
      config?.eyes,
      config?.brows,
      config?.nose,
      config?.lips,
      config?.body,
      config?.glasses,
      config?.beard,
    )
  }, [
    avatarSeed,
    config?.hair,
    config?.eyes,
    config?.brows,
    config?.nose,
    config?.lips,
    config?.body,
    config?.glasses,
    config?.beard,
  ])

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      ...(showBorder && { borderWidth: 1.5, borderColor: '#2563EB' }),
    }}>
      <SvgXml xml={svgXml} width={size} height={size} />
    </View>
  )
})

export default Avatar
