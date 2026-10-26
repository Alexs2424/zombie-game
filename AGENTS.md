# Testing

- Run checks relevant to the change. Do not run the full test suite after every edit or for documentation-only changes.
- Use focused tests for the gameplay or system being changed. Run the full suite for merges, broad changes, or changes that affect shared behavior across systems.
- Run browser visual checks and Blender asset audits only when the affected visuals, interactions, or assets need verification.
- Once relevant checks pass, do not repeat them unless further changes or failures justify it. Keep verification proportionate; avoid adding tests that merely repeat implementation details.

# Creative decisions

- Record decisions about story, plot, characters, voices, Easter eggs, quests, and narrative-related mechanics in `docs/decisions/` as part of the same work. Start with `docs/decisions/README.md`.
- Distinguish user-established direction, agent-selected working decisions, unresolved proposals, and verified implemented behavior. Planned features must not be described as implemented.
- Update the owning document and decision log when a choice changes; resolve conflicting descriptions rather than keeping multiple competing current versions. `docs/story-proposal.md` is the historical pitch, not the current source of truth.
