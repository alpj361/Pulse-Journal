import { BookOpen, Clapperboard, Gamepad2, Globe, MapPin, Music, Podcast, Tv, UtensilsCrossed } from 'lucide-react-native';
import { MATERIAL } from './materiales';

const ICONO = {
  film: Clapperboard,
  series: Tv,
  book: BookOpen,
  game: Gamepad2,
  place: MapPin,
  food: UtensilsCrossed,
  music: Music,
  podcast: Podcast,
  website: Globe,
};

/**
 * El ícono de un material, en su color.
 *
 * Junto con el color es la señal de que algo ya se reconoció como material:
 * una película se ve como película antes de tocarla.
 */
export default function IconoMaterial({ material, size = 12, color, strokeWidth = 2 }) {
  const Icono = ICONO[material];
  if (!Icono) return null;
  return <Icono size={size} color={color || MATERIAL[material]?.color} strokeWidth={strokeWidth} />;
}
