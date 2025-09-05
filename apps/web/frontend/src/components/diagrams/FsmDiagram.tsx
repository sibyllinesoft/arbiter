import React, { useEffect, useState, useRef } from 'react';
import { createMachine, interpret } from 'xstate';
import { createActor } from 'xstate';
import { apiService } from '../../services/api';
import type { IRResponse } from '../../types/api';

interface FsmDiagramProps {
  projectId: string;
  className?: string;
}

interface FsmIRData {
  specHash: string;
  fsms: {
    id: string;
    initial: string;
    states: Record<string, {
      on?: Record<string, string>;
      type?: 'final' | 'compound' | 'parallel';
    }>;
  }[];
}

const FsmDiagram: React.FC<FsmDiagramProps> = ({ projectId, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fsmData, setFsmData] = useState<FsmIRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const loadFsmData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response: IRResponse = await apiService.getIR(projectId, 'fsm');
        setFsmData(response.data as FsmIRData);
      } catch (err) {
        console.error('Failed to load FSM data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load FSM diagram');
      } finally {
        setLoading(false);
      }
    };

    loadFsmData();
  }, [projectId]);

  const renderFsmAsSvg = (fsm: FsmIRData['fsms'][0]): string => {
    if (!fsm.states || Object.keys(fsm.states).length === 0) {
      return createEmptyFsmSvg();
    }

    const states = Object.keys(fsm.states);
    const { width, height } = calculateDimensions(states.length);
    
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px;">`;
    
    // Add definitions for arrowheads
    svg += `
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
        </marker>
        <marker id="startarrow" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#059669" />
        </marker>
      </defs>
    `;

    // Calculate positions for states in a circular layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    const statePositions: Record<string, { x: number; y: number }> = {};
    states.forEach((state, index) => {
      const angle = (2 * Math.PI * index) / states.length - Math.PI / 2;
      statePositions[state] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Draw transitions first (so they appear behind states)
    states.forEach(state => {
      const stateConfig = fsm.states[state];
      if (stateConfig.on) {
        Object.entries(stateConfig.on).forEach(([event, targetState]) => {
          if (statePositions[targetState]) {
            const from = statePositions[state];
            const to = statePositions[targetState];
            
            // Calculate edge points (not center-to-center)
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / distance;
            const unitY = dy / distance;
            
            const startX = from.x + unitX * 40;
            const startY = from.y + unitY * 40;
            const endX = to.x - unitX * 40;
            const endY = to.y - unitY * 40;
            
            // Draw curved line for self-loops
            if (state === targetState) {
              svg += `<path d="M ${from.x + 25} ${from.y - 25} Q ${from.x + 60} ${from.y - 60} ${from.x + 25} ${from.y + 25}" 
                      stroke="#374151" stroke-width="2" fill="none" marker-end="url(#arrowhead)" />`;
              svg += `<text x="${from.x + 45}" y="${from.y - 35}" fill="#374151" font-size="12" font-family="Inter, sans-serif">${event}</text>`;
            } else {
              svg += `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
                      stroke="#374151" stroke-width="2" marker-end="url(#arrowhead)" />`;
              
              // Add event label at midpoint
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;
              svg += `<text x="${midX}" y="${midY - 5}" fill="#374151" font-size="12" 
                      font-family="Inter, sans-serif" text-anchor="middle">${event}</text>`;
            }
          }
        });
      }
    });

    // Draw initial state indicator
    if (fsm.initial && statePositions[fsm.initial]) {
      const initial = statePositions[fsm.initial];
      svg += `<line x1="${initial.x - 60}" y1="${initial.y}" x2="${initial.x - 40}" y2="${initial.y}" 
              stroke="#059669" stroke-width="3" marker-end="url(#startarrow)" />`;
      svg += `<text x="${initial.x - 80}" y="${initial.y + 5}" fill="#059669" font-size="12" 
              font-family="Inter, sans-serif" text-anchor="middle">start</text>`;
    }

    // Draw states
    states.forEach(state => {
      const pos = statePositions[state];
      const stateConfig = fsm.states[state];
      const isInitial = state === fsm.initial;
      const isFinal = stateConfig.type === 'final';
      
      // Choose colors based on state type
      let fill = '#f9fafb';
      let stroke = '#d1d5db';
      
      if (isInitial) {
        fill = '#ecfdf5';
        stroke = '#059669';
      } else if (isFinal) {
        fill = '#fef2f2';
        stroke = '#dc2626';
      }
      
      // Draw state circle
      svg += `<circle cx="${pos.x}" cy="${pos.y}" r="35" fill="${fill}" stroke="${stroke}" stroke-width="2" />`;
      
      // Draw double circle for final states
      if (isFinal) {
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="28" fill="none" stroke="${stroke}" stroke-width="1" />`;
      }
      
      // Add state label
      svg += `<text x="${pos.x}" y="${pos.y + 5}" fill="#374151" font-size="12" 
              font-family="Inter, sans-serif" text-anchor="middle" font-weight="500">${state}</text>`;
    });

    svg += '</svg>';
    return svg;
  };

  const createEmptyFsmSvg = (): string => {
    return `<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
      <text x="200" y="150" fill="#9ca3af" font-size="16" font-family="Inter, sans-serif" text-anchor="middle">
        No FSM defined
      </text>
      <text x="200" y="170" fill="#9ca3af" font-size="12" font-family="Inter, sans-serif" text-anchor="middle">
        Add stateModels to your CUE spec
      </text>
    </svg>`;
  };

  const calculateDimensions = (stateCount: number): { width: number; height: number } => {
    const minSize = 400;
    const maxSize = 800;
    const scale = Math.min(1 + stateCount * 0.1, 2);
    
    return {
      width: Math.min(minSize * scale, maxSize),
      height: Math.min(minSize * scale, maxSize),
    };
  };

  useEffect(() => {
    if (fsmData && containerRef.current && !loading && !error) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      if (fsmData.fsms.length === 0) {
        containerRef.current.innerHTML = createEmptyFsmSvg();
        return;
      }

      // Create container for multiple FSMs
      fsmData.fsms.forEach((fsm, index) => {
        const fsmContainer = document.createElement('div');
        fsmContainer.className = 'mb-6 last:mb-0';
        
        // Add FSM title
        const title = document.createElement('h4');
        title.className = 'text-sm font-medium text-gray-700 mb-2';
        title.textContent = `FSM: ${fsm.id}`;
        fsmContainer.appendChild(title);
        
        // Add FSM diagram
        const diagramContainer = document.createElement('div');
        diagramContainer.className = 'flex justify-center';
        diagramContainer.innerHTML = renderFsmAsSvg(fsm);
        fsmContainer.appendChild(diagramContainer);
        
        containerRef.current?.appendChild(fsmContainer);
      });
    }
  }, [fsmData, loading, error]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading FSM diagrams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-700 font-medium">Error loading FSM diagram</p>
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
    <div className={`h-full overflow-auto ${className}`}>
      <div className="p-4">
        {fsmData?.fsms && fsmData.fsms.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">Finite State Machines</h3>
            <p className="text-sm text-gray-600">
              Showing {fsmData.fsms.length} FSM{fsmData.fsms.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        <div ref={containerRef} className="fsm-container" />
      </div>
    </div>
  );
};

export default FsmDiagram;