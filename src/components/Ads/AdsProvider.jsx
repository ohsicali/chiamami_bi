import { AdsContext, useAdsValue } from '../../lib/hooks/useAds'

/**
 * Rende disponibili le campagne estratte per questa pagina a tutti gli
 * <AdSlot> montati sotto. Va dentro il Router: la scelta dipende dalla route.
 */
export default function AdsProvider({ children }) {
  const value = useAdsValue()
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>
}
