import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

// Default categories (used as fallback if DB is empty or unavailable)
// Also exported as CUISINE_CATEGORIES for backwards compatibility
export const DEFAULT_CATEGORIES = [
  { name: 'Piemontese', emoji: '🍷', color: '#8B5CF6' },
  { name: 'Italiana', emoji: '🍝', color: '#FF5757' },
  { name: 'Giapponese', emoji: '🍣', color: '#F59E0B' },
  { name: 'Fine Dining', emoji: '✨', color: '#6366F1' },
  { name: 'Gelateria', emoji: '🍦', color: '#EC4899' },
  { name: 'Aperitivo', emoji: '🥂', color: '#F97316' },
  { name: 'Tapas', emoji: '🫒', color: '#84CC16' },
  { name: 'Spagnolo', emoji: '🥘', color: '#DC2626' },
  { name: 'Asiatico', emoji: '🥡', color: '#0EA5E9' },
  { name: 'Mediterraneo', emoji: '🫓', color: '#14B8A6' },
  { name: 'Greco', emoji: '🥙', color: '#3B82F6' },
  { name: 'Indiano', emoji: '🍛', color: '#D97706' },
  { name: 'Thailandese', emoji: '🍜', color: '#10B981' },
  { name: 'Poke', emoji: '🥗', color: '#06B6D4' },
  { name: 'Barbecue', emoji: '🍖', color: '#B91C1C' },
  { name: 'Pesce', emoji: '🐟', color: '#2563EB' },
  { name: 'Vegano', emoji: '🥬', color: '#16A34A' },
  { name: 'Vegetariano', emoji: '🥕', color: '#65A30D' },
  { name: 'Kebab', emoji: '🌯', color: '#CA8A04' },
  { name: 'Americano', emoji: '🌭', color: '#EF4444' },
  { name: 'Sudamericano', emoji: '🫔', color: '#F59E0B' },
  { name: 'Pasta', emoji: '🍝', color: '#EA580C' },
  { name: 'Insalate', emoji: '🥗', color: '#22C55E' },
  { name: 'Internazionale', emoji: '🌍', color: '#6366F1' },
  { name: 'Cocktail', emoji: '🍸', color: '#A855F7' },
  { name: 'Bar', emoji: '🍸', color: '#78716C' },
  { name: 'Tramezzini', emoji: '🥪', color: '#D97706' },
]

// Module-level cache so getCategoryInfo works without hooks
let _cachedCategories = DEFAULT_CATEGORIES

export function getCategoryInfo(cuisineType) {
  return _cachedCategories.find(c => c.name === cuisineType) || { name: cuisineType, emoji: '🍽️', color: '#6B7280' }
}

// Normalize DB row to category object
function fromDb(row) {
  return { id: row.id, name: row.name, emoji: row.icon || '🍴', color: row.color || '#6B7280', sort_order: row.sort_order ?? 0 }
}

export function useCategories() {
  const [categories, setCategories] = useState(_cachedCategories)
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (!error && data && data.length > 0) {
      const cats = data.map(fromDb)
      _cachedCategories = cats
      setCategories(cats)
    }
    // If DB is empty or error, keep defaults
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const addCategory = useCallback(async ({ name, emoji, color }) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1)
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: name.trim(), icon: emoji || '🍴', color, sort_order: maxOrder + 1 })
      .select()
      .single()
    if (!error && data) {
      const cat = fromDb(data)
      const updated = [...categories, cat]
      _cachedCategories = updated
      setCategories(updated)
    }
    return { data, error }
  }, [categories])

  const updateCategory = useCallback(async (id, { name, emoji, color }) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const { data, error } = await supabase
      .from('categories')
      .update({ name: name.trim(), icon: emoji, color })
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      const updated = categories.map(c => c.id === id ? fromDb(data) : c)
      _cachedCategories = updated
      setCategories(updated)
    }
    return { data, error }
  }, [categories])

  const deleteCategory = useCallback(async (id) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) {
      const updated = categories.filter(c => c.id !== id)
      _cachedCategories = updated
      setCategories(updated)
    }
    return { error }
  }, [categories])

  return { categories, loading, fetchCategories, addCategory, updateCategory, deleteCategory }
}
