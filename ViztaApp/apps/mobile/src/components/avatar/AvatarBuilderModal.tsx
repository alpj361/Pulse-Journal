import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import { X } from 'lucide-react-native'
import { createAvatar } from '@dicebear/core'
import * as notionists from '@dicebear/notionists'
import { AvatarConfig } from '../../types/avatar.types'
import Avatar from './Avatar'

export interface AvatarBuilderModalProps {
  visible: boolean
  onClose: () => void
  onSave: (config: AvatarConfig) => void
  initialConfig?: AvatarConfig | null
  seed?: string
}

// ─── Option lists ────────────────────────────────────────────────────────────

function variants(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`)
}

const HAIR_OPTIONS = [...variants(63), 'hat']
const EYES_OPTIONS = variants(5)
const BROWS_OPTIONS = variants(13)
const NOSE_OPTIONS = variants(20)
const LIPS_OPTIONS = variants(30)
const BODY_OPTIONS = variants(25)
const GLASSES_OPTIONS = ['none', ...variants(11)]
const BEARD_OPTIONS = ['none', ...variants(12)]

type ConfigKey = 'hair' | 'eyes' | 'brows' | 'nose' | 'lips' | 'body' | 'glasses' | 'beard'

interface Category {
  key: ConfigKey
  label: string
  options: string[]
  optional: boolean
}

const CATEGORIES: Category[] = [
  { key: 'hair', label: 'Pelo', options: HAIR_OPTIONS, optional: false },
  { key: 'eyes', label: 'Ojos', options: EYES_OPTIONS, optional: false },
  { key: 'brows', label: 'Cejas', options: BROWS_OPTIONS, optional: false },
  { key: 'nose', label: 'Nariz', options: NOSE_OPTIONS, optional: false },
  { key: 'lips', label: 'Labios', options: LIPS_OPTIONS, optional: false },
  { key: 'body', label: 'Cuerpo', options: BODY_OPTIONS, optional: false },
  { key: 'glasses', label: 'Anteojos', options: GLASSES_OPTIONS, optional: true },
  { key: 'beard', label: 'Barba', options: BEARD_OPTIONS, optional: true },
]

// ─── SVG thumbnail cache (module-level) ─────────────────────────────────────

const BG_COLORS = ['b6e3f4', 'c0aede', 'ffd5dc', 'ffdfbf', 'd1d4f9', 'c1f4c5']
const thumbCache = new Map<string, string>()

function getThumbSvg(seed: string, category: ConfigKey, option: string): string {
  const key = `${seed}|${category}|${option}`
  if (thumbCache.has(key)) return thumbCache.get(key)!

  const opts: Record<string, unknown> = {
    seed,
    backgroundColor: BG_COLORS,
  }

  if (option === 'none') {
    if (category === 'glasses') opts.glassesProbability = 0
    if (category === 'beard') opts.beardProbability = 0
  } else {
    if (category === 'glasses') {
      opts.glasses = [option]
      opts.glassesProbability = 100
    } else if (category === 'beard') {
      opts.beard = [option]
      opts.beardProbability = 100
    } else {
      opts[category] = [option]
    }
  }

  const svg = createAvatar(notionists, opts).toString()
  thumbCache.set(key, svg)
  return svg
}

// ─── AvatarThumb ─────────────────────────────────────────────────────────────

interface AvatarThumbProps {
  seed: string
  category: ConfigKey
  option: string
  isSelected: boolean
  onPress: () => void
}

const THUMB_CELL = 76
const THUMB_AVATAR = 66

const AvatarThumb = React.memo(function AvatarThumb({
  seed,
  category,
  option,
  isSelected,
  onPress,
}: AvatarThumbProps) {
  const svg = useMemo(() => getThumbSvg(seed, category, option), [seed, category, option])

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        width: THUMB_CELL,
        height: THUMB_CELL,
        borderRadius: 14,
        borderWidth: isSelected ? 2.5 : 1,
        borderColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)',
        backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginRight: 8,
      }}
    >
      {option === 'none' ? (
        <View style={{ width: THUMB_AVATAR, height: THUMB_AVATAR, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: isSelected ? '#6366f1' : 'rgba(255,255,255,0.25)' }}>✕</Text>
        </View>
      ) : (
        <SvgXml xml={svg} width={THUMB_AVATAR} height={THUMB_AVATAR} />
      )}
    </TouchableOpacity>
  )
})

// ─── AvatarBuilderModal ───────────────────────────────────────────────────────

export default function AvatarBuilderModal({
  visible,
  onClose,
  onSave,
  initialConfig,
  seed,
}: AvatarBuilderModalProps) {
  const insets = useSafeAreaInsets()

  const baseSeed = seed ?? 'default'

  const [draft, setDraft] = useState<AvatarConfig>({
    seed: baseSeed,
    ...(initialConfig ?? {}),
  })
  const [activeCategory, setActiveCategory] = useState<ConfigKey>('hair')

  // Reset draft when modal opens
  useEffect(() => {
    if (visible) {
      setDraft({ seed: baseSeed, ...(initialConfig ?? {}) })
      setActiveCategory('hair')
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((option: string) => {
    setDraft(prev => ({
      ...prev,
      [activeCategory]: option === 'none' ? null : option,
    } as AvatarConfig))
  }, [activeCategory])

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  const activeCategoryOptions = CATEGORIES.find(c => c.key === activeCategory)?.options ?? []
  const currentValue: string | null | undefined = draft[activeCategory]

  const renderThumb = useCallback(({ item }: { item: string }) => {
    const isSelected = item === 'none' ? currentValue === null : currentValue === item
    return (
      <AvatarThumb
        seed={baseSeed}
        category={activeCategory}
        option={item}
        isSelected={isSelected}
        onPress={() => handleSelect(item)}
      />
    )
  }, [baseSeed, activeCategory, currentValue, handleSelect])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={{
          backgroundColor: '#0b0d22',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: 'rgba(99,102,241,0.2)',
          paddingBottom: insets.bottom + 20,
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 10,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
          }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>Tu Avatar</Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={17} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Live preview */}
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Avatar config={draft} size={96} showBorder={false} />
          </View>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}
            style={{ maxHeight: 44, marginBottom: 12 }}
          >
            {CATEGORIES.map(cat => {
              const isActive = cat.key === activeCategory
              const hasValue = draft[cat.key] !== undefined
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#6366f1' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: isActive ? '#6366f1' : 'rgba(255,255,255,0.1)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {!isActive && hasValue && (
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: '#6366f1',
                    }} />
                  )}
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isActive
                      ? '#fff'
                      : hasValue
                        ? '#a5b4fc'
                        : 'rgba(255,255,255,0.4)',
                  }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Option thumbnails */}
          <FlatList
            key={activeCategory}
            data={activeCategoryOptions}
            renderItem={renderThumb}
            keyExtractor={item => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={3}
            style={{ height: THUMB_CELL + 8 }}
          />

          {/* Save button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <TouchableOpacity
              onPress={handleSave}
              style={{
                backgroundColor: '#6366f1',
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                Guardar avatar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
