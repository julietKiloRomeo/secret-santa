# AGENTS.md: Project Constitution for AI Assistants

We use uv to manage python environments and npm to manage javascript.

We use pytest for python testing and local playwright for frontend testing.
When adding new functionality ALWAYS start by adding tests and asking the
user if the test is ok.

We keep as much application logic as possible on the python side - use
fastapi for that. UX takes precedence over that principle, if fast interactions
are important, for example for mini games, put everything in the js side.
Prefer python, but UX is king.

During development we prefer sqlite for the database, but are open to
expand to postgres or mongo later.

We use ruff for python and Prettier for js.

When running commands on the python side we use "uv run ..." we do NOT
activate the environment.

We use uv add to add python packages. We do NOT use pip.

Use Jest and React Testing Library. All new components must have at
least 80% test coverage for critical paths.

Always run the tests after code changes, and commit after each change.

Note: Commit each logical change as its own commit so it's easy to review and revert if needed.
