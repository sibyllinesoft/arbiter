import { useTheme } from '@/stores/ui-store';
import { Excalidraw } from '@excalidraw/excalidraw';
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from '@excalidraw/excalidraw/types/element/types';
import type { AppState } from '@excalidraw/excalidraw/types/types';
import { clsx } from 'clsx';
import { type FC, useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { IRResponse } from '../../types/api';

interface ViewDiagramProps {
  projectId: string;
  className?: string;
}

type WidgetType = 'button' | 'input' | 'table';

interface Widget {
  type: WidgetType;
  token: string;
  text?: string;
  label?: string;
  columns?: string[];
}

interface ViewNode {
  id: string;
  widgets: Widget[];
}

interface ViewIRData {
  specHash?: string;
  views: ViewNode[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];

const widgetTypes: readonly WidgetType[] = ['button', 'input', 'table'] as const;

const normalizeWidget = (value: unknown, index: number): Widget | null => {
  if (!isRecord(value)) {
    return null;
  }

  const typeValue =
    isString(value.type) && widgetTypes.includes(value.type as WidgetType)
      ? (value.type as WidgetType)
      : 'button';
  const token = isString(value.token) ? value.token : `widget_${index}`;
  const widget: Widget = {
    type: typeValue,
    token,
  };

  const text = isString(value.text) ? value.text : undefined;
  if (text !== undefined) {
    widget.text = text;
  }

  const label = isString(value.label) ? value.label : undefined;
  if (label !== undefined) {
    widget.label = label;
  }

  const columns = toStringArray(value.columns);
  if (columns.length > 0) {
    widget.columns = columns;
  }

  return widget;
};

const normalizeView = (value: unknown, index: number): ViewNode | null => {
  if (!isRecord(value)) {
    return null;
  }

  const idSource = value.id ?? value.name ?? `view_${index}`;
  const id = isString(idSource) ? idSource : `view_${index}`;
  const widgetsSource = value.widgets;
  const widgets = Array.isArray(widgetsSource)
    ? widgetsSource
        .map((widget, widgetIndex) => normalizeWidget(widget, widgetIndex))
        .filter((widget): widget is Widget => widget !== null)
    : [];

  const view: ViewNode = {
    id,
    widgets,
  };

  return view;
};

const normalizeViewData = (raw: unknown): ViewIRData => {
  if (!isRecord(raw)) {
    return { views: [] };
  }

  const viewsSource = raw['views'];
  const views = Array.isArray(viewsSource)
    ? viewsSource
        .map((view, index) => normalizeView(view, index))
        .filter((view): view is ViewNode => view !== null)
    : [];

  const viewData: ViewIRData = {
    views,
  };

  const specHash = isString(raw['specHash']) ? (raw['specHash'] as string) : undefined;
  if (specHash !== undefined) {
    viewData.specHash = specHash;
  }

  return viewData;
};

const ViewDiagram: FC<ViewDiagramProps> = ({ projectId, className = '' }) => {
  const { isDark } = useTheme();
  const [viewData, setViewData] = useState<ViewIRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excalidrawElements, setExcalidrawElements] = useState<ExcalidrawElement[]>([]);
  const viewBackgroundColor = isDark ? '#141821' : '#ffffff';

  useEffect(() => {
    if (!projectId) return;

    const loadViewData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response: IRResponse = await apiService.getIR(projectId, 'view');
        setViewData(normalizeViewData(response.data));
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

  const randomSeed = () => Math.floor(Math.random() * 1_000_000);

  const createCommonElementProps = () => ({
    id: generateElementId(),
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    groupIds: [] as string[],
    frameId: null,
    updated: Date.now(),
    link: null,
    locked: false,
  });

  const DEFAULT_LINE_HEIGHT = 1.25 as ExcalidrawTextElement['lineHeight'];

  const createButtonElement = (widget: Widget, x: number, y: number): ExcalidrawElement => {
    const text = widget.text || widget.token;
    const width = Math.max(100, text.length * 8 + 20);
    const height = 40;

    const base = createCommonElementProps();

    return {
      ...base,
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
      boundElements: null,
    } as unknown as ExcalidrawElement;
  };

  const createTextElement = (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color = '#ffffff'
  ): ExcalidrawElement => {
    const base = createCommonElementProps();

    return {
      ...base,
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
      boundElements: null,
      text,
      fontSize: 14,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: 14,
      containerId: null,
      originalText: text,
      lineHeight: DEFAULT_LINE_HEIGHT,
    } as unknown as ExcalidrawElement;
  };

  const createInputElement = (widget: Widget, x: number, y: number): ExcalidrawElement[] => {
    const label = widget.label || widget.token;
    const width = 200;
    const height = 40;

    const rectBase = createCommonElementProps();

    const inputRect = {
      ...rectBase,
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
      boundElements: null,
    } as unknown as ExcalidrawElement;

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
    const tableContainer = {
      ...createCommonElementProps(),
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
      boundElements: null,
    } as unknown as ExcalidrawElement;
    elements.push(tableContainer);

    // Header row background
    const headerBg = {
      ...createCommonElementProps(),
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
      boundElements: null,
    } as unknown as ExcalidrawElement;
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
      const divider = {
        ...createCommonElementProps(),
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
        points: [
          [0, 0],
          [0, tableHeight - 4],
        ],
        lastCommittedPoint: [0, tableHeight - 4],
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
      } as unknown as ExcalidrawElement;
      elements.push(divider);
    }

    // Row divider
    const rowDivider = {
      ...createCommonElementProps(),
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
      points: [
        [0, 0],
        [tableWidth - 4, 0],
      ],
      lastCommittedPoint: [tableWidth - 4, 0],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    } as unknown as ExcalidrawElement;
    elements.push(rowDivider);

    return elements;
  };

  const convertWidgetsToElements = (views: ViewIRData['views']): ExcalidrawElement[] => {
    if (!views || views.length === 0) return [];

    const elements: ExcalidrawElement[] = [];
    let currentY = 50;

    views.forEach(view => {
      // Add view title
      const viewTitle = createTextElement(`View: ${view.id}`, 50, currentY, 200, 30, '#111827');
      elements.push(viewTitle);
      currentY += 50;

      let currentX = 50;
      const rowHeight = 80;

      view.widgets.forEach(widget => {
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
            if (widgetElements.length > 0) {
              const firstElement = widgetElements[0];
              currentX += (firstElement as ExcalidrawElement).width + 20;
            }
            break;
        }

        if (widgetElements.length > 0) {
          elements.push(...widgetElements);
        }

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
      <div
        className={clsx(
          'flex h-full items-center justify-center bg-white text-gray-600 transition-colors dark:bg-graphite-950 dark:text-graphite-300',
          className
        )}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 dark:text-graphite-300">Loading view diagrams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={clsx(
          'flex h-full items-center justify-center bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200',
          className
        )}
      >
        <div className="text-center">
          <div className="mb-4 text-red-500 dark:text-red-300">
            <svg
              className="mx-auto h-12 w-12"
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
          <p className="font-medium text-red-700 dark:text-red-300">Error loading view diagram</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'h-full bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200',
        className
      )}
    >
      {viewData?.views && viewData.views.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-graphite-700 dark:bg-graphite-900">
          <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-50">View Diagrams</h3>
          <p className="text-sm text-gray-600 dark:text-graphite-300">
            Interactive wireframes showing UI widgets and tokens
          </p>
        </div>
      )}
      <div className="h-full bg-white transition-colors dark:bg-graphite-950">
        <Excalidraw
          key={isDark ? 'view-diagram-dark' : 'view-diagram-light'}
          initialData={{
            elements: excalidrawElements,
            appState: {
              viewBackgroundColor: viewBackgroundColor,
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
            } as unknown as Partial<AppState>,
          }}
          viewModeEnabled={false}
          zenModeEnabled={false}
          gridModeEnabled={false}
          theme={isDark ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
};

export default ViewDiagram;
