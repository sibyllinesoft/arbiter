# Schema Migration Script
# Generated: 2026-02-01T15:14:09.964Z

# Breaking changes require manual review and data migration

# Removed constraint: constraint.Rule
# Location: constraint.Rule
# Action required: Update existing data to work without the Rule constraint

# Removed import: import.util
# Location: import.util
# Action required: Remove usage of github.com/acme/util from dependent schemas

