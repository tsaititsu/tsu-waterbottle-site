import assert from 'node:assert/strict'
import Module from 'node:module'
import {
  act,
  createElement,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from 'react'
import type { AdminRecordDetailRequestRuntime } from './AdminRecordDetail'

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

class TestNode {
  readonly childNodes: TestNode[] = []
  parentNode: TestNode | null = null
  ownerDocument: TestDocument

  constructor(
    readonly nodeType: number,
    ownerDocument: TestDocument,
  ) {
    this.ownerDocument = ownerDocument
  }

  appendChild(child: TestNode) {
    child.parentNode?.removeChild(child)
    this.childNodes.push(child)
    child.parentNode = this
    return child
  }

  insertBefore(child: TestNode, before: TestNode | null) {
    if (before === null) return this.appendChild(child)
    const index = this.childNodes.indexOf(before)
    if (index < 0) throw new Error('before node is not a child')
    child.parentNode?.removeChild(child)
    this.childNodes.splice(index, 0, child)
    child.parentNode = this
    return child
  }

  removeChild(child: TestNode) {
    const index = this.childNodes.indexOf(child)
    if (index < 0) throw new Error('node is not a child')
    this.childNodes.splice(index, 1)
    child.parentNode = null
    return child
  }

  get firstChild() {
    return this.childNodes[0] ?? null
  }

  get lastChild(): TestNode | null {
    return this.childNodes.at(-1) ?? null
  }

  get nextSibling(): TestNode | null {
    if (!this.parentNode) return null
    const index = this.parentNode.childNodes.indexOf(this)
    return this.parentNode.childNodes[index + 1] ?? null
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join('')
  }

  set textContent(value: string) {
    for (const child of this.childNodes) child.parentNode = null
    this.childNodes.length = 0
    if (value) this.appendChild(this.ownerDocument.createTextNode(value))
  }
}

class TestText extends TestNode {
  constructor(
    private value: string,
    ownerDocument: TestDocument,
  ) {
    super(3, ownerDocument)
  }

  get nodeName() {
    return '#text'
  }

  get nodeValue() {
    return this.value
  }

  set nodeValue(value: string) {
    this.value = value
  }

  override get textContent() {
    return this.value
  }

  override set textContent(value: string) {
    this.value = value
  }
}

class TestElement extends TestNode {
  readonly attributes = new Map<string, string>()
  readonly namespaceURI: string
  readonly nodeName: string
  readonly tagName: string
  readonly style = {
    setProperty: () => undefined,
  }

  constructor(
    tagName: string,
    ownerDocument: TestDocument,
    namespaceURI = HTML_NAMESPACE,
  ) {
    super(1, ownerDocument)
    this.tagName = tagName.toUpperCase()
    this.nodeName = this.tagName
    this.namespaceURI = namespaceURI
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  addEventListener() {}

  removeEventListener() {}

  focus() {
    this.ownerDocument.activeElement = this
  }
}

class TestDocument extends TestNode {
  readonly documentElement: TestElement
  readonly head: TestElement
  readonly body: TestElement
  activeElement: TestElement | null = null
  defaultView: Record<string, unknown> | null = null

  constructor() {
    super(9, null as unknown as TestDocument)
    this.ownerDocument = this
    this.documentElement = this.createElement('html')
    this.head = this.createElement('head')
    this.body = this.createElement('body')
    this.documentElement.appendChild(this.head)
    this.documentElement.appendChild(this.body)
    this.appendChild(this.documentElement)
  }

  createElement(tagName: string) {
    return new TestElement(tagName, this)
  }

  createElementNS(namespaceURI: string, tagName: string) {
    return new TestElement(tagName, this, namespaceURI)
  }

  createTextNode(value: string) {
    return new TestText(value, this)
  }

  addEventListener() {}

  removeEventListener() {}

  getElementById() {
    return null
  }

  querySelector() {
    return null
  }
}

function installTestDom() {
  const document = new TestDocument()
  const localStorage = new Map<string, string>()
  const window = {
    document,
    Node: TestNode,
    Element: TestElement,
    HTMLElement: TestElement,
    HTMLIFrameElement: class extends TestElement {},
    SVGElement: TestElement,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    getSelection: () => null,
    navigator: globalThis.navigator,
    clearTimeout,
    setTimeout,
    localStorage: {
      getItem: (key: string) => localStorage.get(key) ?? null,
      setItem: (key: string, value: string) => localStorage.set(key, value),
      removeItem: (key: string) => localStorage.delete(key),
    },
    location: {
      origin: 'https://example.test',
      pathname: '/admin/product-orders/record-a',
      protocol: 'https:',
      search: '',
    },
  }
  document.defaultView = window
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: TestNode,
    Element: TestElement,
    HTMLElement: TestElement,
    SVGElement: TestElement,
    document,
    self: window,
    window,
  })
  return { document }
}

