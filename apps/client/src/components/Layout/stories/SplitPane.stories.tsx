/**
 * SplitPane Component Stories
 * Comprehensive documentation for the resizable split pane component
 */

import type { Meta, StoryObj } from "@storybook/react";
import SplitPane from "./SplitPane";

const meta = {
  title: "Layout/SplitPane",
  component: SplitPane,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A resizable split pane component that allows dividing space between two child components. Supports both vertical and horizontal splitting with configurable constraints and smooth resizing.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    split: {
      control: { type: "select" },
      options: ["vertical", "horizontal"],
      description: "The split direction - vertical splits left/right, horizontal splits top/bottom",
    },
    defaultSize: {
      control: { type: "text" },
      description:
        'Default size of the first pane as percentage or pixels (e.g., "50%" or "300px")',
    },
    minSize: {
      control: { type: "text" },
      description: "Minimum size of the first pane",
    },
    maxSize: {
      control: { type: "text" },
      description: "Maximum size of the first pane",
    },
    allowResize: {
      control: { type: "boolean" },
      description: "Whether the pane can be resized by dragging the divider",
    },
    className: {
      control: { type: "text" },
      description: "Additional CSS classes",
    },
  },
} satisfies Meta<typeof SplitPane>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample content components for demonstrations
const SampleContent = ({
  title,
  color,
  content,
}: {
  title: string;
  color: string;
  content?: string;
}) => (
  <div className={`h-full flex flex-col ${color} p-4`}>
    <h3 className="font-semibold text-lg mb-2">{title}</h3>
    <div className="flex-1 overflow-auto">
      <p className="text-sm text-gray-700 mb-4">
        {content || "This is sample content to demonstrate the split pane layout."}
      </p>
      <div className="space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="p-2 bg-white/50 rounded border text-sm">
            Sample item {i + 1}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const FileTree = () => (
  <SampleContent
    title="File Explorer"
    color="bg-gray-50 border-r border-gray-200"
    content="A typical file tree navigation. Resize the pane to see how it adapts to different widths."
  />
);

const CodeEditor = () => (
  <SampleContent
    title="Code Editor"
    color="bg-white"
    content="Main editor area. This space expands and contracts as you resize the split pane divider."
  />
);

const TopPanel = () => (
  <SampleContent
    title="Top Panel"
    color="bg-blue-50 border-b border-blue-200"
    content="Header or toolbar area. Resize vertically to see how horizontal splits work."
  />
);

const BottomPanel = () => (
  <SampleContent
    title="Bottom Panel"
    color="bg-gray-50"
    content="Console, terminal, or details area. This demonstrates a horizontal split layout."
  />
);

// Default vertical split
export const Default: Story = {
  args: {
    children: [<FileTree key="left" />, <CodeEditor key="right" />],
  },
  parameters: {
    docs: {
      description: {
        story: "Default vertical split pane with 50% initial size. Drag the divider to resize.",
      },
    },
  },
};

// Horizontal split
export const Horizontal: Story = {
  args: {
    split: "horizontal",
    defaultSize: "200px",
    children: [<TopPanel key="top" />, <BottomPanel key="bottom" />],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Horizontal split pane dividing top and bottom areas. Useful for editor/console layouts.",
      },
    },
  },
};

// Custom default size
export const CustomDefaultSize: Story = {
  args: {
    defaultSize: "300px",
    children: [<FileTree key="left" />, <CodeEditor key="right" />],
  },
  parameters: {
    docs: {
      description: {
        story: "Split pane with a custom default size of 300px for the left panel.",
      },
    },
  },
};

// Percentage-based size
export const PercentageSize: Story = {
  args: {
    defaultSize: "25%",
    children: [<FileTree key="left" />, <CodeEditor key="right" />],
  },
  parameters: {
    docs: {
      description: {
        story: "Split pane using percentage-based sizing (25% for the left panel).",
      },
    },
  },
};

// With size constraints
export const WithConstraints: Story = {
  args: {
    defaultSize: "250px",
    minSize: "150px",
    maxSize: "500px",
    children: [<FileTree key="left" />, <CodeEditor key="right" />],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Split pane with minimum (150px) and maximum (500px) size constraints. Try resizing beyond these limits.",
      },
    },
  },
};

