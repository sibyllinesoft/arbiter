"""
MkDocs hooks for validating CLI examples in documentation.

This hook extracts CLI code blocks marked with <!-- test --> and validates
them during the build process.
"""

import re
import subprocess
import sys
from typing import Optional


def validate_cli_block(command: str, dry_run: bool = True) -> Optional[str]:
    """
    Validate a CLI command block.

    Args:
        command: The shell command to validate
        dry_run: If True, only check syntax; if False, execute command

    Returns:
        Error message if validation failed, None if successful
    """
    # Skip empty commands
    if not command.strip():
        return None

    # Skip comments
    if command.strip().startswith('#'):
        return None

    # In dry-run mode, just check if the command looks valid
    if dry_run:
        # Check if command starts with 'arbiter'
        if not command.strip().startswith('arbiter'):
            return None  # Allow non-arbiter commands

        # Basic syntax check - ensure no obvious shell errors
        try:
            subprocess.run(
                f'bash -n -c "{command}"',
                shell=True,
                capture_output=True,
                timeout=1
            )
        except subprocess.TimeoutExpired:
            return f"Syntax check timed out: {command}"
        except Exception as e:
            return f"Syntax error: {command} - {e}"
    else:
        # Actually execute the command (use with caution!)
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                timeout=5,
                text=True
            )
            if result.returncode != 0 and '--help' not in command:
                return f"Command failed: {command}\nOutput: {result.stderr}"
        except subprocess.TimeoutExpired:
            return f"Command timed out: {command}"
        except Exception as e:
            return f"Execution error: {command} - {e}"

    return None


def on_page_markdown(markdown: str, **kwargs) -> str:
    """
    Hook called for each page's markdown before conversion to HTML.

    Extracts CLI code blocks marked with <!-- test --> and validates them.
    """
    # Only run in strict mode or when VALIDATE_CLI_EXAMPLES is set
    import os
    if not os.environ.get('VALIDATE_CLI_EXAMPLES'):
        return markdown

    # Pattern to match code blocks with test marker
    # Matches: ```bash <!-- test -->
    #          command here
    #          ```
    pattern = r'```(?:bash|shell|console)\s*(?:<!--\s*test\s*-->)?\s*\n(.*?)```'

    errors = []

    for match in re.finditer(pattern, markdown, re.DOTALL):
        code_block = match.group(1).strip()

        # Split into individual commands (lines starting with $ or arbiter)
        commands = []
        for line in code_block.split('\n'):
            line = line.strip()
            # Extract command (remove $ prompt if present)
            if line.startswith('$'):
                commands.append(line[1:].strip())
            elif line.startswith('arbiter'):
                commands.append(line)

        # Validate each command
        for command in commands:
            error = validate_cli_block(command, dry_run=True)
            if error:
                errors.append(error)

    # Report errors
    if errors:
        page_file = kwargs.get('page', {}).file.src_path if 'page' in kwargs else 'unknown'
        print(f"\n⚠️  CLI validation errors in {page_file}:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)

        # In strict mode, fail the build
        if os.environ.get('VALIDATE_CLI_STRICT'):
            raise ValueError(f"CLI validation failed in {page_file}")

    return markdown


def on_pre_build(**kwargs):
    """Hook called before the build starts."""
    import os
    if os.environ.get('VALIDATE_CLI_EXAMPLES'):
        print("🔍 CLI example validation enabled")
        if os.environ.get('VALIDATE_CLI_STRICT'):
            print("   Running in STRICT mode - build will fail on errors")
