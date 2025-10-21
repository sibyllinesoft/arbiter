import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import ProjectBrowser, { type Project } from "./ProjectBrowser";

const meta: Meta<typeof ProjectBrowser> = {
  title: "Layout/ProjectBrowser",
  component: ProjectBrowser,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Professional project browser with card-based layout, search, filtering, and project management actions. Perfect for specification workbenches and development environments.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ProjectBrowser>;

// Sample project data
const sampleProjects: Project[] = [
  {
    id: "1",
    name: "User Authentication API",
    description:
      "Complete authentication service specification with OAuth2, JWT tokens, and role-based access control.",
    status: "active",
    lastModified: "2024-01-15T10:30:00Z",
    fragmentCount: 12,
    collaborators: ["alice@company.com", "bob@company.com"],
    starred: true,
    validationStatus: "valid",
    tags: ["auth", "api", "security"],
  },
  {
    id: "2",
    name: "Payment Processing",
    description:
      "Multi-currency payment gateway with support for credit cards, digital wallets, and bank transfers.",
    status: "active",
    lastModified: "2024-01-14T16:45:00Z",
    fragmentCount: 8,
    collaborators: ["charlie@company.com"],
    starred: false,
    validationStatus: "warnings",
    tags: ["payments", "fintech", "api"],
  },
  {
    id: "3",
    name: "Content Management System",
    description:
      "Headless CMS with flexible content types, media management, and multi-language support.",
    status: "draft",
    lastModified: "2024-01-13T09:15:00Z",
    fragmentCount: 15,
    collaborators: ["david@company.com", "eve@company.com", "frank@company.com"],
    starred: false,
    validationStatus: "pending",
    tags: ["cms", "content", "headless"],
  },
  {
    id: "4",
    name: "Analytics Dashboard",
    description:
      "Real-time analytics and reporting dashboard with custom metrics and data visualization components.",
    status: "active",
    lastModified: "2024-01-12T14:20:00Z",
    fragmentCount: 6,
    collaborators: ["grace@company.com"],
    starred: true,
    validationStatus: "valid",
    tags: ["analytics", "dashboard", "realtime"],
  },
  {
    id: "5",
    name: "Notification Service",
    description:
      "Multi-channel notification system supporting email, SMS, push notifications, and webhooks.",
    status: "archived",
    lastModified: "2024-01-10T11:00:00Z",
    fragmentCount: 4,
    collaborators: ["henry@company.com"],
    starred: false,
    validationStatus: "valid",
    tags: ["notifications", "email", "sms"],
  },
  {
    id: "6",
    name: "Legacy Migration",
    description: "Database migration and API modernization project for legacy enterprise systems.",
    status: "error",
    lastModified: "2024-01-11T08:30:00Z",
    fragmentCount: 23,
    collaborators: ["ian@company.com", "jane@company.com"],
    starred: false,
    validationStatus: "errors",
    tags: ["migration", "legacy", "database"],
  },
  {
    id: "7",
    name: "Mobile App Backend",
    description:
      "Scalable backend services for iOS and Android applications with offline sync capabilities.",
    status: "draft",
    lastModified: "2024-01-09T15:45:00Z",
    fragmentCount: 9,
    collaborators: ["kelly@company.com"],
    starred: true,
    validationStatus: "warnings",
    tags: ["mobile", "backend", "sync"],
  },
  {
    id: "8",
    name: "E-commerce Platform",
    description:
      "Complete e-commerce solution with inventory management, order processing, and customer service tools.",
    status: "active",
    lastModified: "2024-01-08T13:10:00Z",
    fragmentCount: 31,
    collaborators: ["leo@company.com", "mia@company.com", "noah@company.com", "olivia@company.com"],
    starred: false,
    validationStatus: "valid",
    tags: ["ecommerce", "retail", "inventory"],
  },
];

export const Default: Story = {
  render: () => {
    const [selectedProject, setSelectedProject] = useState<Project | undefined>();
    const [projects, setProjects] = useState(sampleProjects);

    const handleToggleStar = (project: Project) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, starred: !p.starred } : p)),
      );
    };

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          onCreateProject={() => alert("Create new project")}
          onEditProject={(project) => alert(`Edit project: ${project.name}`)}
          onDeleteProject={(project) => alert(`Delete project: ${project.name}`)}
          onToggleStar={handleToggleStar}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default project browser with a variety of projects showing different statuses, validation states, and project information.",
      },
    },
  },
};

