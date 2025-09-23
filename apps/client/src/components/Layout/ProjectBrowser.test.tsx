/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectBrowser from './ProjectBrowser';
import type { Project } from './ProjectBrowser';

// Mock design system components
vi.mock('../../design-system', () => ({
  Button: ({ children, onClick, disabled, leftIcon, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  ),
  Card: ({ children, onClick, className, ...props }: any) => (
    <div onClick={onClick} className={className} data-testid="project-card" {...props}>
      {children}
    </div>
  ),
  Input: ({ placeholder, value, onChange, className, ...props }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      data-testid="search-input"
      {...props}
    />
  ),
  StatusBadge: ({ children, variant, size, icon, ...props }: any) => (
    <div data-testid="status-badge" data-variant={variant} data-size={size} {...props}>
      {icon}
      {children}
    </div>
  ),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  FolderOpen: () => <div data-testid="folder-open-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  GitBranch: () => <div data-testid="git-branch-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Users: () => <div data-testid="users-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
  MoreVertical: () => <div data-testid="more-vertical-icon" />,
  Star: () => <div data-testid="star-icon" />,
  StarOff: () => <div data-testid="star-off-icon" />,
  Archive: () => <div data-testid="archive-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Edit3: () => <div data-testid="edit-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  CheckCircle2: () => <div data-testid="check-circle-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
}));

// Mock test data
const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'E-commerce API',
    description: 'RESTful API for e-commerce platform',
    status: 'active',
    lastModified: '2024-01-15T10:30:00Z',
    fragmentCount: 25,
    collaborators: ['user1', 'user2'],
    starred: true,
    validationStatus: 'valid',
    tags: ['api', 'ecommerce', 'production'],
  },
  {
    id: 'project-2',
    name: 'User Management',
    description: 'User authentication and authorization',
    status: 'draft',
    lastModified: '2024-01-10T14:20:00Z',
    fragmentCount: 12,
    collaborators: ['user1'],
    starred: false,
    validationStatus: 'warnings',
    tags: ['auth', 'users'],
  },
  {
    id: 'project-3',
    name: 'Data Pipeline',
    description: 'ETL pipeline for data processing',
    status: 'error',
    lastModified: '2024-01-05T09:15:00Z',
    fragmentCount: 8,
    collaborators: ['user2', 'user3'],
    starred: false,
    validationStatus: 'errors',
    tags: ['etl', 'data'],
  },
  {
    id: 'project-4',
    name: 'Archive Project',
    description: 'Old project for reference',
    status: 'archived',
    lastModified: '2023-12-01T16:45:00Z',
    fragmentCount: 5,
    collaborators: [],
    starred: false,
    validationStatus: 'valid',
    tags: ['legacy'],
  },
];

