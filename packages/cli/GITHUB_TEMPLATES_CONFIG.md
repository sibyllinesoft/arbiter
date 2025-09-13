# Configuration-Based GitHub Templates System

The Arbiter CLI now supports a flexible, configuration-driven GitHub templates system that allows you to customize issue templates, repository configuration, and validation rules through your `.arbiter/config.json` file.

## Key Features

- **Template Inheritance**: Create base templates that can be extended
- **Dynamic Content Generation**: Use handlebars-like syntax for dynamic content
- **Field Validation**: Configure validation rules for template fields
- **Repository Configuration**: Manage labels, issue configuration, and PR templates
- **Backward Compatibility**: Existing templates continue to work

## Configuration Structure

Add GitHub templates configuration to your `.arbiter/config.json`:

```json
{
  "github": {
    "repository": {
      "owner": "my-org",
      "repo": "my-repo",
      "tokenEnv": "GITHUB_TOKEN"
    },
    "templates": {
      "base": {
        "name": "custom-base",
        "description": "Base template for our organization",
        "sections": {
          "description": "## 📋 Description\\n\\n{{description}}\\n\\n",
          "details": [
            {
              "name": "priority",
              "label": "Priority",
              "required": true,
              "type": "select"
            }
          ]
        },
        "labels": ["org:managed"]
      },
      "epic": {
        "inherits": "custom-base",
        "name": "Epic",
        "title": "[EPIC] {{priority}}: {{name}}",
        "labels": ["epic", "priority:{{priority}}"]
      }
    }
  }
}
```

## Template Types

### Base Templates

Base templates define common structure and can be inherited by other templates:

```json
{
  "base": {
    "name": "company-standard",
    "description": "Company standard template",
    "sections": {
      "description": "## Description\\n\\n{{description}}\\n\\n",
      "details": [
        {
          "name": "team",
          "label": "Team",
          "required": true,
          "type": "select",
          "enum": ["frontend", "backend", "design"]
        }
      ]
    },
    "validation": {
      "fields": [
        {
          "field": "team",
          "required": true,
          "enum": ["frontend", "backend", "design"],
          "errorMessage": "Team is required and must be valid"
        }
      ]
    }
  }
}
```

### Epic Templates

Epic templates inherit from base templates and add epic-specific sections:

```json
{
  "epic": {
    "inherits": "company-standard",
    "name": "Epic",
    "title": "[EPIC] [{{team}}] {{priority}}: {{name}}",
    "labels": ["epic", "priority:{{priority}}", "team:{{team}}"],
    "sections": {
      "additional": {
        "scope": "## 🎯 Scope\\n\\n**In Scope:**\\n{{#each inScope}}\\n- {{this}}\\n{{/each}}\\n\\n"
      }
    }
  }
}
```

### Task Templates

Task templates are used for individual work items:

```json
{
  "task": {
    "inherits": "company-standard",
    "name": "Task",
    "title": "[{{type}}] [{{team}}] {{priority}}: {{name}}",
    "labels": ["type:{{type}}", "priority:{{priority}}", "team:{{team}}"],
    "sections": {
      "additional": {
        "definition": "## 🎯 Definition of Done\\n\\n- [ ] Code implemented\\n- [ ] Tests written\\n- [ ] Reviewed and approved\\n\\n"
      }
    }
  }
}
```

### Bug Report Templates

```json
{
  "bugReport": {
    "name": "Bug Report",
    "title": "[BUG] [{{severity}}] {{title}}",
    "labels": ["type:bug", "severity:{{severity}}"],
    "sections": {
      "description": "## 🐛 Bug Description\\n\\n**Summary:** {{summary}}\\n\\n",
      "additional": {
        "reproduction": "## 🔄 Steps to Reproduce\\n\\n{{#each steps}}\\n{{@index}}. {{this}}\\n{{/each}}\\n\\n"
      }
    }
  }
}
```

## Template Sections

Templates are composed of sections that define the structure and content:

### Core Sections

- **description**: Main description section with dynamic content
- **details**: Table of structured fields
- **acceptanceCriteria**: Checkbox list of acceptance criteria
- **dependencies**: List of dependencies or blockers
- **additional**: Custom sections specific to template type

### Field Types

Fields in the details section can be of different types:

- `text`: Plain text input
- `number`: Numeric input
- `date`: Date input
- `select`: Dropdown selection
- `boolean`: Yes/No checkbox

### Dynamic Content

Use handlebars-like syntax for dynamic content:

