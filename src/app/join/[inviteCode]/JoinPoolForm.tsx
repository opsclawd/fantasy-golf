'use client'

import { useFormState } from 'react-dom'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
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
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full"
    >
      {pending ? 'Joining...' : 'Join pool'}
    </Button>
  )
}
