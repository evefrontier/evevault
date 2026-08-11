/**
 * Environment detection utilities for cross-platform code
 */
import { browser } from '@wxt-dev/browser'

/**
 * Check if code is running in a browser environment (has window object)
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined'
}

/**
 * Check if code is running in an extension context
 */
export const isExtension = (): boolean => {
  return !!browser?.runtime?.id
}

/**
 * Check if code is running in a web app context (browser but not extension)
 */
export const isWeb = (): boolean => {
  return isBrowser() && !isExtension()
}
