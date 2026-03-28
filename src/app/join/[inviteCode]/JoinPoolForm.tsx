'use client'

import { useFormState } from 'react-dom'
import { joinPool, type JoinPoolState } from './actions'

const initialState: JoinPoolState = null

type JoinPoolFormProps = {
  inviteCode: string
}

export default function JoinPoolForm({ inviteCode }: JoinPoolFormProps) {
  const [state, formAction] = useFormState(joinPool, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="inviteCode" value={inviteCode} />
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Join pool
      </button>
    </form>
  )
}
