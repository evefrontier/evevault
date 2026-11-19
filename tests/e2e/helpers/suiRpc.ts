import type { Page, Request } from '@playwright/test'

interface SuiRpcMockOptions {
  balance?: string
}

interface RpcRequestBody {
  id?: unknown
  method: string
  params?: any[]
}

function parseRpcBody(request: Request): RpcRequestBody | null {
  if (request.method() !== 'POST') return null

  try {
    const body = request.postDataJSON()
    return body?.method ? body : null
  } catch {
    return null
  }
}

// Returns the mocked result for the RPC method, or undefined to pass it through.
function mockRpcResult(body: RpcRequestBody, balance: string): unknown {
  switch (body.method) {
    case 'sui_getLatestSuiSystemState':
      return {
        epoch: '1000',
        epochDurationMs: '60000',
        epochStartTimestampMs: '0',
        storageFundTotal: '0',
        referenceGasPrice: '1',
        safeMode: false,
        protocolVersion: '1',
      }
    case 'suix_getBalance':
      return {
        totalBalance: balance,
        coinType: body.params?.[1]?.coinType ?? '0x2::sui::SUI',
        coinObjectCount: 1,
        lockedBalance: [],
      }
    default:
      return undefined
  }
}

export async function mockSuiRpc(page: Page, options?: SuiRpcMockOptions) {
  const { balance = '1234567890' } = options ?? {}

  await page.route('**/fullnode.devnet.sui.io/**', async (route) => {
    const body = parseRpcBody(route.request())
    const result = body ? mockRpcResult(body, balance) : undefined

    if (!body || result === undefined) {
      return route.continue()
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result }),
    })
  })
}
