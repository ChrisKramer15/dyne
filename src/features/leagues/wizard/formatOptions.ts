import { SPORTS } from '../../home/homeData'

export interface FormatOption {
  name: string
  tagline: string
}

/** Every league format in `SPORTS`, in definition order. */
export const FORMAT_OPTIONS: readonly FormatOption[] = SPORTS.flatMap((s) =>
  s.formats.map((f) => ({ name: f.name, tagline: f.tagline })),
)

export const NO_FORMATS_MESSAGE = 'No league formats are available'
