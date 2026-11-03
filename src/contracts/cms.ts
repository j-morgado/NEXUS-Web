export type CmsRole = 'editor' | 'publisher' | 'manager' | 'admin'
export type PublicationState = 'draft' | 'published' | 'retired'

export interface VersionedDraft<T> {
  id: string
  revision: number
  state: PublicationState
  content: T
  updatedAt: string
}

export interface ContentPublicationPort<T> {
  saveDraft(draft: VersionedDraft<T>): Promise<VersionedDraft<T>>
  validateForPublication(draft: VersionedDraft<T>): Promise<{ valid: boolean; issues: string[] }>
  publish(id: string, revision: number): Promise<VersionedDraft<T>>
}

export interface EventPublicationPort {
  stage(eventConfigId: string, version: string): Promise<void>
  activate(eventConfigId: string, version: string): Promise<void>
  rollback(eventConfigId: string): Promise<void>
}

// Contracts only. Authorization must be enforced by a future trusted backend;
// local browser state is deliberately not presented as a CMS or security layer.
