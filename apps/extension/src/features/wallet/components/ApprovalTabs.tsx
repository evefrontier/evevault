import { type ReactNode, useState } from 'react'

export type ApprovalTab = {
  id: string
  label: string
  /** `danger` tints the tab label so warnings stay noticeable when not front. */
  tone?: 'default' | 'danger'
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
    <div className="w-[80vw] max-w-full border border-[var(--matter-05)]">
      <div role="tablist" className="flex border-b border-[var(--matter-05)]">
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id
          const tone =
            tab.tone === 'danger' ? 'text-(--error)' : 'text-(--grey-neutral)'
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              className={`-mb-px flex-1 border-b-2 px-2 py-1.5 text-[11px] uppercase tracking-wide transition-colors ${
                isActive
                  ? 'border-(--neutral) text-(--neutral)'
                  : `border-transparent ${tone}`
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" className="max-h-60 overflow-y-auto p-2 text-left">
        {active?.content}
      </div>
    </div>
  )
}
