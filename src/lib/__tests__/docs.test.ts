import { readFileSync } from 'fs'
import { join } from 'path'

describe('README documentation', () => {
  it('does not describe round-based best-ball as the MVP model', () => {
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf-8')
    expect(readme).not.toMatch(/Round-based best-ball/)
    expect(readme).not.toMatch(/round-by-round scoring.*best-ball/i)
  })
})

describe('rules-spec documentation', () => {
  it('does not define scoring as Entry round score', () => {
    const rulesSpec = readFileSync(join(process.cwd(), 'docs/rules-spec.md'), 'utf-8')
    expect(rulesSpec).not.toMatch(/Entry round score = min/)
  })
})