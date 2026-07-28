import { describe, it, expect, beforeEach } from 'vitest'
import {
  usePanelStore,
  PANEL_MIN_WIDTH,
  PANEL_MAX_WIDTH,
} from '@store/panelStore'

beforeEach(() => {
  usePanelStore.setState({
    leftOpen: true,
    rightOpen: true,
    leftWidth: 240,
    rightWidth: 240,
    explorerMode: 'files',
    toolsMode: 'toc',
    explorerFocusNonce: 0,
    toolsFocusNonce: 0,
  })
})

describe('panelStore', () => {
  it('toggleLeft / toggleRight flip booleans', () => {
    const { toggleLeft, toggleRight } = usePanelStore.getState()
    toggleLeft()
    expect(usePanelStore.getState().leftOpen).toBe(false)
    toggleRight()
    expect(usePanelStore.getState().rightOpen).toBe(false)
  })

  it('closeLeft / closeRight close, and are no-ops when already closed', () => {
    const { closeLeft, closeRight } = usePanelStore.getState()
    closeLeft()
    closeRight()
    expect(usePanelStore.getState().leftOpen).toBe(false)
    expect(usePanelStore.getState().rightOpen).toBe(false)

    // Unlike toggle*, calling again must not reopen the panel — the mobile
    // drawer dismisses on every note pick, including repeat picks.
    closeLeft()
    closeRight()
    expect(usePanelStore.getState().leftOpen).toBe(false)
    expect(usePanelStore.getState().rightOpen).toBe(false)
  })

  it('setLeftWidth / setRightWidth clamp to [MIN, MAX]', () => {
    const { setLeftWidth, setRightWidth } = usePanelStore.getState()
    setLeftWidth(50)
    expect(usePanelStore.getState().leftWidth).toBe(PANEL_MIN_WIDTH)
    setLeftWidth(9999)
    expect(usePanelStore.getState().leftWidth).toBe(PANEL_MAX_WIDTH)

    setRightWidth(250)
    expect(usePanelStore.getState().rightWidth).toBe(250)
  })

  it('focusExplorer opens left, sets mode and bumps the nonce', () => {
    usePanelStore.setState({ leftOpen: false })
    const before = usePanelStore.getState().explorerFocusNonce
    usePanelStore.getState().focusExplorer('search')
    const state = usePanelStore.getState()
    expect(state.leftOpen).toBe(true)
    expect(state.explorerMode).toBe('search')
    expect(state.explorerFocusNonce).toBe(before + 1)
  })

  it('focusTools opens right and increments the nonce on every call', () => {
    usePanelStore.setState({ rightOpen: false })
    usePanelStore.getState().focusTools('series')
    usePanelStore.getState().focusTools()
    const state = usePanelStore.getState()
    expect(state.rightOpen).toBe(true)
    expect(state.toolsMode).toBe('series')
    expect(state.toolsFocusNonce).toBe(2)
  })

  it('focusExplorer without an explicit mode keeps the current mode', () => {
    usePanelStore.setState({ explorerMode: 'search' })
    usePanelStore.getState().focusExplorer()
    expect(usePanelStore.getState().explorerMode).toBe('search')
  })
})
