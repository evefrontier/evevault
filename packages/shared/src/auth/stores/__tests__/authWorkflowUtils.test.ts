import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '#/auth/stores/authWorkflowUtils'

describe('getErrorMessage', () => {
  it("getErrorMessage(new Error('New Error')) === 'New Error'", () => {
    expect(getErrorMessage(new Error('New Error'))).toBe('New Error')
  })

  it("getErrorMessage('x') === 'Unknown error'", () => {
    expect(getErrorMessage('x')).toBe('Unknown error')
  })
})
