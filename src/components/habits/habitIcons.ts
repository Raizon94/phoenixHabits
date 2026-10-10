import {
  Activity, Apple, Bed, Bike, BookOpen, Brain, Check, Church, CigaretteOff, Coffee, Cross, Droplet, Dumbbell, Flame,
  Footprints, HandHeart, Heart, Languages, Leaf, Moon, Music, PenLine, Pill, Salad, Sparkles, Sun, Target, Timer, WineOff,
  type LucideIcon,
} from 'lucide-react'

/** Iconos disponibles para hábitos (nombre guardado en BD → componente). */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  check: Check,
  salad: Salad,
  'book-open': BookOpen,
  'hand-heart': HandHeart,
  footprints: Footprints,
  dumbbell: Dumbbell,
  church: Church,
  cross: Cross,
  droplet: Droplet,
  moon: Moon,
  sun: Sun,
  bed: Bed,
  brain: Brain,
  heart: Heart,
  apple: Apple,
  coffee: Coffee,
  'cigarette-off': CigaretteOff,
  'wine-off': WineOff,
  pill: Pill,
  bike: Bike,
  music: Music,
  'pen-line': PenLine,
  languages: Languages,
  leaf: Leaf,
  flame: Flame,
  target: Target,
  timer: Timer,
  sparkles: Sparkles,
  activity: Activity,
}

export function habitIcon(name: string): LucideIcon {
  return HABIT_ICONS[name] ?? Check
}

export const HABIT_COLORS = ['#f97316', '#ef4444', '#ec4899', '#a78bfa', '#60a5fa', '#22d3ee', '#22c55e', '#84cc16', '#f59e0b', '#94a3b8']
