import assert from 'node:assert/strict'
import { createAsyncIdentityGuard } from './asyncIdentityGuard'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function run() {
  let subjectId: string | null = 'user-a'
  let resourceKey = 'resource-a'
  const guard = createAsyncIdentityGuard()
  const identity = () => ({ resourceKey, subjectId })

  const tokenA = guard.begin(identity())
  assert.ok(tokenA)
  assert.equal(Object.isFrozen(tokenA), true)
  assert.equal(guard.isCurrent(tokenA, identity()), true)

  const pendingA = deferred<string>()
  const oldResult = pendingA.promise.then(() => guard.isCurrent(tokenA, identity()))
  subjectId = 'user-b'
  guard.invalidate()
  const tokenB = guard.begin(identity())
  assert.ok(tokenB)
  assert.equal(guard.isCurrent(tokenA, identity()), false)
  assert.equal(guard.isCurrent(tokenB, identity()), true)
  pendingA.resolve('late-a')
  assert.equal(await oldResult, false)

  const pendingB = deferred<string>()
  const resultB = pendingB.promise.then(() => guard.isCurrent(tokenB, identity()))
  subjectId = 'user-c'
  guard.invalidate()
  const tokenC = guard.begin(identity())
  assert.ok(tokenC)
  pendingB.resolve('late-b')
  assert.equal(await resultB, false)
  assert.equal(guard.isCurrent(tokenC, identity()), true)

  resourceKey = 'resource-c-next'
  assert.equal(guard.isCurrent(tokenC, identity()), false)
  const nextResourceToken = guard.begin(identity())
  assert.ok(nextResourceToken)
  assert.equal(guard.isCurrent(nextResourceToken, identity()), true)

  subjectId = null
  guard.invalidate()
  assert.equal(guard.begin(identity()), null)
  assert.equal(guard.isCurrent(nextResourceToken, identity()), false)

  subjectId = 'user-d'
  const unmountToken = guard.begin(identity())
  assert.ok(unmountToken)
  guard.cancel()
  assert.equal(guard.isCurrent(unmountToken, identity()), false)
  assert.equal(guard.begin(identity()), null)

  console.log('async identity guard behavioral tests passed')
}

void run()
