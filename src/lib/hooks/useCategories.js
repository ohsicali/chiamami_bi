import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

// Gruppi categorie (nuovi) — l'ordine è quello mostrato nei dropdown
export const CATEGORY_GROUPS = [
  { key: 'cucina',    label: 'Cucina',    emoji: '🍝' },
  { key: 'atmosfera', label: 'Atmosfera', emoji: '🕯️' },
  { key: 'occasione', label: 'Occasione', emoji: '🥂' },
  { key: 'servizi',   label: 'Servizi',   emoji: '🌿' },
  { key: 'dieta',     label: 'Dieta',     emoji: '🥬' },
]

export function getGroupLabel(key) {
  return CATEGORY_GROUPS.find((g) => g.key === key)?.label || 'Cucina'
}

// Default categories (used as fallback if DB is empty or unavailable)
// Also exported as CUISINE_CATEGORIES for backwards compatibility
export const DEFAULT_CATEGORIES = [
  // Cucina
  { name: 'Piemontese', emoji: '🍷', color: '#8B5CF6', group_key: 'cucina' },
  { name: 'Italiana', emoji: '🍝', color: '#FF5757', group_key: 'cucina' },
  { name: 'Giapponese', emoji: '🍣', color: '#F59E0B', group_key: 'cucina' },
  { name: 'Fine Dining', emoji: '✨', color: '#6366F1', group_key: 'cucina' },
  { name: 'Gelateria', emoji: '🍦', color: '#EC4899', group_key: 'cucina' },
  { name: 'Tapas', emoji: '🫒', color: '#84CC16', group_key: 'cucina' },
  { name: 'Spagnolo', emoji: '🥘', color: '#DC2626', group_key: 'cucina' },
  { name: 'Asiatico', emoji: '🥡', color: '#0EA5E9', group_key: 'cucina' },
  { name: 'Mediterraneo', emoji: '🫓', color: '#14B8A6', group_key: 'cucina' },
  { name: 'Greco', emoji: '🥙', color: '#3B82F6', group_key: 'cucina' },
  { name: 'Indiano', emoji: '🍛', color: '#D97706', group_key: 'cucina' },
  { name: 'Thailandese', emoji: '🍜', color: '#10B981', group_key: 'cucina' },
  { name: 'Poke', emoji: '🥗', color: '#06B6D4', group_key: 'cucina' },
  { name: 'Barbecue', emoji: '🍖', color: '#B91C1C', group_key: 'cucina' },
  { name: 'Pesce', emoji: '🐟', color: '#2563EB', group_key: 'cucina' },
  { name: 'Kebab', emoji: '🌯', color: '#CA8A04', group_key: 'cucina' },
  { name: 'Americano', emoji: '🌭', color: '#EF4444', group_key: 'cucina' },
  { name: 'Sudamericano', emoji: '🫔', color: '#F59E0B', group_key: 'cucina' },
  { name: 'Pasta', emoji: '🍝', color: '#EA580C', group_key: 'cucina' },
  { name: 'Insalate', emoji: '🥗', color: '#22C55E', group_key: 'cucina' },
  { name: 'Internazionale', emoji: '🌍', color: '#6366F1', group_key: 'cucina' },
  { name: 'Cocktail', emoji: '🍸', color: '#A855F7', group_key: 'cucina' },
  { name: 'Bar', emoji: '🍸', color: '#78716C', group_key: 'cucina' },
  { name: 'Tramezzini', emoji: '🥪', color: '#D97706', group_key: 'cucina' },
  // Atmosfera
  { name: 'Romantico',        emoji: '💕', color: '#EC4899', group_key: 'atmosfera' },
  { name: 'Vista panoramica', emoji: '🌄', color: '#0284C7', group_key: 'atmosfera' },
  { name: 'Intimo',           emoji: '🕯️', color: '#9333EA', group_key: 'atmosfera' },
  { name: 'Casual',           emoji: '😌', color: '#0EA5E9', group_key: 'atmosfera' },
  // Occasione
  { name: 'Aperitivo',        emoji: '🥂', color: '#F97316', group_key: 'occasione' },
  { name: 'Famiglia',         emoji: '👨‍👩‍👧', color: '#F59E0B', group_key: 'occasione' },
  { name: 'Pranzo lavoro',    emoji: '💼', color: '#6366F1', group_key: 'occasione' },
  { name: 'Brunch',           emoji: '🥞', color: '#EAB308', group_key: 'occasione' },
  { name: 'Cena romantica',   emoji: '🌹', color: '#E11D48', group_key: 'occasione' },
  // Servizi
  { name: 'Dehors',           emoji: '🌿', color: '#16A34A', group_key: 'servizi' },
  { name: 'Wi-Fi',            emoji: '📶', color: '#0EA5E9', group_key: 'servizi' },
  { name: 'Pet friendly',     emoji: '🐶', color: '#8B5CF6', group_key: 'servizi' },
  { name: 'Parcheggio',       emoji: '🅿️', color: '#78716C', group_key: 'servizi' },
  { name: 'Asporto',          emoji: '🥡', color: '#0891B2', group_key: 'servizi' },
  { name: 'Delivery',         emoji: '🛵', color: '#0F766E', group_key: 'servizi' },
  // Dieta
  { name: 'Vegano',           emoji: '🥬', color: '#16A34A', group_key: 'dieta' },
  { name: 'Vegetariano',      emoji: '🥕', color: '#65A30D', group_key: 'dieta' },
  { name: 'Senza glutine',    emoji: '🌾', color: '#CA8A04', group_key: 'dieta' },
  { name: 'Halal',            emoji: '🕌', color: '#059669', group_key: 'dieta' },
  { name: 'Kosher',           emoji: '✡️', color: '#1D4ED8', group_key: 'dieta' },
]

// Module-level cache so getCategoryInfo works without hooks
let _cachedCategories = DEFAULT_CATEGORIES

export function getCategoryInfo(cuisineType) {
  return _cachedCategories.find(c => c.name === cuisineType) || { name: cuisineType, emoji: '🍽️', color: '#6B7280' }
}

// Normalize DB row to category object
function fromDb(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.icon || '🍴',
    color: row.color || '#6B7280',
    sort_order: row.sort_order ?? 0,
    group_key: row.group_key || 'cucina',
  }
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

  const addCategory = useCallback(async ({ name, emoji, color, group_key }) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1)
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        icon: emoji || '🍴',
        color,
        group_key: group_key || 'cucina',
        sort_order: maxOrder + 1,
      })
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

  const updateCategory = useCallback(async (id, { name, emoji, color, group_key }) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const patch = { name: name.trim(), icon: emoji, color }
    if (group_key) patch.group_key = group_key
    const { data, error } = await supabase
      .from('categories')
      .update(patch)
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