export const EmptyState: Story = {
  render: () => (
    <div className="h-screen">
      <ProjectBrowser projects={[]} onCreateProject={() => alert("Create first project")} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Empty state when no projects exist, encouraging users to create their first project.",
      },
    },
  },
};

export const LoadingState: Story = {
  render: () => (
    <div className="h-screen">
      <ProjectBrowser projects={[]} loading={true} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Loading state while projects are being fetched from the server.",
      },
    },
  },
};

export const SearchAndFilter: Story = {
  render: () => {
    const [selectedProject, setSelectedProject] = useState<Project | undefined>();
    const [projects] = useState(sampleProjects);

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          onCreateProject={() => alert("Create new project")}
        />

        {/* Instructions overlay */}
        <div className="fixed top-4 right-4 max-w-sm p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-lg">
          <h4 className="font-medium text-blue-900 mb-2">Try the search and filters!</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Search for "auth", "payment", or "mobile"</li>
            <li>• Filter by status: Active, Draft, Archived</li>
            <li>• Notice the validation status indicators</li>
            <li>• Click the star icons to favorite projects</li>
          </ul>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates search functionality and status filtering. Try searching for different terms and filtering by project status.",
      },
    },
  },
};

export const ProjectStatuses: Story = {
  render: () => {
    const statusProjects: Project[] = [
      {
        id: "1",
        name: "Active Project",
        description: "Currently being developed with regular commits and validation.",
        status: "active",
        lastModified: "2024-01-15T10:30:00Z",
        fragmentCount: 12,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "valid",
        tags: ["active"],
      },
      {
        id: "2",
        name: "Draft Project",
        description: "Work in progress, not yet ready for production validation.",
        status: "draft",
        lastModified: "2024-01-14T16:45:00Z",
        fragmentCount: 5,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "pending",
        tags: ["draft"],
      },
      {
        id: "3",
        name: "Archived Project",
        description: "Completed or deprecated project kept for reference.",
        status: "archived",
        lastModified: "2024-01-10T09:15:00Z",
        fragmentCount: 8,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "valid",
        tags: ["archived"],
      },
      {
        id: "4",
        name: "Error Project",
        description: "Project with critical validation errors that need attention.",
        status: "error",
        lastModified: "2024-01-12T14:20:00Z",
        fragmentCount: 3,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "errors",
        tags: ["error"],
      },
    ];

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={statusProjects}
          onCreateProject={() => alert("Create new project")}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows all project status variants with their corresponding visual styles and validation states.",
      },
    },
  },
};

export const ValidationStates: Story = {
  render: () => {
    const validationProjects: Project[] = [
      {
        id: "1",
        name: "Valid Specification",
        description: "All validation checks pass, ready for production deployment.",
        status: "active",
        lastModified: "2024-01-15T10:30:00Z",
        fragmentCount: 8,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "valid",
        tags: ["production-ready"],
      },
      {
        id: "2",
        name: "Spec with Warnings",
        description: "Minor validation warnings that should be addressed.",
        status: "active",
        lastModified: "2024-01-14T16:45:00Z",
        fragmentCount: 6,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "warnings",
        tags: ["needs-review"],
      },
      {
        id: "3",
        name: "Spec with Errors",
        description: "Critical validation errors preventing deployment.",
        status: "error",
        lastModified: "2024-01-13T09:15:00Z",
        fragmentCount: 4,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "errors",
        tags: ["needs-fix"],
      },
      {
        id: "4",
        name: "Validating Spec",
        description: "Currently running validation checks and analysis.",
        status: "active",
        lastModified: "2024-01-12T14:20:00Z",
        fragmentCount: 10,
        collaborators: ["user@company.com"],
        starred: false,
        validationStatus: "pending",
        tags: ["in-progress"],
      },
    ];

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={validationProjects}
          onCreateProject={() => alert("Create new project")}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates different validation states with appropriate icons and visual indicators.",
      },
    },
  },
};