describe('ProjectBrowser', () => {
  const user = userEvent.setup();
  const mockOnSelectProject = vi.fn();
  const mockOnCreateProject = vi.fn();
  const mockOnEditProject = vi.fn();
  const mockOnDeleteProject = vi.fn();
  const mockOnToggleStar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders project browser with header', () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onCreateProject={mockOnCreateProject}
        />
      );

      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('4 specifications workspace')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          className="custom-browser"
          onSelectProject={mockOnSelectProject}
        />
      );

      const container = screen.getByText('Projects').closest('.custom-browser');
      expect(container).toBeInTheDocument();
    });

    it('renders all project cards', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      expect(screen.getAllByTestId('project-card')).toHaveLength(4);
      expect(screen.getByText('E-commerce API')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Archive Project')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('renders status filter dropdown', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const filterSelect = screen.getByDisplayValue('All Status');
      expect(filterSelect).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when loading prop is true', () => {
      render(<ProjectBrowser projects={[]} loading={true} onSelectProject={mockOnSelectProject} />);

      expect(screen.getByText('Loading projects...')).toBeInTheDocument();
      expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no projects exist', () => {
      render(
        <ProjectBrowser
          projects={[]}
          onSelectProject={mockOnSelectProject}
          onCreateProject={mockOnCreateProject}
        />
      );

      expect(screen.getByText('Welcome to Spec Workbench')).toBeInTheDocument();
      expect(screen.getByText(/Create your first specification project/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Create Your First Project/i })
      ).toBeInTheDocument();
    });

    it('shows no results state when search returns no matches', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'nonexistent project');

      expect(screen.getByText('No projects found')).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search terms/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
    });

    it('clears filters when clear button is clicked', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'nonexistent');

      const clearButton = screen.getByRole('button', { name: /Clear filters/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
      expect(screen.getAllByTestId('project-card')).toHaveLength(4);
    });
  });

  describe('Project Card Content', () => {
    it('displays project information correctly', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      // Check first project
      expect(screen.getByText('E-commerce API')).toBeInTheDocument();
      expect(screen.getByText('RESTful API for e-commerce platform')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // fragment count
      expect(screen.getByText('2')).toBeInTheDocument(); // collaborator count
    });

    it('shows correct status badges', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const statusBadges = screen.getAllByTestId('status-badge');
      expect(statusBadges).toHaveLength(8); // 4 status + 4 validation icons
    });

    it('displays validation status icons', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      expect(screen.getAllByTestId('check-circle-icon')).toHaveLength(2); // valid projects
      expect(screen.getAllByTestId('alert-circle-icon')).toHaveLength(2); // warnings and errors
    });

    it('shows starred projects with filled star icon', () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onToggleStar={mockOnToggleStar}
        />
      );

      expect(screen.getByTestId('star-icon')).toBeInTheDocument(); // starred project
      expect(screen.getAllByTestId('star-off-icon')).toHaveLength(3); // non-starred projects
    });

    it('displays project tags', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      expect(screen.getByText('api')).toBeInTheDocument();
      expect(screen.getByText('ecommerce')).toBeInTheDocument();
      expect(screen.getByText('production')).toBeInTheDocument();
    });

    it('shows truncated tags with +more indicator', () => {
      const projectWithManyTags = {
        ...mockProjects[0],
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
      };

      render(
        <ProjectBrowser projects={[projectWithManyTags]} onSelectProject={mockOnSelectProject} />
      );

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument(); // +more indicator
    });

    it('formats last modified dates correctly', () => {
      // Mock current time to ensure predictable date formatting
      vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));

      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      // Should show relative times based on the mock system time
      expect(screen.getByText(/ago|Just now/)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters projects by name', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'E-commerce');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('E-commerce API')).toBeInTheDocument();
    });

    it('filters projects by description', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'authentication');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    it('filters projects by tags', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'etl');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
    });

    it('performs case-insensitive search', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'E-COMMERCE');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('E-commerce API')).toBeInTheDocument();
    });
  });

  describe('Status Filtering', () => {
    it('filters by active status', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const statusFilter = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusFilter, 'active');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('E-commerce API')).toBeInTheDocument();
    });

    it('filters by draft status', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const statusFilter = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusFilter, 'draft');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    it('filters by error status', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const statusFilter = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusFilter, 'error');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
    });

    it('filters by archived status', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const statusFilter = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusFilter, 'archived');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('Archive Project')).toBeInTheDocument();
    });
  });

  describe('Combined Filtering', () => {
    it('combines search and status filters', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      const statusFilter = screen.getByDisplayValue('All Status');

      await user.type(searchInput, 'project');
      await user.selectOptions(statusFilter, 'archived');

      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
      expect(screen.getByText('Archive Project')).toBeInTheDocument();
    });

    it('shows no results when filters exclude all projects', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');
      const statusFilter = screen.getByDisplayValue('All Status');

      await user.type(searchInput, 'nonexistent');
      await user.selectOptions(statusFilter, 'active');

      expect(screen.getByText('No projects found')).toBeInTheDocument();
    });
  });

  describe('Project Interactions', () => {
    it('calls onSelectProject when project card is clicked', async () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const projectCards = screen.getAllByTestId('project-card');
      await user.click(projectCards[0]);

      expect(mockOnSelectProject).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('calls onToggleStar when star button is clicked', async () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onToggleStar={mockOnToggleStar}
        />
      );

      const starButton = screen.getByTestId('star-icon').closest('button');
      await user.click(starButton!);

      expect(mockOnToggleStar).toHaveBeenCalledWith(mockProjects[0]);
      expect(mockOnSelectProject).not.toHaveBeenCalled(); // Should not trigger project selection
    });

    it('calls onCreateProject when new project button is clicked', async () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onCreateProject={mockOnCreateProject}
        />
      );

      await user.click(screen.getByRole('button', { name: /New Project/i }));
      expect(mockOnCreateProject).toHaveBeenCalled();
    });

    it('calls onCreateProject from empty state button', async () => {
      render(
        <ProjectBrowser
          projects={[]}
          onSelectProject={mockOnSelectProject}
          onCreateProject={mockOnCreateProject}
        />
      );

      await user.click(screen.getByRole('button', { name: /Create Your First Project/i }));
      expect(mockOnCreateProject).toHaveBeenCalled();
    });

    it('prevents event propagation when clicking interactive elements', async () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onToggleStar={mockOnToggleStar}
        />
      );

      const moreButton = screen.getByTestId('more-vertical-icon').closest('button');
      await user.click(moreButton!);

      expect(mockOnSelectProject).not.toHaveBeenCalled();
    });
  });

  describe('Selected Project Highlighting', () => {
    it('highlights selected project', () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          selectedProject={mockProjects[1]}
          onSelectProject={mockOnSelectProject}
        />
      );

      const projectCards = screen.getAllByTestId('project-card');
      // The selected card should have special styling (ring classes)
      expect(projectCards[1]).toHaveClass('ring-2', 'ring-blue-500');
    });

    it('does not highlight when no project selected', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      const projectCards = screen.getAllByTestId('project-card');
      projectCards.forEach(card => {
        expect(card).not.toHaveClass('ring-2', 'ring-blue-500');
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for interactive elements', () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onToggleStar={mockOnToggleStar}
        />
      );

      expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search projects/)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(
        <ProjectBrowser
          projects={mockProjects}
          onSelectProject={mockOnSelectProject}
          onCreateProject={mockOnCreateProject}
        />
      );

      // Should be able to tab through interactive elements
      await user.tab();
      expect(screen.getByTestId('search-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByDisplayValue('All Status')).toHaveFocus();
    });

    it('provides semantic structure', () => {
      render(<ProjectBrowser projects={mockProjects} onSelectProject={mockOnSelectProject} />);

      expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // status filter
      expect(screen.getByRole('searchbox')).toBeInTheDocument(); // search input
    });
  });

  describe('Performance', () => {
    it('handles large number of projects efficiently', () => {
      const manyProjects = Array.from({ length: 100 }, (_, i) => ({
        ...mockProjects[0],
        id: `project-${i}`,
        name: `Project ${i}`,
      }));

      const startTime = performance.now();
      render(<ProjectBrowser projects={manyProjects} onSelectProject={mockOnSelectProject} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render within 100ms
      expect(screen.getAllByTestId('project-card')).toHaveLength(100);
    });

    it('efficiently filters large datasets', async () => {
      const manyProjects = Array.from({ length: 1000 }, (_, i) => ({
        ...mockProjects[0],
        id: `project-${i}`,
        name: `Project ${i}`,
      }));

      render(<ProjectBrowser projects={manyProjects} onSelectProject={mockOnSelectProject} />);

      const searchInput = screen.getByTestId('search-input');

      const startTime = performance.now();
      await user.type(searchInput, '999');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // Should filter within 500ms
      expect(screen.getAllByTestId('project-card')).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles projects with missing optional fields', () => {
      const projectsWithMissingFields: Project[] = [
        {
          id: 'project-1',
          name: 'Minimal Project',
          status: 'active',
          lastModified: '2024-01-01T00:00:00Z',
          fragmentCount: 0,
          collaborators: [],
          starred: false,
          validationStatus: 'valid',
          tags: [],
          // description is optional and missing
        },
      ];

      expect(() => {
        render(
          <ProjectBrowser
            projects={projectsWithMissingFields}
            onSelectProject={mockOnSelectProject}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Minimal Project')).toBeInTheDocument();
    });

    it('handles empty collaborators array', () => {
      const projectWithNoCollaborators = {
        ...mockProjects[0],
        collaborators: [],
      };

      render(
        <ProjectBrowser
          projects={[projectWithNoCollaborators]}
          onSelectProject={mockOnSelectProject}
        />
      );

      // Should not show collaborator count when empty
      expect(screen.queryByTestId('users-icon')).not.toBeInTheDocument();
    });

    it('handles invalid date strings gracefully', () => {
      const projectWithInvalidDate = {
        ...mockProjects[0],
        lastModified: 'invalid-date',
      };

      expect(() => {
        render(
          <ProjectBrowser
            projects={[projectWithInvalidDate]}
            onSelectProject={mockOnSelectProject}
          />
        );
      }).not.toThrow();
    });
  });
});
