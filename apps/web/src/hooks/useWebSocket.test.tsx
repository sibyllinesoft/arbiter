import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'
import * as wsService from '../services/websocket'
import * as apiService from '../services/api'
import { toast } from 'react-toastify'
import type { WsEvent } from '../types/api'

// Mock dependencies
vi.mock('../services/websocket')
vi.mock('../services/api')
vi.mock('react-toastify')
// Create mock functions that we can spy on
const mockDispatch = vi.fn()
const mockSetError = vi.fn()
const mockSetLoading = vi.fn()

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    state: {
      isConnected: false,
      reconnectAttempts: 0,
      lastSync: null,
      validationErrors: [],
      validationWarnings: [],
      isValidating: false,
      lastValidation: null,
    },
    dispatch: mockDispatch,
    setError: mockSetError,
    setLoading: mockSetLoading,
  })
}))

const mockWsService = vi.mocked(wsService.wsService)
const mockApiService = vi.mocked(apiService.apiService)
const mockToast = vi.mocked(toast)

describe('useWebSocket', () => {
  // Mock app state structure
  const mockAppState = {
    isConnected: false,
    reconnectAttempts: 0,
    lastSync: null,
    validationErrors: [],
    validationWarnings: [],
    isValidating: false,
    lastValidation: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockWsService.isConnected = vi.fn().mockReturnValue(false)
    mockWsService.connect = vi.fn()
    mockWsService.disconnect = vi.fn()
    mockWsService.subscribe = vi.fn().mockReturnValue(vi.fn())
    mockWsService.send = vi.fn()
    mockWsService.options = {}
    
    mockApiService.getFragments = vi.fn().mockResolvedValue([])
    mockApiService.getResolvedSpec = vi.fn().mockResolvedValue({
      resolved: {},
      spec_hash: 'test-hash'
    })
    mockApiService.getGaps = vi.fn().mockResolvedValue([])
    mockApiService.getAllIRs = vi.fn().mockResolvedValue({})
    
    mockToast.info = vi.fn()
    mockToast.success = vi.fn()
    mockToast.warning = vi.fn()
    mockToast.error = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('returns connection status and utilities', () => {
      const { result } = renderHook(() => useWebSocket('test-project'))
      
      expect(result.current).toEqual({
        isConnected: false,
        reconnectAttempts: 0,
        lastSync: null,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        send: expect.any(Function),
      })
    })

    it('does not connect when projectId is null', () => {
      renderHook(() => useWebSocket(null))
      
      expect(mockWsService.connect).not.toHaveBeenCalled()
    })

    it('connects to WebSocket when projectId is provided', () => {
      renderHook(() => useWebSocket('test-project'))
      
      expect(mockWsService.subscribe).toHaveBeenCalled()
      expect(mockWsService.connect).toHaveBeenCalledWith('test-project')
    })

    it('disconnects when projectId changes to null', () => {
      const { rerender } = renderHook(
        ({ projectId }) => useWebSocket(projectId),
        { initialProps: { projectId: 'test-project' } }
      )
      
      expect(mockWsService.connect).toHaveBeenCalledWith('test-project')
      
      rerender({ projectId: null })
      expect(mockWsService.disconnect).toHaveBeenCalled()
    })
  })

  describe('WebSocket event handling', () => {
    let eventHandler: (event: WsEvent) => void

    beforeEach(() => {
      mockWsService.subscribe.mockImplementation((handler) => {
        eventHandler = handler
        return vi.fn()
      })
    })

    it('handles fragment_updated events', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const fragmentEvent: WsEvent = {
        type: 'fragment_updated',
        data: {
          operation: 'created',
          fragment: {
            id: 'test-fragment',
            filename: 'test.cue',
            content: 'test content',
            updated_at: '2023-01-01T00:00:00Z'
          }
        },
        user: 'test-user',
        timestamp: '2023-01-01T00:00:00Z'
      }
      
      act(() => {
        eventHandler(fragmentEvent)
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'UPDATE_FRAGMENT',
        payload: fragmentEvent.data.fragment
      })
    })

    it('handles resolved_updated events', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const resolvedEvent: WsEvent = {
        type: 'resolved_updated',
        data: {
          resolved: { test: 'data' },
          spec_hash: 'new-hash'
        },
        user: 'test-user',
        timestamp: '2023-01-01T00:00:00Z'
      }
      
      act(() => {
        eventHandler(resolvedEvent)
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_RESOLVED',
        payload: {
          resolved: { test: 'data' },
          specHash: 'new-hash'
        }
      })
    })

    it('handles gaps_updated events', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const gapsEvent: WsEvent = {
        type: 'gaps_updated',
        data: {
          gaps: [{ type: 'missing_field', message: 'Field is required' }],
          spec_hash: 'gaps-hash'
        },
        user: 'test-user',
        timestamp: '2023-01-01T00:00:00Z'
      }
      
      act(() => {
        eventHandler(gapsEvent)
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_GAPS',
        payload: gapsEvent.data.gaps
      })
    })

    it('handles ir_updated events', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const irEvent: WsEvent = {
        type: 'ir_updated',
        data: {
          kind: 'flow',
          data: { flows: [] }
        },
        user: 'test-user',
        timestamp: '2023-01-01T00:00:00Z'
      }
      
      act(() => {
        eventHandler(irEvent)
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_IR',
        payload: {
          kind: 'flow',
          data: {
            kind: 'flow',
            data: { flows: [] },
            generated_at: expect.any(String)
          }
        }
      })
    })

    it('shows toast notifications for events from other users', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const event: WsEvent = {
        type: 'fragment_updated',
        data: { operation: 'created', fragment: {} as any },
        user: 'other-user',
        timestamp: '2023-01-01T12:00:00Z'
      }
      
      act(() => {
        eventHandler(event)
      })
      
      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated by other-user'),
        expect.any(Object)
      )
    })

    it('does not show toast for current user events', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const event: WsEvent = {
        type: 'fragment_updated',
        data: { operation: 'created', fragment: {} as any },
        user: 'current_user',
        timestamp: '2023-01-01T12:00:00Z'
      }
      
      act(() => {
        eventHandler(event)
      })
      
      expect(mockToast.info).not.toHaveBeenCalled()
    })

    it('disables toast notifications when showToastNotifications is false', () => {
      renderHook(() => useWebSocket('test-project', { showToastNotifications: false }))
      
      const event: WsEvent = {
        type: 'fragment_updated',
        data: { operation: 'created', fragment: {} as any },
        user: 'other-user',
        timestamp: '2023-01-01T12:00:00Z'
      }
      
      act(() => {
        eventHandler(event)
      })
      
      expect(mockToast.info).not.toHaveBeenCalled()
    })

    it('warns about unknown event types', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      renderHook(() => useWebSocket('test-project'))
      
      const unknownEvent = {
        type: 'unknown_event',
        data: {},
        user: 'test-user',
        timestamp: '2023-01-01T00:00:00Z'
      } as any
      
      act(() => {
        eventHandler(unknownEvent)
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown WebSocket event type:', 'unknown_event')
      consoleSpy.mockRestore()
    })
  })

  describe('connection callbacks', () => {
    it('handles connection success', () => {
      renderHook(() => useWebSocket('test-project'))
      
      // Access the callback that was set on the options object
      const onConnect = mockWsService.options.onConnect!
      
      act(() => {
        onConnect()
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_CONNECTION_STATUS',
        payload: true
      })
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'RESET_RECONNECT_ATTEMPTS'
      })
      expect(mockToast.success).toHaveBeenCalledWith(
        'Connected to real-time updates',
        expect.any(Object)
      )
    })

    it('handles disconnection', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const onDisconnect = mockWsService.options.onDisconnect!
      
      act(() => {
        onDisconnect()
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_CONNECTION_STATUS',
        payload: false
      })
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Lost connection, attempting to reconnect...',
        expect.any(Object)
      )
    })

    it('handles reconnection attempts', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const onReconnect = mockWsService.options.onReconnect!
      
      act(() => {
        onReconnect(3)
      })
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INCREMENT_RECONNECT_ATTEMPTS'
      })
      expect(mockToast.info).toHaveBeenCalledWith(
        'Reconnecting... (attempt 3)',
        expect.any(Object)
      )
    })

    it('handles WebSocket errors', () => {
      renderHook(() => useWebSocket('test-project'))
      
      const onError = mockWsService.options.onError!
      const errorEvent = new Event('error')
      
      act(() => {
        onError(errorEvent)
      })
      
      expect(mockSetError).toHaveBeenCalledWith('WebSocket connection error')
      expect(mockToast.error).toHaveBeenCalledWith(
        'WebSocket connection error',
        expect.any(Object)
      )
    })
  })

  describe('manual controls', () => {
    it('provides manual connect method', () => {
      const { result } = renderHook(() => useWebSocket('test-project'))
      
      act(() => {
        result.current.connect()
      })
      
      expect(mockWsService.connect).toHaveBeenCalledWith('test-project')
    })

    it('provides manual disconnect method', () => {
      const { result } = renderHook(() => useWebSocket('test-project'))
      
      act(() => {
        result.current.disconnect()
      })
      
      expect(mockWsService.disconnect).toHaveBeenCalled()
    })

    it('provides send method', () => {
      const { result } = renderHook(() => useWebSocket('test-project'))
      const message = { type: 'test', data: {} }
      
      act(() => {
        result.current.send(message)
      })
      
      expect(mockWsService.send).toHaveBeenCalledWith(message)
    })
  })

  describe('options', () => {
    it('respects autoReconnect option', () => {
      let onDisconnect: () => void = () => {}
      
      mockWsService.subscribe.mockImplementation(() => {
        setTimeout(() => {
          onDisconnect = mockWsService.options.onDisconnect!
        }, 0)
        return vi.fn()
      })
      
      renderHook(() => useWebSocket('test-project', { autoReconnect: false }))
      
      act(() => {
        onDisconnect()
      })
      
      // Should not show reconnection toast when autoReconnect is false
      expect(mockToast.warning).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('cleans up on unmount', () => {
      const unsubscribe = vi.fn()
      mockWsService.subscribe.mockReturnValue(unsubscribe)
      
      const { unmount } = renderHook(() => useWebSocket('test-project'))
      
      unmount()
      
      expect(unsubscribe).toHaveBeenCalled()
      expect(mockWsService.disconnect).toHaveBeenCalled()
    })

    it('cleans up when project changes', () => {
      const unsubscribe = vi.fn()
      mockWsService.subscribe.mockReturnValue(unsubscribe)
      
      const { rerender } = renderHook(
        ({ projectId }) => useWebSocket(projectId),
        { initialProps: { projectId: 'project-1' } }
      )
      
      rerender({ projectId: 'project-2' })
      
      expect(unsubscribe).toHaveBeenCalled()
      expect(mockWsService.disconnect).toHaveBeenCalled()
      expect(mockWsService.connect).toHaveBeenCalledWith('project-2')
    })
  })
})