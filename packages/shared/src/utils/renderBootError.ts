/**
 * Replaces the root's contents with a minimal error screen and reload button.
 * Built via DOM APIs (not innerHTML) so the error message is inert text —
 * also keeps this compatible with require-trusted-types-for 'script'.
 */
export function renderBootError(rootElement: HTMLElement, error: unknown) {
  const container = document.createElement('div')
  container.style.padding = '20px'
  const heading = document.createElement('h1')
  heading.textContent = 'EVE Vault'
  const message = document.createElement('p')
  message.style.color = 'red'
  message.textContent = `Failed to initialize: ${
    error instanceof Error ? error.message : String(error)
  }`
  const reloadButton = document.createElement('button')
  reloadButton.textContent = 'Reload'
  reloadButton.addEventListener('click', () => window.location.reload())
  container.append(heading, message, reloadButton)
  rootElement.replaceChildren(container)
}
