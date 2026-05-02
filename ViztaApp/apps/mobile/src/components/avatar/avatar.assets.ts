import { ImageSourcePropType } from 'react-native'

export const AVATAR_ASSETS: Record<string, Record<string, ImageSourcePropType>> = {
  faces: {
    narrow_oval: require('../../assets/avatars/faces/face_01_narrow_oval.png'),
    round:       require('../../assets/avatars/faces/face_02_round.png'),
    square:      require('../../assets/avatars/faces/face_03_square.png'),
    wide_oval:   require('../../assets/avatars/faces/face_04_wide_oval.png'),
    angular:     require('../../assets/avatars/faces/face_05_angular.png'),
  },
  eyes: {
    almond_neutral:      require('../../assets/avatars/eyes/eye_01_almond_neutral.png'),
    sleepy_half:         require('../../assets/avatars/eyes/eye_02_sleepy_half.png'),
    surprised_circle:    require('../../assets/avatars/eyes/eye_03_surprised_circle.png'),
    surprised_circle_2:  require('../../assets/avatars/eyes/eye_04_surprised_circle_2.png'),
    closed_curves:       require('../../assets/avatars/eyes/eye_05_closed_curves.png'),
    winking:             require('../../assets/avatars/eyes/eye_06_winking.png'),
    star_sparkle:        require('../../assets/avatars/eyes/eye_07_star_sparkle.png'),
    squinting_intense:   require('../../assets/avatars/eyes/eye_08_squinting_intense.png'),
  },
  brows: {
    straight_flat:    require('../../assets/avatars/brows/brow_01_straight_flat.png'),
    arched_elegant:   require('../../assets/avatars/brows/brow_02_arched_elegant.png'),
    furrowed_angry:   require('../../assets/avatars/brows/brow_03_furrowed_angry.png'),
    raised_surprised: require('../../assets/avatars/brows/brow_04_raised_surprised.png'),
    thick_bold:       require('../../assets/avatars/brows/brow_05_thick_bold.png'),
    thin_delicate:    require('../../assets/avatars/brows/brow_06_thin_delicate.png'),
  },
  noses: {
    dot:           require('../../assets/avatars/noses/nose_01_dot.png'),
    curved_bridge: require('../../assets/avatars/noses/nose_02_curved_bridge.png'),
    round_button:  require('../../assets/avatars/noses/nose_03_round_button.png'),
    side_profile:  require('../../assets/avatars/noses/nose_04_side_profile.png'),
  },
  mouths: {
    closed_smile:      require('../../assets/avatars/mouths/mouth_01_closed_smile.png'),
    open_smile_teeth:  require('../../assets/avatars/mouths/mouth_02_open_smile_teeth.png'),
    neutral_flat:      require('../../assets/avatars/mouths/mouth_03_neutral_flat.png'),
    surprised_o:       require('../../assets/avatars/mouths/mouth_04_surprised_o.png'),
    smirk:             require('../../assets/avatars/mouths/mouth_05_smirk.png'),
    small_round:       require('../../assets/avatars/mouths/mouth_06_small_round.png'),
  },
  hair_short: {
    side_part:     require('../../assets/avatars/hair_short/hair_short_01_side_part.png'),
    curly_afro:    require('../../assets/avatars/hair_short/hair_short_02_curly_afro.png'),
    buzz_cut:      require('../../assets/avatars/hair_short/hair_short_03_buzz_cut.png'),
    mohawk:        require('../../assets/avatars/hair_short/hair_short_04_mohawk.png'),
    messy_bedhead: require('../../assets/avatars/hair_short/hair_short_05_messy_bedhead.png'),
    bowl_cut:      require('../../assets/avatars/hair_short/hair_short_06_bowl_cut.png'),
  },
  hair_long: {
    straight:  require('../../assets/avatars/hair_long/hair_long_01_straight.png'),
    wavy:      require('../../assets/avatars/hair_long/hair_long_02_wavy.png'),
    bob_bangs: require('../../assets/avatars/hair_long/hair_long_03_bob_bangs.png'),
    bun:       require('../../assets/avatars/hair_long/hair_long_04_bun.png'),
    braids:    require('../../assets/avatars/hair_long/hair_long_05_braids.png'),
  },
  accessories: {
    glasses_square:      require('../../assets/avatars/accessories/acc_01_glasses_square.png'),
    glasses_round_large: require('../../assets/avatars/accessories/acc_02_glasses_round_large.png'),
    earrings_studs:      require('../../assets/avatars/accessories/acc_03_earrings_studs.png'),
    beanie_hat:          require('../../assets/avatars/accessories/acc_04_beanie_hat.png'),
    headphones:          require('../../assets/avatars/accessories/acc_05_headphones.png'),
  },
}

export function getAvatarSource(category: string, style: string): ImageSourcePropType | null {
  return AVATAR_ASSETS[category]?.[style] ?? null
}
