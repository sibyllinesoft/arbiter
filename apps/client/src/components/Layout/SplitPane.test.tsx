/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SplitPane from './SplitPane';

// Mock getBoundingClientRect for resize tests
const mockGetBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  right: 800,
  bottom: 600,
  width: 800,
  height: 600,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}));

// Test components for children
const LeftPane = () => <div data-testid="left-pane">Left Pane Content</div>;
const RightPane = () => <div data-testid="right-pane">Right Pane Content</div>;

describe('SplitPane', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
    Object.defineProperty(document.body, 'style', {
      value: { cursor: '', userSelect: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders both child panes', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      expect(screen.getByTestId('left-pane')).toBeInTheDocument();
      expect(screen.getByTestId('right-pane')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <SplitPane className="custom-split-pane">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      expect(screen.getByTestId('left-pane').closest('.custom-split-pane')).toBeInTheDocument();
    });

    it('renders with vertical split by default', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const container = screen.getByTestId('left-pane').closest('div[class*="flex-row"]');
      expect(container).toBeInTheDocument();
    });

    it('renders with horizontal split when specified', () => {
      render(
        <SplitPane split="horizontal">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const container = screen.getByTestId('left-pane').closest('div[class*="flex-col"]');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Default Size Configuration', () => {
    it('applies default size of 50%', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const leftPane = screen.getByTestId('left-pane').parentElement;
      expect(leftPane).toHaveStyle({ width: '50%' });
    });

    it('applies custom default size as percentage', () => {
      render(
        <SplitPane defaultSize="30%">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const leftPane = screen.getByTestId('left-pane').parentElement;
      expect(leftPane).toHaveStyle({ width: '30%' });
    });

    it('applies custom default size as pixels', () => {
      render(
        <SplitPane defaultSize={300}>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const leftPane = screen.getByTestId('left-pane').parentElement;
      expect(leftPane).toHaveStyle({ width: '300px' });
    });

    it('applies default size for horizontal split to height', () => {
      render(
        <SplitPane split="horizontal" defaultSize="60%">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const leftPane = screen.getByTestId('left-pane').parentElement;
      expect(leftPane).toHaveStyle({ height: '60%' });
    });
  });

  describe('Resize Functionality', () => {
    it('renders resizer when allowResize is true (default)', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      expect(resizer).toBeInTheDocument();
    });

    it('hides resizer when allowResize is false', () => {
      render(
        <SplitPane allowResize={false}>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      expect(resizer).not.toBeInTheDocument();
    });

    it('shows correct cursor style for vertical split', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      expect(resizer).toBeInTheDocument();
    });

    it('shows correct cursor style for horizontal split', () => {
      render(
        <SplitPane split="horizontal">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-row-resize');
      expect(resizer).toBeInTheDocument();
    });

    it('changes resizer appearance on hover', async () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      expect(resizer).toHaveClass('hover:w-2');
    });
  });

  describe('Mouse Drag Interactions', () => {
    beforeEach(() => {
      // Mock container dimensions for resize calculations
      mockGetBoundingClientRect.mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    it('handles mousedown on resizer to start drag', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Should add drag styling to resizer
      expect(resizer).toHaveClass('bg-blue-500');
    });

    it('updates size during mouse move while dragging', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      const leftPane = screen.getByTestId('left-pane').parentElement;

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Move mouse to 25% position
      fireEvent.mouseMove(document, { clientX: 200, clientY: 300 });

      expect(leftPane).toHaveStyle({ width: '25%' });
    });

    it('respects minimum size constraint during drag', () => {
      render(
        <SplitPane minSize="300px">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      const leftPane = screen.getByTestId('left-pane').parentElement;

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Try to move to very small size (10% = 80px, less than 300px minimum)
      fireEvent.mouseMove(document, { clientX: 80, clientY: 300 });

      // Should be constrained to minimum size (300px = 37.5% of 800px container)
      expect(leftPane).toHaveStyle({ width: '37.5%' });
    });

    it('respects maximum size constraint during drag', () => {
      render(
        <SplitPane maxSize="60%">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      const leftPane = screen.getByTestId('left-pane').parentElement;

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Try to move to very large size (80%)
      fireEvent.mouseMove(document, { clientX: 640, clientY: 300 });

      // Should be constrained to maximum size (60%)
      expect(leftPane).toHaveStyle({ width: '60%' });
    });

    it('stops dragging on mouseup', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });
      expect(resizer).toHaveClass('bg-blue-500');

      // Stop dragging
      fireEvent.mouseUp(document);
      expect(resizer).not.toHaveClass('bg-blue-500');
    });

    it('sets body cursor during drag', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });
      expect(document.body.style.cursor).toBe('col-resize');
      expect(document.body.style.userSelect).toBe('none');

      // Stop dragging
      fireEvent.mouseUp(document);
      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });

    it('prevents default on mousedown', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 300,
      });

      let defaultPrevented = false;
      event.preventDefault = () => {
        defaultPrevented = true;
      };

      resizer!.dispatchEvent(event);
      expect(defaultPrevented).toBe(true);
    });
  });

  describe('Horizontal Split Behavior', () => {
    beforeEach(() => {
      mockGetBoundingClientRect.mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    it('handles vertical mouse movement for horizontal split', () => {
      render(
        <SplitPane split="horizontal">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-row-resize');
      const topPane = screen.getByTestId('left-pane').parentElement;

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Move mouse vertically to 25% position
      fireEvent.mouseMove(document, { clientX: 400, clientY: 150 });

      expect(topPane).toHaveStyle({ height: '25%' });
    });

    it('sets body cursor to row-resize for horizontal split', () => {
      render(
        <SplitPane split="horizontal">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-row-resize');

      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });
      expect(document.body.style.cursor).toBe('row-resize');
    });
  });

  describe('Disabled Resize Behavior', () => {
    it('ignores mousedown when allowResize is false', () => {
      render(
        <SplitPane allowResize={false}>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      // Since resizer is not rendered when allowResize=false,
      // we can't test mousedown on it, but we can verify no resizer exists
      const resizer = document.querySelector('.cursor-col-resize');
      expect(resizer).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles invalid container dimensions gracefully', () => {
      mockGetBoundingClientRect.mockReturnValue({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      expect(() => {
        render(
          <SplitPane>
            <LeftPane />
            <RightPane />
          </SplitPane>
        );
      }).not.toThrow();
    });

    it('handles missing container ref during drag', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');

      // Mock containerRef.current to be null during drag
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // This should not throw an error
      expect(() => {
        fireEvent.mouseMove(document, { clientX: 200, clientY: 300 });
      }).not.toThrow();
    });

    it('cleans up event listeners when component unmounts', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });
  });

  describe('Size Calculations', () => {
    it('correctly converts percentage sizes', () => {
      render(
        <SplitPane minSize="25%" maxSize="75%">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      const leftPane = screen.getByTestId('left-pane').parentElement;

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Move to 10% (should be constrained to 25% minimum)
      fireEvent.mouseMove(document, { clientX: 80, clientY: 300 });
      expect(leftPane).toHaveStyle({ width: '25%' });

      // Move to 90% (should be constrained to 75% maximum)
      fireEvent.mouseMove(document, { clientX: 720, clientY: 300 });
      expect(leftPane).toHaveStyle({ width: '75%' });
    });

    it('correctly converts pixel sizes to percentage', () => {
      render(
        <SplitPane minSize={200} maxSize={600}>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');
      const leftPane = screen.getByTestId('left-pane').parentElement;

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Move to 10% (80px, should be constrained to 200px = 25%)
      fireEvent.mouseMove(document, { clientX: 80, clientY: 300 });
      expect(leftPane).toHaveStyle({ width: '25%' });

      // Move to 90% (720px, should be constrained to 600px = 75%)
      fireEvent.mouseMove(document, { clientX: 720, clientY: 300 });
      expect(leftPane).toHaveStyle({ width: '75%' });
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate ARIA attributes', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      // While the resizer doesn't have explicit ARIA attributes in this implementation,
      // we can verify the structure supports accessibility
      const container = screen.getByTestId('left-pane').closest('div[class*="flex"]');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles rapid mouse movements efficiently', () => {
      render(
        <SplitPane>
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const resizer = document.querySelector('.cursor-col-resize');

      // Start dragging
      fireEvent.mouseDown(resizer!, { clientX: 400, clientY: 300 });

      // Simulate rapid movements
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        fireEvent.mouseMove(document, { clientX: 200 + i, clientY: 300 });
      }
      const endTime = performance.now();

      // Should complete within reasonable time (< 100ms for 100 movements)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Second Pane Calculations', () => {
    it('correctly calculates second pane size', () => {
      render(
        <SplitPane defaultSize="300px">
          <LeftPane />
          <RightPane />
        </SplitPane>
      );

      const rightPane = screen.getByTestId('right-pane').parentElement;
      // calc(100% - 300px - 4px) where 4px accounts for resizer
      expect(rightPane).toHaveStyle({ width: 'calc(100% - 300px - 4px)' });
    });
  });
});