type SyntheticRecord = {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

type DetailProps<T> = {
  endpoint: string
  responseKey: string
  backHref: string
  backLabel: string
  render: (record: T) => ReactNode
  validateRecord: (value: unknown) => value is T
  requestRuntime: AdminRecordDetailRequestRuntime
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function isSyntheticRecord(value: unknown): value is SyntheticRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).sort().join(',') === 'address,email,id,name,phone' &&
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.email === 'string' &&
    typeof record.phone === 'string' &&
    typeof record.address === 'string'
  )
}

const recordA: SyntheticRecord = {
  id: 'record-a-private-id',
  name: 'Alice Private',
  email: 'alice.private@example.test',
  phone: '0912-345-678',
  address: 'Private Address A',
}

const recordB: SyntheticRecord = {
  id: 'record-b-private-id',
  name: 'Bob Private',
  email: 'bob.private@example.test',
  phone: '0922-345-678',
  address: 'Private Address B',
}

const recordC: SyntheticRecord = {
  id: 'record-c-private-id',
  name: 'Carol Private',
  email: 'carol.private@example.test',
  phone: '0932-345-678',
  address: 'Private Address C',
}

function renderRecord(record: SyntheticRecord) {
  return createElement(
    'article',
    null,
    record.id,
    record.name,
    record.email,
    record.phone,
    record.address,
  )
}

