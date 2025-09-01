/**
 * Complete Design System Showcase
 * Comprehensive demonstration of the design system in action with real-world component combinations
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { 
  Save, 
  Download, 
  Upload, 
  Play, 
  Pause, 
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  Filter,
  MoreHorizontal,
  Edit3,
  Trash2,
  Copy
} from 'lucide-react';

// Import all design system components
import Button from './Button';
import Card from './Card';
import Input from './Input';
import Select from './Select';
import Checkbox from './Checkbox';
import Radio from './Radio';
import Dialog from './Dialog';
import Modal from './Modal';
import Toast from './Toast';
import StatusBadge from './StatusBadge';
import Tabs from './Tabs';
import NavItem from './NavItem';

const meta = {
  title: 'Design System/Complete Showcase',
  component: Card, // Use Card as the wrapper component
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Real-world examples showing the complete design system in action with complex component combinations and realistic developer tool interfaces.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// COMPLEX COMPONENT COMPOSITIONS
// ============================================================================

const ProjectDashboard = () => {
  const [selectedProject, setSelectedProject] = useState('ecommerce-api');
  const [activeTab, setActiveTab] = useState('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const projects = [
    { id: 'ecommerce-api', name: 'E-commerce API Platform', status: 'active' },
    { id: 'banking-services', name: 'Banking Microservices', status: 'building' },
    { id: 'auth-service', name: 'Authentication Service', status: 'error' },
    { id: 'payment-gateway', name: 'Payment Gateway', status: 'inactive' },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'specifications', label: 'Specifications' },
    { id: 'diagrams', label: 'Diagrams' },
    { id: 'validation', label: 'Validation' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Arbiter Projects</h1>
            <p className="text-gray-600">Manage your CUE specifications and visualizations</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" leftIcon={<Settings />} onClick={() => setShowSettings(true)}>
              Settings
            </Button>
            <Button size="sm" leftIcon={<Upload />}>Import CUE</Button>
            <Button variant="primary" size="sm" leftIcon={<Play />}>New Project</Button>
          </div>
        </div>
        
        {/* Search and Filter Bar */}
        <Card>
          <div className="flex items-center gap-4 p-4">
            <div className="flex-1">
              <Input
                placeholder="Search projects..."
                leftIcon={<Search />}
                className="w-full"
              />
            </div>
            <Select
              value={selectedProject}
              onValueChange={setSelectedProject}
              placeholder="Filter by status"
              options={[
                { value: 'all', label: 'All Projects' },
                { value: 'active', label: 'Active' },
                { value: 'building', label: 'Building' },
                { value: 'error', label: 'Has Errors' },
              ]}
            />
            <Button variant="ghost" size="sm" leftIcon={<Filter />}>
              Filters
            </Button>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Project List Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Projects</h3>
            </div>
            <div className="p-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedProject === project.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedProject(project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{project.name}</div>
                      <div className="text-xs text-gray-500 mt-1">Last updated 2h ago</div>
                    </div>
                    <StatusBadge
                      status={project.status as 'success' | 'warning' | 'error' | 'info'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Panel */}
        <div className="lg:col-span-3">
          <Card>
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Project Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="text-center">
                      <div className="p-4">
                        <div className="text-2xl font-bold text-blue-600">127</div>
                        <div className="text-sm text-gray-600">Capabilities</div>
                      </div>
                    </Card>
                    <Card className="text-center">
                      <div className="p-4">
                        <div className="text-2xl font-bold text-green-600">342</div>
                        <div className="text-sm text-gray-600">Endpoints</div>
                      </div>
                    </Card>
                    <Card className="text-center">
                      <div className="p-4">
                        <div className="text-2xl font-bold text-orange-600">23</div>
                        <div className="text-sm text-gray-600">Dependencies</div>
                      </div>
                    </Card>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Recent Activity</h4>
                    <div className="space-y-3">
                      {[
                        { action: 'Updated authentication specification', time: '2 hours ago', type: 'edit' },
                        { action: 'Generated architecture diagram', time: '4 hours ago', type: 'diagram' },
                        { action: 'Fixed validation errors in payment flow', time: '6 hours ago', type: 'fix' },
                        { action: 'Added new microservice capability', time: '1 day ago', type: 'add' },
                      ].map((activity, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Edit3 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-900">{activity.action}</div>
                            <div className="text-xs text-gray-500">{activity.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'specifications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">CUE Specifications</h4>
                    <Button size="sm" leftIcon={<Upload />}>Upload Spec</Button>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium text-gray-900">Name</th>
                          <th className="text-left p-3 text-sm font-medium text-gray-900">Status</th>
                          <th className="text-left p-3 text-sm font-medium text-gray-900">Last Modified</th>
                          <th className="text-left p-3 text-sm font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[
                          { name: 'product-catalog.cue', status: 'valid', modified: '2h ago' },
                          { name: 'user-authentication.cue', status: 'error', modified: '4h ago' },
                          { name: 'order-processing.cue', status: 'valid', modified: '1d ago' },
                        ].map((spec, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{spec.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <StatusBadge 
                                status={spec.status === 'valid' ? 'success' : 'error'}
                              />
                            </td>
                            <td className="p-3 text-sm text-gray-600">{spec.modified}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="xs" leftIcon={<Edit3 />}>Edit</Button>
                                <Button variant="ghost" size="xs" leftIcon={<Copy />}>Copy</Button>
                                <Button variant="ghost" size="xs" leftIcon={<Trash2 />}>Delete</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'diagrams' && (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">
                    <RefreshCw className="w-12 h-12 mx-auto mb-2" />
                    <p>Diagram visualization would appear here</p>
                  </div>
                  <Button leftIcon={<RefreshCw />}>Generate Diagrams</Button>
                </div>
              )}

              {activeTab === 'validation' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Validation Results</h4>
                    <Button size="sm" leftIcon={<RefreshCw />} onClick={() => setShowToast(true)}>
                      Run Validation
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-red-900">Schema Validation Error</div>
                        <div className="text-sm text-red-700">user-authentication.cue:42 - Required field 'email' is missing constraints</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-900">Potential Optimization</div>
                        <div className="text-sm text-yellow-700">Consider combining duplicate endpoint definitions in order-processing.cue</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-green-900">Validation Passed</div>
                        <div className="text-sm text-green-700">product-catalog.cue is valid and follows all best practices</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <Dialog
          title="Project Settings"
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <Input value={selectedProject} placeholder="Enter project name" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Options
              </label>
              <div className="space-y-2">
                <Checkbox label="Enable real-time validation" checked />
                <Checkbox label="Auto-generate diagrams on save" checked />
                <Checkbox label="Show detailed error messages" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="space-y-2">
                <Radio name="export" value="svg" label="SVG (Scalable Vector)" checked />
                <Radio name="export" value="png" label="PNG (Raster Image)" />
                <Radio name="export" value="pdf" label="PDF (Document)" />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowSettings(false)}>
                Save Settings
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message="Validation completed successfully!"
          type="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

// Form composition example
const SpecificationEditor = () => {
  const [formData, setFormData] = useState({
    name: 'user-authentication',
    description: 'User authentication and authorization service',
    version: '1.0.0',
    capability: 'AUTH1',
    endpoints: ['POST /login', 'POST /register', 'DELETE /logout'],
    dependencies: ['database', 'redis'],
    validationLevel: 'strict',
    exportFormat: 'json',
    enableRealTimeValidation: true,
    autoGenerateDocs: false,
  });

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CUE Specification Editor</h1>
        <p className="text-gray-600">Create and configure your CUE service specifications</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name *
                  </label>
                  <Input
                    value={formData.name}
                    placeholder="e.g. user-authentication"
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capability ID *
                  </label>
                  <Input
                    value={formData.capability}
                    placeholder="e.g. AUTH1"
                    onChange={(e) => setFormData({...formData, capability: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Input
                  value={formData.description}
                  placeholder="Describe what this service does..."
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Version
                  </label>
                  <Select
                    value={formData.version}
                    onValueChange={(value) => setFormData({...formData, version: value})}
                    options={[
                      { value: '1.0.0', label: '1.0.0' },
                      { value: '1.1.0', label: '1.1.0' },
                      { value: '2.0.0', label: '2.0.0' },
                    ]}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Validation Level
                  </label>
                  <Select
                    value={formData.validationLevel}
                    onValueChange={(value) => setFormData({...formData, validationLevel: value})}
                    options={[
                      { value: 'strict', label: 'Strict (All constraints)' },
                      { value: 'moderate', label: 'Moderate (Essential only)' },
                      { value: 'lenient', label: 'Lenient (Basic validation)' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Options
                </label>
                <div className="space-y-3">
                  <Checkbox
                    label="Enable real-time validation"
                    checked={formData.enableRealTimeValidation}
                    onChange={(checked) => setFormData({...formData, enableRealTimeValidation: checked})}
                  />
                  <Checkbox
                    label="Auto-generate documentation"
                    checked={formData.autoGenerateDocs}
                    onChange={(checked) => setFormData({...formData, autoGenerateDocs: checked})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="space-y-2">
                  <Radio 
                    name="format" 
                    value="json" 
                    label="JSON (Structured data)"
                    checked={formData.exportFormat === 'json'}
                    onChange={() => setFormData({...formData, exportFormat: 'json'})}
                  />
                  <Radio 
                    name="format" 
                    value="yaml" 
                    label="YAML (Human-readable)"
                    checked={formData.exportFormat === 'yaml'}
                    onChange={() => setFormData({...formData, exportFormat: 'yaml'})}
                  />
                  <Radio 
                    name="format" 
                    value="cue" 
                    label="CUE (Native format)"
                    checked={formData.exportFormat === 'cue'}
                    onChange={() => setFormData({...formData, exportFormat: 'cue'})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button variant="ghost">Cancel</Button>
                <Button variant="secondary" leftIcon={<Download />}>Save Draft</Button>
                <Button leftIcon={<Save />}>Create Specification</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Preview Panel */}
        <div>
          <Card>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Preview</h3>
            </div>
            <div className="p-4">
              <div className="space-y-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700">Name:</div>
                  <div className="text-gray-900">{formData.name || 'Unnamed service'}</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-700">Capability:</div>
                  <div className="text-gray-900">{formData.capability || 'Not set'}</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-700">Version:</div>
                  <div className="text-gray-900">{formData.version}</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-700">Description:</div>
                  <div className="text-gray-600 text-xs">{formData.description || 'No description provided'}</div>
                </div>

                <div>
                  <div className="font-medium text-gray-700">Configuration:</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span>Real-time validation</span>
                      <StatusBadge status={formData.enableRealTimeValidation ? 'success' : 'error'} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Auto-generate docs</span>
                      <StatusBadge status={formData.autoGenerateDocs ? 'success' : 'error'} />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Button size="sm" variant="ghost" fullWidth leftIcon={<RefreshCw />}>
                  Generate Preview
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STORY DEFINITIONS
// ============================================================================

export const CompleteProjectDashboard: Story = {
  render: () => <ProjectDashboard />,
  parameters: {
    docs: {
      description: {
        story: 'Complete project management dashboard showing the full design system in action. Includes navigation, data tables, forms, modals, tabs, search, filtering, and real-time status updates.',
      },
    },
  },
};

export const SpecificationEditorForm: Story = {
  render: () => <SpecificationEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Complex form interface demonstrating form components, validation, preview panels, and multi-step workflows. Shows how components work together in realistic editing scenarios.',
      },
    },
  },
};

// Component combination matrix
const ComponentMatrix = () => {
  return (
    <div className="p-6 space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Design System Component Matrix</h2>
        <p className="text-gray-600">All components working together in different combinations</p>
      </div>

      {/* Buttons + Cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Buttons in Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="p-4 text-center">
              <h4 className="font-medium mb-2">Primary Actions</h4>
              <div className="space-y-2">
                <Button fullWidth leftIcon={<Save />}>Save Project</Button>
                <Button fullWidth variant="secondary" leftIcon={<Download />}>Export</Button>
              </div>
            </div>
          </Card>
          
          <Card>
            <div className="p-4 text-center">
              <h4 className="font-medium mb-2">Status Actions</h4>
              <div className="space-y-2">
                <Button fullWidth variant="primary" loading>Processing...</Button>
                <Button fullWidth variant="ghost" leftIcon={<RefreshCw />}>Refresh</Button>
              </div>
            </div>
          </Card>
          
          <Card>
            <div className="p-4 text-center">
              <h4 className="font-medium mb-2">Destructive Actions</h4>
              <div className="space-y-2">
                <Button fullWidth variant="danger" leftIcon={<Trash2 />}>Delete</Button>
                <Button fullWidth variant="ghost" disabled>Disabled</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Forms + Status */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Forms with Status Indicators</h3>
        <Card>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                    <StatusBadge status="success" className="ml-2" />
                  </label>
                  <Input placeholder="Enter project name" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Type
                    <StatusBadge status="warning" className="ml-2" />
                  </label>
                  <Select
                    placeholder="Select service type"
                    options={[
                      { value: 'api', label: 'REST API' },
                      { value: 'grpc', label: 'gRPC Service' },
                      { value: 'graphql', label: 'GraphQL API' },
                    ]}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Configuration
                  </label>
                  <div className="space-y-2">
                    <Checkbox label="Enable authentication" checked />
                    <Checkbox label="Enable rate limiting" />
                    <Checkbox label="Enable caching" checked />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level
                  </label>
                  <div className="space-y-2">
                    <Radio name="priority" value="high" label="High Priority" checked />
                    <Radio name="priority" value="medium" label="Medium Priority" />
                    <Radio name="priority" value="low" label="Low Priority" />
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button fullWidth leftIcon={<CheckCircle />}>
                    Create Service
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation + Content */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Navigation with Content</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="p-2">
              <div className="space-y-1">
                <NavItem active>Dashboard</NavItem>
                <NavItem>Projects</NavItem>
                <NavItem>Specifications</NavItem>
                <NavItem>Diagrams</NavItem>
                <NavItem>Settings</NavItem>
              </div>
            </div>
          </Card>
          
          <div className="md:col-span-3">
            <Card>
              <div className="p-6">
                <Tabs
                  tabs={[
                    { id: 'overview', label: 'Overview' },
                    { id: 'details', label: 'Details' },
                    { id: 'history', label: 'History' },
                  ]}
                  activeTab="overview"
                  onTabChange={() => {}}
                />
                <div className="mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">24</div>
                      <div className="text-sm text-blue-700">Active Projects</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">156</div>
                      <div className="text-sm text-green-700">Specifications</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ComponentCombinationMatrix: Story = {
  render: () => <ComponentMatrix />,
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive matrix showing how all design system components work together in different combinations and contexts.',
      },
    },
  },
};