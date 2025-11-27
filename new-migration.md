# Schema Migration Script
# Generated: 2025-11-25T19:49:31.272Z

# Breaking changes require manual review and data migration

# Removed constraint: constraint.Rule
# Location: constraint.Rule
# Action required: Update existing data to work without the Rule constraint

# Removed import: import.util
# Location: import.util
# Action required: Remove usage of github.com/acme/util from dependent schemas

