import type { Metadata } from 'next'

export const NO_INDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
} satisfies NonNullable<Metadata['robots']>

export const NO_INDEX_METADATA: Metadata = {
  robots: NO_INDEX_ROBOTS,
}
