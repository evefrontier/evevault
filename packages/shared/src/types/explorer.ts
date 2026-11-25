export type ExplorerId = 'suiscan' | 'suivision' | 'custom'

/** The user's block explorer choice. `customTemplate` is used when id is "custom". */
export type ExplorerPreference = {
  id: ExplorerId
  customTemplate?: string
}

export interface ExplorerState {
  explorer: ExplorerPreference
  setExplorer: (explorer: ExplorerPreference) => void
}
