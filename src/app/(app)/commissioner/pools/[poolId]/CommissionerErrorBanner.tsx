'use client'

import { ErrorStateBanner } from '@/components/ErrorStateBanner'
import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

interface CommissionerErrorBannerProps {
  lastRefreshError: string | null
  poolId: string
}

export function CommissionerErrorBanner({ lastRefreshError, poolId }: CommissionerErrorBannerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  
  const handleRetry = useCallback(() => {
    startTransition(async () => {
      const { refreshPoolScoresAction } = await import('./actions')
      await refreshPoolScoresAction(poolId)
      router.refresh()
    })
  }, [poolId, router])
  
  if (!lastRefreshError) return null
  
  return <ErrorStateBanner message={lastRefreshError} onRetry={handleRetry} />
}