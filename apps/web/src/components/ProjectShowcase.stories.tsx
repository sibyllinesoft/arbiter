/**
 * Project Showcase Stories
 * Comprehensive demonstration of Arbiter's developer tool interface
 * Shows complete workflows and component integration
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  Save, Download, Play, Pause, Settings, Search, Bell, User,
  GitBranch, Database, Shield, Globe, Code, FileText, Terminal,
  Activity, Clock, CheckCircle, AlertTriangle, XCircle,
  Folder, Eye, Edit, Trash2, Plus, ArrowRight, Home, Monitor
} from 'lucide-react';

// Import components
import Button from '../design-system/components/Button';
import Card from '../design-system/components/Card';
import StatusBadge from '../design-system/components/StatusBadge';
import Input from '../design-system/components/Input';
import Tabs from '../design-system/components/Tabs';
import NavItem from '../design-system/components/NavItem';
import Breadcrumbs from '../design-system/components/Breadcrumbs';

// Import layout components
import TopBar from './Layout/TopBar';
import SplitPane from './Layout/SplitPane';
import ProjectBrowser from './Layout/ProjectBrowser';

// Import editor components  
import FileTree from './Editor/FileTree';
import MonacoEditor from './Editor/MonacoEditor';
import EditorPane from './Editor/EditorPane';

// Import realistic data
import { storybookData } from '../test/storybook-data';

const meta = {
  title: 'Project/Complete Showcase',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# Arbiter - Complete Developer Tool Showcase

This showcase demonstrates the complete Arbiter interface with all components working together 
to provide a professional specification workbench experience.

## Featured Components

- **Navigation**: TopBar with project navigation and user controls
- **Layout**: SplitPane layouts for flexible workspace organization  
- **Project Management**: ProjectBrowser with realistic project data
- **File Management**: FileTree with hierarchical file organization
- **Code Editing**: Monaco editor with syntax highlighting and validation
- **Status Monitoring**: Real-time build status and system health
- **Team Collaboration**: User presence and activity indicators

## Key Features

- **Real-time Collaboration**: Live editing with user presence
- **Specification Validation**: Continuous validation with error reporting  
- **Build Pipeline Integration**: CI/CD status and deployment tracking
- **Professional UI**: Clean, minimal design optimized for developer workflows
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Complete application interface
export const CompleteInterface: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('editor');
    const [activeFile, setActiveFile] = useState('/specs/authentication.yml');
    const [sidebarExpanded, setSidebarExpanded] = useState(true);

    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        {/* Top Navigation */}
        <TopBar 
          projectName={storybookData.projects[0].name}
          user={storybookData.users.currentUser}
          onSave={() => console.log('Save clicked')}
          onExport={() => console.log('Export clicked')}
          buildStatus="success"
          hasUnsavedChanges={true}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Left Sidebar */}
          <div className={`${sidebarExpanded ? 'w-80' : 'w-12'} transition-all duration-200 bg-white border-r border-gray-200`}>
            <div className="h-full flex flex-col">
              {sidebarExpanded && (
                <>
                  {/* Project Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">{storybookData.projects[0].name}</h2>
                        <p className="text-sm text-gray-600">Specification Workbench</p>
                      </div>
                      <StatusBadge variant="success" size="xs" showDot>
                        Active
                      </StatusBadge>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="px-4 py-2 border-b border-gray-200">
                    <div className="flex space-x-1">
                      <button 
                        className={`px-3 py-2 text-sm rounded-md ${
                          activeTab === 'files' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        onClick={() => setActiveTab('files')}
                      >
                        Files
                      </button>
                      <button 
                        className={`px-3 py-2 text-sm rounded-md ${
                          activeTab === 'projects' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        onClick={() => setActiveTab('projects')}
                      >
                        Projects
                      </button>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-auto">
                    {activeTab === 'files' && (
                      <div className="p-4">
                        <FileTree
                          fragments={storybookData.fragments}
                          activeFragmentId={storybookData.fragments[0]?.id}
                          unsavedChanges={new Set([storybookData.fragments[0]?.id])}
                          onFileSelect={(fragmentId) => {
                            const fragment = storybookData.fragments.find(f => f.id === fragmentId);
                            if (fragment) {
                              setActiveFile(fragment.path);
                            }
                          }}
                        />
                      </div>
                    )}

                    {activeTab === 'projects' && (
                      <div className="p-4 space-y-3">
                        {storybookData.projects.map((project) => (
                          <Card
                            key={project.id}
                            variant="interactive"
                            size="sm"
                            onClick={() => console.log('Project selected:', project.name)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Code className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">{project.name}</div>
                                  <div className="text-xs text-gray-600">
                                    Updated {new Date(project.updated_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <StatusBadge variant="success" size="xs">
                                Active
                              </StatusBadge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Sidebar Toggle */}
              <div className="p-2 border-t border-gray-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarExpanded(!sidebarExpanded)}
                  className="w-full"
                >
                  {sidebarExpanded ? '←' : '→'}
                </Button>
              </div>
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col">
            {/* Editor Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {activeFile}
                  </span>
                  <div className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes" />
                </div>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 bg-gray-900">
              <MonacoEditor
                value={storybookData.code.yaml}
                language="yaml"
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  lineNumbers: 'on',
                  minimap: { enabled: true },
                  folding: true,
                  wordWrap: 'on',
                }}
                onChange={(value) => console.log('Editor changed:', value?.substring(0, 50))}
              />
            </div>
          </div>

          {/* Right Panel - Validation & Status */}
          <div className="w-80 bg-white border-l border-gray-200">
            <div className="h-full flex flex-col">
              {/* Panel Header */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Validation & Status</h3>
              </div>

              {/* Status Overview */}
              <div className="p-4 border-b border-gray-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Build Status</span>
                    <StatusBadge variant="success" size="xs" icon={<CheckCircle />}>
                      Passed
                    </StatusBadge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Validation</span>
                    <StatusBadge variant="warning" size="xs" icon={<AlertTriangle />}>
                      2 Issues
                    </StatusBadge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Test Coverage</span>
                    <StatusBadge variant="success" size="xs">
                      98.5%
                    </StatusBadge>
                  </div>
                </div>
              </div>

              {/* Validation Issues */}
              <div className="flex-1 overflow-auto">
                <div className="p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Issues Found</h4>
                  <div className="space-y-3">
                    {storybookData.validation.errors.map((error, index) => (
                      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-900">
                              {error.type} Error
                            </p>
                            <p className="text-sm text-red-700 mt-1">
                              {error.message}
                            </p>
                            {error.location && (
                              <p className="text-xs text-red-600 mt-1 font-mono">
                                {error.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {storybookData.validation.warnings.map((warning, index) => (
                      <div key={index} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-900">
                              {warning.type} Warning
                            </p>
                            <p className="text-sm text-amber-700 mt-1">
                              {warning.message}
                            </p>
                            {warning.location && (
                              <p className="text-xs text-amber-600 mt-1 font-mono">
                                {warning.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-gray-200">
                <div className="space-y-2">
                  <Button fullWidth leftIcon={<Play />}>
                    Run Validation
                  </Button>
                  <Button variant="secondary" fullWidth leftIcon={<Download />}>
                    Export Report
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-gray-800 text-white px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span>Ready</span>
              <span>•</span>
              <span>Line 42, Column 12</span>
              <span>•</span>
              <span>YAML</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {storybookData.users.teamMembers.slice(0, 3).map((user) => (
                  <div key={user.id} className="flex items-center gap-1">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-5 h-5 rounded-full border border-white"
                      title={`${user.name} is ${user.status}`}
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
### Complete Arbiter Interface

This story demonstrates the complete Arbiter specification workbench interface with all components 
working together in a realistic development scenario.

**Key Features Shown:**
- **Professional Layout**: Multi-panel interface optimized for developer workflows
- **File Management**: Hierarchical file tree with realistic project structure  
- **Code Editing**: Syntax-highlighted YAML editing with validation
- **Real-time Validation**: Live error detection and reporting
- **Team Collaboration**: User presence indicators and collaborative features
- **Status Monitoring**: Build status, test coverage, and system health
- **Responsive Design**: Collapsible panels and flexible layouts

**Realistic Data Integration:**
- Uses comprehensive mock data from \`storybookData\`
- Demonstrates actual project structures and file types
- Shows realistic validation errors and warnings
- Includes team member data and collaboration features

**Component Integration:**
- TopBar with project navigation and user controls
- SplitPane layouts for flexible workspace organization
- FileTree with hierarchical file organization  
- Monaco editor with professional code editing
- StatusBadge components for system status
- Card layouts for information display
        `,
      },
    },
  },
};

// Simplified dashboard view
export const DashboardView: Story = {
  render: () => (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopBar 
        projectName="Dashboard"
        user={storybookData.users.currentUser}
        onSave={() => {}}
        onExport={() => {}}
        buildStatus="success"
        showProjectActions={false}
      />

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Projects Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your specification projects and monitor system health</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" leftIcon={<Plus />}>
              New Project
            </Button>
            <Button leftIcon={<Settings />}>
              Settings
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card variant="elevated">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{storybookData.projects.length}</div>
                <div className="text-sm text-gray-600">Active Projects</div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Code className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card variant="elevated">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">23</div>
                <div className="text-sm text-gray-600">Specifications</div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card variant="elevated">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">98.5%</div>
                <div className="text-sm text-gray-600">Validation Pass</div>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </Card>

          <Card variant="elevated">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{storybookData.users.teamMembers.length + 1}</div>
                <div className="text-sm text-gray-600">Team Members</div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {storybookData.projects.map((project, index) => (
            <Card
              key={project.id}
              variant="interactive"
              onClick={() => console.log('Project clicked:', project.name)}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${
                      index === 0 ? 'bg-blue-100' : 
                      index === 1 ? 'bg-green-100' : 
                      index === 2 ? 'bg-purple-100' : 'bg-amber-100'
                    } rounded-lg flex items-center justify-center`}>
                      <Code className={`h-5 w-5 ${
                        index === 0 ? 'text-blue-600' : 
                        index === 1 ? 'text-green-600' : 
                        index === 2 ? 'text-purple-600' : 'text-amber-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-600">
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    variant={index === 0 ? 'success' : index === 1 ? 'pending' : index === 2 ? 'warning' : 'active'}
                    size="xs"
                  >
                    {index === 0 ? 'Active' : index === 1 ? 'Building' : index === 2 ? 'Issues' : 'Ready'}
                  </StatusBadge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Specifications:</span>
                    <span className="font-medium text-gray-900">{5 + index * 2}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Coverage:</span>
                    <span className="font-medium text-gray-900">{Math.round(85 + Math.random() * 15)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Contributors:</span>
                    <div className="flex -space-x-1">
                      {storybookData.users.teamMembers.slice(0, 3).map((user) => (
                        <img
                          key={user.id}
                          src={user.avatar}
                          alt={user.name}
                          className="w-5 h-5 rounded-full border border-white"
                          title={user.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" variant="ghost" leftIcon={<Eye />}>
                    View
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Edit />}>
                    Edit  
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Download />}>
                    Export
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Dashboard Overview

A simplified dashboard view showing project management and system overview capabilities.

**Features:**
- **Project Cards**: Interactive cards showing project status and metrics
- **Quick Stats**: Key performance indicators and system health
- **Team Integration**: User avatars and collaboration indicators  
- **Action Buttons**: Quick access to common project operations
        `,
      },
    },
  },
};