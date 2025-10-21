/**
 * Main Handlers Component
 * Manages webhook handlers with list, editor, and stats views
 */

import React, { useState, useCallback } from "react";
import type { WebhookHandler } from "../../types/api";
import HandlerEditor from "./HandlerEditor";
import HandlerStats from "./HandlerStats";
import HandlersErrorBoundary from "./HandlersErrorBoundary";
import HandlersList from "./HandlersList";

type ViewMode = "list" | "editor" | "stats";

export function Handlers() {
  const [currentView, setCurrentView] = useState<ViewMode>("list");
  const [selectedHandler, setSelectedHandler] = useState<WebhookHandler | null>(null);

  // Handle switching to editor view (new or edit)
  const handleEditHandler = useCallback((handler?: WebhookHandler) => {
    setSelectedHandler(handler || null);
    setCurrentView("editor");
  }, []);

  // Handle switching to stats view
  const handleViewStats = useCallback((handler: WebhookHandler) => {
    setSelectedHandler(handler);
    setCurrentView("stats");
  }, []);

  // Handle creating a new handler
  const handleCreateHandler = useCallback(() => {
    setSelectedHandler(null);
    setCurrentView("editor");
  }, []);

  // Handle returning to list view
  const handleBackToList = useCallback(() => {
    setSelectedHandler(null);
    setCurrentView("list");
  }, []);

  // Handle successful save from editor
  const handleSaveHandler = useCallback((handler: WebhookHandler) => {
    setSelectedHandler(handler);
    setCurrentView("list");
  }, []);

  return (
    <HandlersErrorBoundary
      fallbackTitle="Webhook Handlers Error"
      fallbackMessage="Failed to load the webhook handlers interface. This might be due to a connection issue or an internal error."
      onReset={() => {
        setCurrentView("list");
        setSelectedHandler(null);
      }}
    >
      <div className="h-full">
        {currentView === "list" && (
          <HandlersList
            onEditHandler={handleEditHandler}
            onViewStats={handleViewStats}
            onCreateHandler={handleCreateHandler}
          />
        )}

        {currentView === "editor" && (
          <HandlerEditor
            handler={selectedHandler}
            onSave={handleSaveHandler}
            onCancel={handleBackToList}
          />
        )}

        {currentView === "stats" && selectedHandler && (
          <HandlerStats handler={selectedHandler} onClose={handleBackToList} />
        )}
      </div>
    </HandlersErrorBoundary>
  );
}

export default Handlers;
