import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { AppState } from '@excalidraw/excalidraw/types/types';
import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { IRResponse } from '../../types/api';

interface ViewDiagramProps {
  projectId: string;
  className?: string;
}

interface Widget {
  type: 'button' | 'input' | 'table';
  token: string;
  text?: string;
  label?: string;
  columns?: string[];
}

interface ViewIRData {
  specHash: string;
  views: {
    id: string;
    widgets: Widget[];
  }[];
}

const ViewDiagram: React.FC<ViewDiagramProps> = ({ projectId, className = '' }) => {
  const [viewData, setViewData] = useState<ViewIRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excalidrawElements, setExcalidrawElements] = useState<ExcalidrawElement[]>([]);

  useEffect(() => {
    if (!projectId) return;

    const loadViewData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response: IRResponse = await apiService.getIR(projectId, 'view');
        setViewData(response.data as ViewIRData);
      } catch (err) {
        console.error('Failed to load view data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load view diagram');
      } finally {
        setLoading(false);
      }
    };

    loadViewData();
  }, [projectId]);

  const generateElementId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const createButtonElement = (widget: Widget, x: number, y: number): ExcalidrawElement => {
    const text = widget.text || widget.token;
    const width = Math.max(100, text.length * 8 + 20);
    const height = 40;

    return {
      id: generateElementId(),
      type: 'rectangle',
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: '#1e40af',
      backgroundColor: '#3b82f6',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3, value: 8 },
      seed: Math.floor(Math.random() * 1000000),
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: [
        {
          type: 'text',
          id: generateElementId(),
        },
      ],
      updated: 1,
      link: null,
      locked: false,
    };
  };

  const createTextElement = (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color = '#ffffff'
  ): ExcalidrawElement => {
    return {
      id: generateElementId(),
      type: 'text',
      x: x + width / 2,
      y: y + height / 2,
      width: width - 10,
      height: 20,
      angle: 0,
      strokeColor: color,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 1000000),
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      text: text,
      fontSize: 14,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: 14,
      containerId: null,
      originalText: text,
      lineHeight: 1.25,
    };
  };

  const createInputElement = (widget: Widget, x: number, y: number): ExcalidrawElement[] => {
    const label = widget.label || widget.token;
    const width = 200;
    const height = 40;

    const inputRect: ExcalidrawElement = {
      id: generateElementId(),
      type: 'rectangle',
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: '#6b7280',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3, value: 4 },
      seed: Math.floor(Math.random() * 1000000),
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    };

    const labelText = createTextElement(label, x - 120, y, 100, height, '#374151');

    return [inputRect, labelText];
  };

  const createTableElement = (widget: Widget, x: number, y: number): ExcalidrawElement[] => {
    const columns = widget.columns || ['Column 1', 'Column 2'];
    const columnWidth = 120;
    const headerHeight = 40;
    const rowHeight = 30;
    const tableWidth = columns.length * columnWidth;
    const tableHeight = headerHeight + rowHeight * 3; // Header + 3 data rows

    const elements: ExcalidrawElement[] = [];

    // Table container
    const tableContainer: ExcalidrawElement = {
      id: generateElementId(),
      type: 'rectangle',
      x,
      y,
      width: tableWidth,
      height: tableHeight,
      angle: 0,
      strokeColor: '#374151',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3, value: 4 },
      seed: Math.floor(Math.random() * 1000000),
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    };
    elements.push(tableContainer);

    // Header row background
    const headerBg: ExcalidrawElement = {
      id: generateElementId(),
      type: 'rectangle',
      x: x + 2,
      y: y + 2,
      width: tableWidth - 4,
      height: headerHeight - 4,
      angle: 0,
      strokeColor: 'transparent',
      backgroundColor: '#f3f4f6',
      fillStyle: 'solid',
      strokeWidth: 0,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3, value: 2 },
      seed: Math.floor(Math.random() * 1000000),
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    };
    elements.push(headerBg);

    // Column headers
    columns.forEach((column, index) => {
      const headerText = createTextElement(
        column,
        x + index * columnWidth,
        y,
        columnWidth,
        headerHeight,
        '#374151'
      );
      elements.push(headerText);
    });

    // Column dividers
    for (let i = 1; i < columns.length; i++) {
      const divider: ExcalidrawElement = {
        id: generateElementId(),
        type: 'line',
        x: x + i * columnWidth,
        y: y + 2,
        width: 0,
        height: tableHeight - 4,
        angle: 0,
        strokeColor: '#d1d5db',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1000000),
        versionNonce: Math.floor(Math.random() * 1000000),
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        points: [
          [0, 0],
          [0, tableHeight - 4],
        ],
        lastCommittedPoint: [0, tableHeight - 4],
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
      };
      elements.push(divider);
    }

    // Row divider
    const rowDivider: ExcalidrawElement = {
      id: generateElementId(),
      type: 'line',
      x: x + 2,
      y: y + headerHeight,
      width: tableWidth - 4,
      height: 0,
      angle: 0,
      strokeColor: '#d1d5db',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 1000000),
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [tableWidth - 4, 0],
      ],
      lastCommittedPoint: [tableWidth - 4, 0],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    };
    elements.push(rowDivider);

    return elements;
  };

  const convertWidgetsToElements = (views: ViewIRData['views']): ExcalidrawElement[] => {
    if (!views || views.length === 0) return [];

    const elements: ExcalidrawElement[] = [];
    let currentY = 50;

    views.forEach((view, viewIndex) => {
      // Add view title
      const viewTitle = createTextElement(`View: ${view.id}`, 50, currentY, 200, 30, '#111827');
      elements.push(viewTitle);
      currentY += 50;

      let currentX = 50;
      const rowHeight = 80;

      view.widgets.forEach((widget, widgetIndex) => {
        let widgetElements: ExcalidrawElement[] = [];

        switch (widget.type) {
          case 'button':
            const buttonElement = createButtonElement(widget, currentX, currentY);
            const buttonText = createTextElement(
              widget.text || widget.token,
              currentX,
              currentY,
              buttonElement.width,
              buttonElement.height,
              '#ffffff'
            );
            widgetElements = [buttonElement, buttonText];
            currentX += buttonElement.width + 20;
            break;

          case 'input':
            widgetElements = createInputElement(widget, currentX, currentY);
            currentX += 300;
            break;

          case 'table':
            widgetElements = createTableElement(widget, currentX, currentY);
            currentX += widgetElements[0].width + 20;
            break;
        }

        elements.push(...widgetElements);

        // Move to next row if needed
        if (currentX > 800) {
          currentX = 50;
          currentY += rowHeight;
        }
      });

      currentY += rowHeight + 30; // Space between views
    });

    return elements;
  };

  useEffect(() => {
    if (viewData && !loading && !error) {
      const elements = convertWidgetsToElements(viewData.views);
      setExcalidrawElements(elements);
    }
  }, [viewData, loading, error]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading view diagrams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-700 font-medium">Error loading view diagram</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full ${className}`}>
      {viewData?.views && viewData.views.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">View Diagrams</h3>
          <p className="text-sm text-gray-600">
            Interactive wireframes showing UI widgets and tokens
          </p>
        </div>
      )}
      <div className="h-full">
        <Excalidraw
          initialData={{
            elements: excalidrawElements,
            appState: {
              viewBackgroundColor: '#ffffff',
              currentItemStrokeColor: '#000000',
              currentItemBackgroundColor: 'transparent',
              currentItemFillStyle: 'solid',
              currentItemStrokeWidth: 2,
              currentItemStrokeStyle: 'solid',
              currentItemRoughness: 0,
              currentItemOpacity: 100,
              currentItemFontFamily: 1,
              currentItemFontSize: 20,
              currentItemTextAlign: 'left',
              currentItemStartArrowhead: null,
              currentItemEndArrowhead: 'arrow',
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 },
              currentItemRoundness: 'round',
              gridSize: null,
              colorPalette: {},
            } as Partial<AppState>,
          }}
          viewModeEnabled={false}
          zenModeEnabled={false}
          gridModeEnabled={false}
          theme="light"
        />
      </div>
    </div>
  );
};

export default ViewDiagram;