- `{{variable}}`: Simple variable substitution
- `{{#if condition}}...{{/if}}`: Conditional blocks
- `{{#each array}}{{this}}{{/each}}`: Iteration over arrays
- `{{@index}}`: Current index in each loop

## Repository Configuration

Configure GitHub repository settings:

```json
{
  "repositoryConfig": {
    "issueConfig": {
      "blankIssuesEnabled": false,
      "contactLinks": [
        {
          "name": "📚 Documentation",
          "url": "https://wiki.company.com/{{repo}}",
          "about": "Team documentation"
        }
      ]
    },
    "labels": [
      {
        "name": "team:frontend",
        "color": "1f77b4",
        "description": "Frontend team responsibility"
      }
    ]
  }
}
```

## Validation

Configure validation rules to ensure template data quality:

```json
{
  "validation": {
    "fields": [
      {
        "field": "priority",
        "required": true,
        "enum": ["critical", "high", "medium", "low"],
        "errorMessage": "Priority must be specified"
      },
      {
        "field": "name",
        "required": true,
        "minLength": 5,
        "maxLength": 80,
        "errorMessage": "Name must be 5-80 characters"
      }
    ]
  }
}
```

### Validation Rules

- `required`: Field is mandatory
- `minLength`: Minimum string length
- `maxLength`: Maximum string length
- `pattern`: Regex pattern validation
- `enum`: Allowed values list
- `errorMessage`: Custom error message

## CLI Commands

### List Templates

```bash
arbiter github-templates --list
arbiter github-templates --list --format json
```

### Show Template Details

```bash
arbiter github-templates --show epic
arbiter github-templates --show task --format yaml
```

### Validate Configuration

```bash
arbiter github-templates --validate
```

### Generate Templates

Generate templates from your configuration:

```bash
arbiter integrate --templates
```

This generates `.github/ISSUE_TEMPLATE/` files and repository configuration from your template config.

## Migration from Static Templates

### Backward Compatibility

The new system is fully backward compatible. Existing static templates continue to work without changes.

### Gradual Migration

1. Start with default configuration (works out of the box)
2. Add base template with your organization's standards
3. Customize individual template types as needed
4. Add validation rules for quality control
5. Configure repository labels and settings

### Migration Example

Before (static):
```markdown
---
name: Epic
title: '[EPIC] '
labels: 'epic'
---
## Description
<!-- Epic description -->
```

After (configuration):
```json
{
  "epic": {
    "name": "Epic",
    "title": "[EPIC] {{priority}}: {{name}}",
    "labels": ["epic", "priority:{{priority}}"],
    "sections": {
      "description": "## 📋 Description\\n\\n{{description}}\\n\\n"
    }
  }
}
```

## Best Practices

### Template Organization

1. **Use Base Templates**: Define common structure in base templates
2. **Keep It Simple**: Start with simple templates and add complexity gradually
3. **Validate Early**: Use validation rules to catch errors early
4. **Document Fields**: Use clear field labels and help text

### Content Guidelines

1. **Use Emojis Sparingly**: Only use emojis that add clear value
2. **Clear Instructions**: Provide clear guidance in template comments
3. **Consistent Formatting**: Use consistent markdown formatting
4. **Actionable Content**: Make templates guide users to actionable content

### Maintenance

1. **Version Control**: Keep template configuration in version control
2. **Team Review**: Have team review template changes
3. **Regular Updates**: Review and update templates based on usage
4. **Monitor Usage**: Track how templates are being used and improve them

## Troubleshooting

### Common Issues

**Template validation fails**:
- Check field names match your data structure
- Verify enum values are correct
- Ensure required fields are provided

**Dynamic content not rendering**:
- Check variable names match data properties
- Verify handlebars syntax is correct
- Ensure data is available in template context

**Labels not applying**:
- Check label templates use correct variable names
- Verify GitHub repository has required labels
- Ensure label colors are valid hex codes

### Debug Commands

```bash
# Validate your configuration
arbiter github-templates --validate

# Show generated template
arbiter github-templates --show epic

# Check available data
arbiter github-templates --list --format json
```

## Examples

See `example-github-templates.json` for a complete configuration example showing:

- Base template with organization standards
- Epic templates with roadmap integration
- Task templates with definition of done
- Bug reports with severity classification
- Custom labels and repository configuration

This configuration-based system provides the flexibility to create templates that match your organization's specific needs while maintaining consistency and quality through validation rules.