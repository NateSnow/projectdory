import { useState, useEffect } from 'react'

const IMAGE_CACHE = new Map<string, string>()

/**
 * Build a Scryfall image URL for a card.
 * Prefers Secret Lair (SLD) versions, falls back to any printing.
 * Uses the "normal" size for desktop and "small" for mobile.
 */
export function getScryfallImageUrl(
  cardName: string,
  size: 'small' | 'normal' | 'large' | 'png' = 'normal',
  set?: string
): string {
  const encodedName = encodeURIComponent(cardName)
  const setParam = set ? `&set=${set}` : ''
  return `https://api.scryfall.com/cards/named?exact=${encodedName}${setParam}&format=image&version=${size}`
}

/**
 * Get the Scryfall image URL, trying SLD first then falling back.
 */
export function getCardImageUrl(cardName: string, size: 'small' | 'normal' = 'normal'): string {
  // For the Secret Lair DanDân cards, try SLD set first
  return getScryfallImageUrl(cardName, size, 'sld')
}

/**
 * Fallback URL without set restriction
 */
export function getCardImageFallbackUrl(cardName: string, size: 'small' | 'normal' = 'normal'): string {
  return getScryfallImageUrl(cardName, size)
}

/**
 * Hook to load a card image with SLD preference and fallback
 */
export function useCardImage(cardName: string, size: 'small' | 'normal' = 'normal') {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const cacheKey = `${cardName}_${size}`

    if (IMAGE_CACHE.has(cacheKey)) {
      setImageUrl(IMAGE_CACHE.get(cacheKey)!)
      setLoading(false)
      return
    }

    const primaryUrl = getCardImageUrl(cardName, size)
    const fallbackUrl = getCardImageFallbackUrl(cardName, size)

    const img = new Image()
    img.onload = () => {
      IMAGE_CACHE.set(cacheKey, primaryUrl)
      setImageUrl(primaryUrl)
      setLoading(false)
    }
    img.onerror = () => {
      // Try fallback (any set)
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        IMAGE_CACHE.set(cacheKey, fallbackUrl)
        setImageUrl(fallbackUrl)
        setLoading(false)
      }
      fallbackImg.onerror = () => {
        setError(true)
        setLoading(false)
      }
      fallbackImg.src = fallbackUrl
    }
    img.src = primaryUrl
  }, [cardName, size])

  return { imageUrl, loading, error }
}

/**
 * Preload all card images for the deck
 */
export function preloadDeckImages(cardNames: string[]): void {
  const uniqueNames = [...new Set(cardNames)]
  uniqueNames.forEach(name => {
    const img = new Image()
    img.src = getCardImageUrl(name)
  })
}
