'use client'

import { useFormState } from 'react-dom'
import { startPool, closePool } from './actions'
import { useEffect } from 'react'

function StartPoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState(startPool, null)

  useEffect(() => {
    if (state?.error) {
      alert(state.error)
    }
  }, [state])

  return (
    <form action={formAction}>
      <input type="hidden" name="poolId" value={poolId} />
      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
        Start Pool (Go Live)
      </button>
    </form>
  )
}

function ClosePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState(closePool, null)

  useEffect(() => {
    if (state?.error) {
      alert(state.error)
    }
  }, [state])

  return (
    <form action={formAction}>
      <input type="hidden" name="poolId" value={poolId} />
      <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
        End Pool
      </button>
    </form>
  )
}

export { StartPoolButton, ClosePoolButton }
