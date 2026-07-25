export type AsyncIdentityToken = Readonly<{
  generation: number
  resourceKey: string
  subjectId: string
}>

export type AsyncIdentity = Readonly<{
  resourceKey: string
  subjectId: string | null
}>

export type AsyncIdentityGuard = {
  begin: (identity: AsyncIdentity) => AsyncIdentityToken | null
  cancel: () => void
  invalidate: () => void
  isCurrent: (token: AsyncIdentityToken, identity: AsyncIdentity) => boolean
}

export function createAsyncIdentityGuard(): AsyncIdentityGuard {
  let generation = 0
  let mounted = true

  return {
    begin(identity) {
      if (!mounted) return null
      const subjectId = identity.subjectId
      if (!subjectId) return null

      generation += 1
      return Object.freeze({
        generation,
        resourceKey: identity.resourceKey,
        subjectId,
      })
    },
    cancel() {
      mounted = false
      generation += 1
    },
    invalidate() {
      generation += 1
    },
    isCurrent(token, identity) {
      return (
        mounted &&
        generation === token.generation &&
        identity.subjectId === token.subjectId &&
        identity.resourceKey === token.resourceKey
      )
    },
  }
}
