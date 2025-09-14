/**
 * Custom hook for managing webhook handlers data
 * Provides CRUD operations, caching, and real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { apiService } from '../services/api';
import type { 
  WebhookHandler, 
  CreateHandlerRequest, 
  UpdateHandlerRequest 
} from '../types/api';
import { createLogger } from '../utils/logger';

const log = createLogger('useHandlers');

interface UseHandlersResult {
  handlers: WebhookHandler[];
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  loadHandlers: () => Promise<void>;
  createHandler: (request: CreateHandlerRequest) => Promise<WebhookHandler>;
  updateHandler: (id: string, request: UpdateHandlerRequest) => Promise<WebhookHandler>;
  deleteHandler: (id: string) => Promise<void>;
  toggleHandler: (id: string, enabled: boolean) => Promise<WebhookHandler>;
  
  // Utility functions
  getHandler: (id: string) => WebhookHandler | undefined;
  refreshHandler: (id: string) => Promise<void>;
}

export function useHandlers(): UseHandlersResult {
  const [handlers, setHandlers] = useState<WebhookHandler[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of loading state to prevent concurrent requests
  const loadingRef = useRef(false);

  // Load handlers from API
  const loadHandlers = useCallback(async () => {
    if (loadingRef.current) return; // Prevent concurrent requests
    
    try {
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      const handlersData = await apiService.getHandlers();
      setHandlers(handlersData);
      
      log.debug('Loaded handlers:', handlersData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load handlers';
      setError(message);
      log.error('Failed to load handlers:', err);
      toast.error(message);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Create a new handler
  const createHandler = useCallback(async (request: CreateHandlerRequest): Promise<WebhookHandler> => {
    try {
      const newHandler = await apiService.createHandler(request);
      
      setHandlers(prev => [...prev, newHandler]);
      toast.success('Handler created successfully');
      
      log.debug('Created handler:', newHandler);
      return newHandler;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create handler';
      log.error('Failed to create handler:', err);
      toast.error(message);
      throw err;
    }
  }, []);

  // Update an existing handler
  const updateHandler = useCallback(async (id: string, request: UpdateHandlerRequest): Promise<WebhookHandler> => {
    try {
      const updatedHandler = await apiService.updateHandler(id, request);
      
      setHandlers(prev => prev.map(h => h.id === id ? updatedHandler : h));
      toast.success('Handler updated successfully');
      
      log.debug('Updated handler:', updatedHandler);
      return updatedHandler;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update handler';
      log.error('Failed to update handler:', err);
      toast.error(message);
      throw err;
    }
  }, []);

  // Delete a handler
  const deleteHandler = useCallback(async (id: string): Promise<void> => {
    const handler = handlers.find(h => h.id === id);
    if (!handler) {
      throw new Error('Handler not found');
    }

    try {
      await apiService.deleteHandler(id);
      
      setHandlers(prev => prev.filter(h => h.id !== id));
      toast.success(`Handler "${handler.name}" deleted successfully`);
      
      log.debug('Deleted handler:', id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete handler';
      log.error('Failed to delete handler:', err);
      toast.error(message);
      throw err;
    }
  }, [handlers]);

  // Toggle handler enabled/disabled state
  const toggleHandler = useCallback(async (id: string, enabled: boolean): Promise<WebhookHandler> => {
    try {
      const updatedHandler = await apiService.toggleHandler(id, enabled);
      
      setHandlers(prev => prev.map(h => h.id === id ? updatedHandler : h));
      toast.success(`Handler ${enabled ? 'enabled' : 'disabled'} successfully`);
      
      log.debug('Toggled handler:', updatedHandler);
      return updatedHandler;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle handler';
      log.error('Failed to toggle handler:', err);
      toast.error(message);
      throw err;
    }
  }, []);

  // Get a specific handler by ID
  const getHandler = useCallback((id: string): WebhookHandler | undefined => {
    return handlers.find(h => h.id === id);
  }, [handlers]);

  // Refresh a specific handler from the API
  const refreshHandler = useCallback(async (id: string): Promise<void> => {
    try {
      const refreshedHandler = await apiService.getHandler(id);
      setHandlers(prev => prev.map(h => h.id === id ? refreshedHandler : h));
      
      log.debug('Refreshed handler:', refreshedHandler);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh handler';
      log.error('Failed to refresh handler:', err);
      toast.error(message);
      throw err;
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadHandlers();
  }, [loadHandlers]);

  return {
    handlers,
    isLoading,
    error,
    
    // CRUD operations
    loadHandlers,
    createHandler,
    updateHandler,
    deleteHandler,
    toggleHandler,
    
    // Utility functions
    getHandler,
    refreshHandler,
  };
}

export default useHandlers;