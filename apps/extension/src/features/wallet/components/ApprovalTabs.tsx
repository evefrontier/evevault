import { type ReactNode, useState } from 'react'

export type ApprovalTab = {
  id: string
  label: string
  /** `warn` (amber) and `danger` (red) tint the label so warnings stay noticeable when not front. */
  tone?: 'default' | 'warn' | 'danger'
  content: ReactNode
}

/**
 * Compact tabbed container for the approval popup. Only the active tab's body
 * is mounted, so the popup stays a fixed, short height regardless of how much
 * the simulation or payload returns.
 */
export function ApprovalTabs({
  tabs,
  initialId,
}: {
  tabs: ApprovalTab[]
  initialId?: string
}) {
  const [activeId, setActiveId] = useState(initialId ?? tabs[0]?.id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <div className="approval-tabs c-panel">
      <div role="tablist" className="approval-tabs__list">
        {tabs.map((tab) => {
          const tone =
            tab.tone && tab.tone !== 'default'
              ? ` approval-tabs__tab--${tab.tone}`
              : ''
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active?.id}
              onClick={() => setActiveId(tab.id)}
              className={`approval-tabs__tab${tone}`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" className="approval-tabs__panel">
        {active?.content}
      </div>
    </div>
  )
}