async function main() {
  const { document } = installTestDom()
  const { createRoot } = await import('react-dom/client')
  type NodeModuleInternals = {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown
  }
  const moduleInternals = Module as unknown as NodeModuleInternals
  const originalLoad = moduleInternals._load
  moduleInternals._load = function loadForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === '@/lib/mockAuth') {
      return {
        getAuthAccessToken: async () => null,
        getMockUser: () => null,
        subscribeAuthChange: () => () => undefined,
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const { default: AdminRecordDetail } = await import('./AdminRecordDetail').finally(() => {
    moduleInternals._load = originalLoad
  })
  const Detail = AdminRecordDetail as ComponentType<DetailProps<SyntheticRecord>>
  type PlannedResponse = ReturnType<typeof response>
  const tests: Array<{ name: string; run: () => Promise<void> }> = []
  const test = (name: string, run: () => Promise<void>) => tests.push({ name, run })

  function createScenario() {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container as unknown as Element)
    const tokenPlans: Array<Promise<string | null>> = []
    const responsePlans = new Map<string, Array<Promise<PlannedResponse>>>()
    const fetchCalls: string[] = []
    const commitSnapshots: Array<{ endpoint: string; text: string }> = []

    const runtime: AdminRecordDetailRequestRuntime = {
      getCurrentUser: () => ({ id: 'admin-a', provider: 'google' }),
      getAccessToken: async () => {
        const tokenPlan = tokenPlans.shift()
        assert.ok(tokenPlan, '每次 request generation 都必須有明確 token plan')
        return tokenPlan
      },
      fetchResponse: async (endpoint) => {
        fetchCalls.push(endpoint)
        const plans = responsePlans.get(endpoint)
        const responsePlan = plans?.shift()
        assert.ok(responsePlan, `endpoint 必須有明確 response plan：${endpoint}`)
        return responsePlan
      },
      subscribeAuthChange: () => () => undefined,
    }

    function Harness({ endpoint }: { endpoint: string }) {
      const ref = useRef<HTMLElement>(null)
      useLayoutEffect(() => {
        commitSnapshots.push({ endpoint, text: ref.current?.textContent ?? '' })
      }, [endpoint])
      return createElement(
        'div',
        { ref },
        createElement(Detail, {
          backHref: '/admin/product-orders',
          backLabel: '返回商品訂單',
          endpoint,
          render: renderRecord,
          requestRuntime: runtime,
          responseKey: 'productOrder',
          validateRecord: isSyntheticRecord,
        }),
      )
    }

    return {
      commitSnapshots,
      container,
      fetchCalls,
      planResponse(endpoint: string, value: PlannedResponse | Promise<PlannedResponse>) {
        const plans = responsePlans.get(endpoint) ?? []
        plans.push(Promise.resolve(value))
        responsePlans.set(endpoint, plans)
      },
      planToken(value: string | null | Promise<string | null>) {
        tokenPlans.push(Promise.resolve(value))
      },
      async render(endpoint: string) {
        await act(async () => {
          root.render(createElement(Harness, { endpoint }))
          await Promise.resolve()
        })
      },
      async flush() {
        await act(async () => {
          await Promise.resolve()
        })
      },
      async unmount() {
        await act(async () => {
          root.unmount()
        })
        document.body.removeChild(container)
      },
    }
  }

  test('Route B first commit hides Route A before the new passive effect', async () => {
    const scenario = createScenario()
    const tokenB = deferred<string | null>()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    scenario.planToken(tokenB.promise)

    await scenario.render('/api/admin/product-orders/record-a')
    assert.match(scenario.container.textContent, /Alice Private/)
    await scenario.render('/api/admin/product-orders/record-b')

    const firstRouteBCommit = scenario.commitSnapshots.at(-1)?.text ?? ''
    for (const sensitiveValue of Object.values(recordA)) {
      assert.equal(
        firstRouteBCommit.includes(sensitiveValue),
        false,
        `Route B 的第一個 commit 不得顯示 Route A 敏感資料：${sensitiveValue}`,
      )
    }
    assert.match(scenario.container.textContent, /正在讀取資料/)
    await scenario.unmount()
  })

  test('Route B token pending keeps Route A hidden and does not fetch B', async () => {
    const scenario = createScenario()
    const tokenB = deferred<string | null>()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    scenario.planToken(tokenB.promise)

    await scenario.render('/api/admin/product-orders/record-a')
    await scenario.render('/api/admin/product-orders/record-b')
    await scenario.flush()

    for (const sensitiveValue of Object.values(recordA)) {
      assert.equal(scenario.container.textContent.includes(sensitiveValue), false)
    }
    assert.deepEqual(scenario.fetchCalls, ['/api/admin/product-orders/record-a'])
    assert.match(scenario.container.textContent, /正在讀取資料/)
    await scenario.unmount()
  })

  test('a late Route A response cannot replace the current Route B record', async () => {
    const scenario = createScenario()
    const responseA = deferred<ReturnType<typeof response>>()
    scenario.planToken('token-a')
    scenario.planResponse('/api/admin/product-orders/record-a', responseA.promise)
    await scenario.render('/api/admin/product-orders/record-a')

    scenario.planToken('token-b')
    scenario.planResponse(
      '/api/admin/product-orders/record-b',
      response(200, { ok: true, productOrder: recordB }),
    )
    await scenario.render('/api/admin/product-orders/record-b')
    assert.match(scenario.container.textContent, /Bob Private/)

    await act(async () => {
      responseA.resolve(response(200, { ok: true, productOrder: recordA }))
      await Promise.resolve()
    })
    assert.match(scenario.container.textContent, /Bob Private/)
    for (const sensitiveValue of Object.values(recordA)) {
      assert.equal(scenario.container.textContent.includes(sensitiveValue), false)
    }
    await scenario.unmount()
  })

  test('Route B success displays only Route B after hiding ready Route A', async () => {
    const scenario = createScenario()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    await scenario.render('/api/admin/product-orders/record-a')
    assert.match(scenario.container.textContent, /Alice Private/)

    scenario.planToken('token-b')
    scenario.planResponse(
      '/api/admin/product-orders/record-b',
      response(200, { ok: true, productOrder: recordB }),
    )
    await scenario.render('/api/admin/product-orders/record-b')

    const firstRouteBCommit = scenario.commitSnapshots.at(-1)?.text ?? ''
    assert.equal(firstRouteBCommit.includes(recordA.name), false)
    for (const sensitiveValue of Object.values(recordA)) {
      assert.equal(scenario.container.textContent.includes(sensitiveValue), false)
    }
    for (const currentValue of Object.values(recordB)) {
      assert.equal(scenario.container.textContent.includes(currentValue), true)
    }
    await scenario.unmount()
  })

  test('Route B forbidden state never reuses ready Route A data', async () => {
    const scenario = createScenario()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    await scenario.render('/api/admin/product-orders/record-a')

    scenario.planToken('token-b')
    scenario.planResponse(
      '/api/admin/product-orders/record-b',
      response(403, { error: 'private' }),
    )
    await scenario.render('/api/admin/product-orders/record-b')

    assert.match(scenario.container.textContent, /沒有管理權限/)
    for (const sensitiveValue of Object.values(recordA)) {
      assert.equal(scenario.container.textContent.includes(sensitiveValue), false)
    }
    assert.equal(
      scenario.commitSnapshots.at(-1)?.text.includes(recordA.name),
      false,
    )
    await scenario.unmount()
  })

  test('Route B malformed 200 fails closed without Route A or malformed B data', async () => {
    const scenario = createScenario()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    await scenario.render('/api/admin/product-orders/record-a')

    scenario.planToken('token-b')
    scenario.planResponse(
      '/api/admin/product-orders/record-b',
      response(200, {
        ok: true,
        productOrder: { ...recordB, privateNote: 'malformed-private-note' },
      }),
    )
    await scenario.render('/api/admin/product-orders/record-b')

    assert.match(scenario.container.textContent, /暫時無法讀取/)
    for (const sensitiveValue of [
      ...Object.values(recordA),
      ...Object.values(recordB),
      'malformed-private-note',
    ]) {
      assert.equal(scenario.container.textContent.includes(sensitiveValue), false)
    }
    await scenario.unmount()
  })

  test('rapid Route A to B to C allows only Route C to become ready', async () => {
    const scenario = createScenario()
    const tokenB = deferred<string | null>()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    await scenario.render('/api/admin/product-orders/record-a')

    scenario.planToken(tokenB.promise)
    await scenario.render('/api/admin/product-orders/record-b')

    scenario.planToken('token-c')
    scenario.planResponse(
      '/api/admin/product-orders/record-c',
      response(200, { ok: true, productOrder: recordC }),
    )
    await scenario.render('/api/admin/product-orders/record-c')

    for (const staleValue of [...Object.values(recordA), ...Object.values(recordB)]) {
      assert.equal(scenario.container.textContent.includes(staleValue), false)
    }
    for (const currentValue of Object.values(recordC)) {
      assert.equal(scenario.container.textContent.includes(currentValue), true)
    }
    assert.deepEqual(scenario.fetchCalls, [
      '/api/admin/product-orders/record-a',
      '/api/admin/product-orders/record-c',
    ])

    await act(async () => {
      tokenB.resolve('token-b')
      await Promise.resolve()
    })
    assert.deepEqual(scenario.fetchCalls, [
      '/api/admin/product-orders/record-a',
      '/api/admin/product-orders/record-c',
    ])
    assert.match(scenario.container.textContent, /Carol Private/)
    await scenario.unmount()
  })

  test('unmount during Route B token wait prevents fetch and state warnings', async () => {
    const scenario = createScenario()
    const tokenB = deferred<string | null>()
    scenario.planToken('token-a')
    scenario.planResponse(
      '/api/admin/product-orders/record-a',
      response(200, { ok: true, productOrder: recordA }),
    )
    await scenario.render('/api/admin/product-orders/record-a')
    scenario.planToken(tokenB.promise)
    await scenario.render('/api/admin/product-orders/record-b')

    const originalConsoleError = console.error
    const consoleErrors: unknown[][] = []
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args)
    }
    try {
      await scenario.unmount()
      await act(async () => {
        tokenB.resolve('token-b')
        await Promise.resolve()
      })
    } finally {
      console.error = originalConsoleError
    }

    assert.deepEqual(scenario.fetchCalls, ['/api/admin/product-orders/record-a'])
    assert.deepEqual(consoleErrors, [])
  })

  for (const currentTest of tests) {
    await currentTest.run()
    console.log(`✓ ${currentTest.name}`)
  }
  console.log(`AdminRecordDetail component rerender tests passed (${tests.length} cases)`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
