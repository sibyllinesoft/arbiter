import type { Decorator } from '@storybook/react';
import React from 'react';

/**
 * Design System Context Decorator
 * Applies theme classes and design system context to all stories
 */
export const DesignSystemDecorator: Decorator = (Story, context) => {
  // Apply theme class based on toolbar selection
  const theme = context.globals.designSystem || 'default';
  const colorScheme = context.globals.colorScheme || 'light';

  return (
    <div
      className={`storybook-decorator ${theme} ${colorScheme}`}
      style={{
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        colorScheme: colorScheme,
        minHeight: '100vh',
        backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff',
        color: colorScheme === 'dark' ? '#f8fafc' : '#0f172a',
      }}
    >
      <Story />
    </div>
  );
};
