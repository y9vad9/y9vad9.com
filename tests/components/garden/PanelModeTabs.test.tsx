import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import {
  PanelModeTabs,
  EXPLORER_MODES,
  TOOLS_MODES,
} from '@components/garden/PanelModeTabs'

afterEach(cleanup)

const label = (key: string) => key.toUpperCase()

describe('PanelModeTabs', () => {
  it('renders one tab per mode', () => {
    const { getAllByRole } = render(
      <PanelModeTabs
        modes={EXPLORER_MODES}
        active="files"
        onSelect={() => {}}
        label="Explorer sections"
        labelFor={label}
      />,
    )
    expect(getAllByRole('tab')).toHaveLength(EXPLORER_MODES.length)
  })

  it('marks exactly the active mode as selected', () => {
    const { getAllByRole } = render(
      <PanelModeTabs
        modes={TOOLS_MODES}
        active="links"
        onSelect={() => {}}
        label="Panel sections"
        labelFor={label}
      />,
    )
    const selected = getAllByRole('tab').filter(
      (t) => t.getAttribute('aria-selected') === 'true',
    )
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('LINKS')
  })

  it('reports the clicked mode', () => {
    const onSelect = vi.fn()
    const { getByText } = render(
      <PanelModeTabs
        modes={EXPLORER_MODES}
        active="files"
        onSelect={onSelect}
        label="Explorer sections"
        labelFor={label}
      />,
    )
    fireEvent.click(getByText('SEARCH'))
    expect(onSelect).toHaveBeenCalledWith('search')
  })

  it('exposes a named tablist for assistive tech', () => {
    const { getByRole } = render(
      <PanelModeTabs
        modes={EXPLORER_MODES}
        active="files"
        onSelect={() => {}}
        label="Explorer sections"
        labelFor={label}
      />,
    )
    expect(getByRole('tablist')).toHaveAttribute('aria-label', 'Explorer sections')
  })

  it('renders only the modes it is handed, so a caller can drop `series`', () => {
    const withoutSeries = TOOLS_MODES.filter((m) => m.mode !== 'series')
    const { queryByText, getAllByRole } = render(
      <PanelModeTabs
        modes={withoutSeries}
        active="toc"
        onSelect={() => {}}
        label="Panel sections"
        labelFor={label}
      />,
    )
    expect(getAllByRole('tab')).toHaveLength(TOOLS_MODES.length - 1)
    expect(queryByText('SERIES')).toBeNull()
  })

  it('keeps the two mode lists aligned with the panel stores', () => {
    expect(EXPLORER_MODES.map((m) => m.mode)).toEqual(['files', 'search'])
    expect(TOOLS_MODES.map((m) => m.mode)).toEqual(['toc', 'series', 'links', 'graph'])
  })
})
