import { describe, expect, it } from 'vitest'
import { seedProduct } from '../content/seed'
import { createEmailPreview } from './emailTemplate'

describe('email template', () => {
  it('generates ordered escaped product content', () => {
    const result = createEmailPreview({ ...seedProduct, name: '<JLTV>' })
    expect(result.html).toContain('&lt;JLTV&gt;')
    expect(result.html).not.toContain('<JLTV>')
    expect(result.text).toContain('Demonstration content')
  })
})
