# Testing

- Run checks relevant to the change. Do not run the full test suite after every edit or for documentation-only changes.
- Use focused tests for the gameplay or system being changed. Run the full suite for merges, broad changes, or changes that affect shared behavior across systems.
- Run browser visual checks and Blender asset audits only when the affected visuals, interactions, or assets need verification.
- Once relevant checks pass, do not repeat them unless further changes or failures justify it. Keep verification proportionate; avoid adding tests that merely repeat implementation details.