// Non-resizable
export const NonResizable: Story = {
  args: {
    allowResize: false,
    defaultSize: "250px",
    children: [<FileTree key="left" />, <CodeEditor key="right" />],
  },
  parameters: {
    docs: {
      description: {
        story: "Fixed split pane that cannot be resized. Notice the resizer is not interactive.",
      },
    },
  },
};

// Nested split panes
export const NestedSplitPanes: Story = {
  render: () => (
    <SplitPane defaultSize="250px" minSize="200px" maxSize="400px">
      <FileTree key="left" />
      <SplitPane key="right" split="horizontal" defaultSize="60%" minSize="40%" maxSize="80%">
        <CodeEditor key="top" />
        <SampleContent
          key="bottom"
          title="Terminal / Console"
          color="bg-gray-900 text-gray-100"
          content="Terminal output and debugging information. This demonstrates nested split panes."
        />
      </SplitPane>
    </SplitPane>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Nested split panes creating a three-panel layout: file tree (left), editor (top-right), and terminal (bottom-right).",
      },
    },
  },
};

// Real-world IDE layout
export const IDELayout: Story = {
  render: () => (
    <div className="h-96 w-full border border-gray-200 rounded-lg overflow-hidden">
      <SplitPane defaultSize="280px" minSize="200px" maxSize="60%">
        <div key="left" className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-100">
            <h3 className="font-semibold text-sm">Explorer</h3>
          </div>
          <div className="flex-1 p-2 space-y-1">
            <div className="text-xs text-gray-600 font-medium mb-2">PROJECT FILES</div>
            <div className="text-sm text-gray-700 pl-4 py-1 hover:bg-gray-100 rounded cursor-pointer">
              📁 src/
            </div>
            <div className="text-sm text-gray-700 pl-8 py-1 hover:bg-gray-100 rounded cursor-pointer">
              📄 App.tsx
            </div>
            <div className="text-sm text-gray-700 pl-8 py-1 hover:bg-gray-100 rounded cursor-pointer">
              📄 index.tsx
            </div>
            <div className="text-sm text-gray-700 pl-4 py-1 hover:bg-gray-100 rounded cursor-pointer">
              📁 components/
            </div>
            <div className="text-sm text-gray-700 pl-8 py-1 hover:bg-gray-100 rounded cursor-pointer">
              📄 Button.tsx
            </div>
            <div className="text-sm text-blue-600 pl-8 py-1 bg-blue-50 rounded font-medium cursor-pointer">
              📄 SplitPane.tsx
            </div>
          </div>
        </div>
        <SplitPane key="right" split="horizontal" defaultSize="70%" minSize="50%" maxSize="85%">
          <div key="editor" className="h-full bg-white flex flex-col">
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <span className="text-sm font-medium">SplitPane.tsx</span>
              <span className="text-xs text-gray-500">• Modified</span>
            </div>
            <div className="flex-1 p-4 font-mono text-sm bg-gray-50">
              <div className="text-gray-600">// SplitPane component implementation</div>
              <div className="text-purple-600">import React from 'react';</div>
              <div className="text-gray-600 mt-2">export function SplitPane(props) {"{"}</div>
              <div className="text-gray-400 pl-4">// Component logic here...</div>
              <div className="text-gray-600">{"}"}</div>
            </div>
          </div>
          <div key="terminal" className="h-full bg-gray-900 text-gray-100 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
              <span className="text-sm font-medium">Terminal</span>
            </div>
            <div className="flex-1 p-4 font-mono text-sm">
              <div className="text-green-400">$ npm run dev</div>
              <div className="text-gray-400">Starting development server...</div>
              <div className="text-gray-400">Server running on http://localhost:3000</div>
              <div className="text-green-400">$</div>
            </div>
          </div>
        </SplitPane>
      </SplitPane>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "A realistic IDE layout using nested split panes: file explorer on the left, code editor on the top-right, and terminal on the bottom-right.",
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    split: "vertical",
    defaultSize: "50%",
    minSize: "200px",
    maxSize: "80%",
    allowResize: true,
    children: [<FileTree key="left" />, <CodeEditor key="right" />],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive playground to experiment with all SplitPane props. Use the controls panel to adjust settings and see live changes.",
      },
    },
  },
};
