import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

/**
 * Fetch reviews for a specific restaurant
 */
export function useRestaurantReviews(restaurantId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    if (!restaurantId || !isSupabaseConfigured()) {
      setReviews([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('user_reviews')
      .select('*, user:profiles(id, full_name, avatar_url), photos:user_review_photos(id, photo_url, sort_order)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })

    setReviews(data || [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  return { reviews, loading, refetch: fetchReviews }
}

/**
 * Check if the current user already has a review for a restaurant
 */
export function useUserReview(restaurantId, userId) {
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId || !userId || !isSupabaseConfigured()) {
      setReview(null)
      setLoading(false)
      return
    }

    supabase
      .from('user_reviews')
      .select('*, photos:user_review_photos(id, photo_url, sort_order)')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setReview(data || null)
        setLoading(false)
      })
  }, [restaurantId, userId])

  return { review, loading }
}

/**
 * Submit or update a review
 */
export async function submitReview({ restaurantId, userId, comment, photoFiles }) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')

  // Check if user already has a review for this restaurant
  const { data: existing } = await supabase
    .from('user_reviews')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', userId)
    .single()

  let reviewId

  if (existing) {
    // Update existing review
    const { data, error } = await supabase
      .from('user_reviews')
      .update({ comment, status: 'published' })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    reviewId = data.id
  } else {
    // Create new review
    const { data, error } = await supabase
      .from('user_reviews')
      .insert({
        user_id: userId,
        restaurant_id: restaurantId,
        comment,
        status: 'published',
      })
      .select()
      .single()
    if (error) throw error
    reviewId = data.id
  }

  // Upload photos if provided
  if (photoFiles && photoFiles.length > 0) {
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i]
      const ext = file.name?.split('.').pop() || 'jpg'
      const path = `review-photos/${reviewId}/${Date.now()}-${i}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, file, { contentType: file.type || 'image/jpeg' })

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        if (urlData?.publicUrl) {
          await supabase.from('user_review_photos').insert({
            review_id: reviewId,
            photo_url: urlData.publicUrl,
            sort_order: i,
          })
        }
      }
    }
  }

  return reviewId
}

/**
 * Compress an image file before upload
 */
export function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' }))
          },
          'image/jpeg',
          quality
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Fetch all reviews for admin moderation
 */
export function useAllReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('user_reviews')
      .select('*, user:profiles(id, full_name, email, avatar_url), restaurant:restaurants(id, name, slug), photos:user_review_photos(id, photo_url, sort_order)')
      .order('created_at', { ascending: false })

    setReviews(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const updateStatus = useCallback(async (reviewId, newStatus) => {
    const { error } = await supabase
      .from('user_reviews')
      .update({ status: newStatus })
      .eq('id', reviewId)

    if (!error) {
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: newStatus } : r))
    }
    return !error
  }, [])

  const deleteReview = useCallback(async (reviewId) => {
    const { error } = await supabase
      .from('user_reviews')
      .delete()
      .eq('id', reviewId)

    if (!error) {
      setReviews(prev => prev.filter(r => r.id !== reviewId))
    }
    return !error
  }, [])

  return { reviews, loading, refetch: fetchAll, updateStatus, deleteReview }
}