export const CollaborativeProjects: Story = {
  render: () => {
    const collaborativeProjects: Project[] = [
      {
        id: "1",
        name: "Solo Project",
        description: "Individual project with single developer.",
        status: "active",
        lastModified: "2024-01-15T10:30:00Z",
        fragmentCount: 5,
        collaborators: [],
        starred: false,
        validationStatus: "valid",
        tags: ["solo"],
      },
      {
        id: "2",
        name: "Team Project",
        description: "Collaborative project with multiple team members.",
        status: "active",
        lastModified: "2024-01-14T16:45:00Z",
        fragmentCount: 12,
        collaborators: ["alice@team.com", "bob@team.com"],
        starred: true,
        validationStatus: "valid",
        tags: ["team", "collaborative"],
      },
      {
        id: "3",
        name: "Enterprise Project",
        description: "Large-scale project with multiple departments involved.",
        status: "active",
        lastModified: "2024-01-13T09:15:00Z",
        fragmentCount: 28,
        collaborators: [
          "dev1@corp.com",
          "dev2@corp.com",
          "dev3@corp.com",
          "dev4@corp.com",
          "dev5@corp.com",
        ],
        starred: false,
        validationStatus: "warnings",
        tags: ["enterprise", "large-scale"],
      },
    ];

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={collaborativeProjects}
          onCreateProject={() => alert("Create new project")}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows projects with different collaboration levels, from solo to enterprise-scale projects.",
      },
    },
  },
};

export const StarredProjects: Story = {
  render: () => {
    const [projects, setProjects] = useState(
      sampleProjects.map((p, index) => ({
        ...p,
        starred: index < 3, // First 3 projects are starred
      })),
    );

    const handleToggleStar = (project: Project) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, starred: !p.starred } : p)),
      );
    };

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={projects}
          onCreateProject={() => alert("Create new project")}
          onToggleStar={handleToggleStar}
        />

        <div className="fixed top-4 right-4 max-w-sm p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-lg">
          <h4 className="font-medium text-amber-900 mb-2">Starred Projects</h4>
          <p className="text-sm text-amber-800">
            Click the star icons to favorite/unfavorite projects. Starred projects are typically
            shown at the top.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive story demonstrating the starring functionality for favoriting important projects.",
      },
    },
  },
};

export const ResponsiveGrid: Story = {
  render: () => {
    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={sampleProjects}
          onCreateProject={() => alert("Create new project")}
        />

        <div className="fixed top-4 right-4 max-w-sm p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg">
          <h4 className="font-medium text-green-900 mb-2">Responsive Design</h4>
          <p className="text-sm text-green-800">
            Resize your browser window to see how the project grid adapts to different screen sizes.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates the responsive grid layout that adapts from 1 column on mobile to 4 columns on desktop.",
      },
    },
  },
};

export const ProjectActions: Story = {
  render: () => {
    const [projects, setProjects] = useState(sampleProjects);
    const [selectedProject, setSelectedProject] = useState<Project | undefined>();

    const handleToggleStar = (project: Project) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, starred: !p.starred } : p)),
      );
    };

    return (
      <div className="h-screen">
        <ProjectBrowser
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          onCreateProject={() => alert("🎉 Creating new project!")}
          onEditProject={(project) => alert(`✏️ Editing "${project.name}"`)}
          onDeleteProject={(project) => alert(`🗑️ Deleting "${project.name}"`)}
          onToggleStar={handleToggleStar}
        />

        <div className="fixed top-4 right-4 max-w-sm p-4 bg-purple-50 border border-purple-200 rounded-lg shadow-lg">
          <h4 className="font-medium text-purple-900 mb-2">Interactive Actions</h4>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• Click cards to select projects</li>
            <li>• Star/unstar with the star button</li>
            <li>• Create new projects with + button</li>
            <li>• Hover cards for menu options</li>
          </ul>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive story showcasing all available project actions including selection, starring, creation, editing, and deletion.",
      },
    },
  },
};
