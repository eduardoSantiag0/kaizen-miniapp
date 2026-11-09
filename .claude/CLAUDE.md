## MVP Scope — Kaizen Mini App

The MVP is an interactive Go training application inspired by 101weiqi, built with Angular and the Sabaki ecosystem.

### In Scope

**1. Main Menu**
- Display the user's available analyzed games and exercises.
- Allow users to select an individual exercise.
- Provide navigation between the menu and the Exercise screen.
- Support opening, middlegame, and endgame SGF phases.
- Use `games_test/` placeholder SGFs until the real backend API becomes available.

**2. Single Exercise Screen**
- Present an interactive Go board using Sabaki/Shudan.
- Allow the user to attempt one exercise at a time by playing moves directly on the board.
- Reproduce KataGo's precomputed continuation.
- Support move navigation and existing SGF variations.
- Provide feedback based on the stored analysis.
- Allow users to retry exercises.
- Distinguish between incorrect moves and moves not covered by the available analysis.
- Preserve the original SGF and its variations.
- Support mobile touch interactions and Telegram WebView.

**3. Exercise UX**
- Follow familiar 101weiqi-style interaction patterns.
- Prioritize the board and minimize unnecessary UI elements.
- Provide clear feedback after attempted moves.
- Make retrying and returning to the menu intuitive.
- Ensure usability on small mobile screens.

### Future Feature — `/practice`

The `/practice` command will introduce a session-based training mode.

When invoked, it will:

1. Retrieve exercises from all previously analyzed games belonging to the user.
2. Randomly select 5 exercises from the available pool.
3. Create a practice session containing those 5 exercises.
4. Present exercises sequentially, one at a time.
5. Reuse the existing single Exercise screen.
6. Track progress through the session.

The single Exercise screen is part of the MVP.

The `/practice` session orchestration, random selection, and multi-exercise progression are **not** part of the MVP.

### Technical Requirements

The exercise flow must support:

- Opening / middlegame / endgame SGF phases.
- Move navigation through KataGo's precomputed line.
- Existing SGF variations.
- Interactive move input.
- Mobile interaction.
- Clear separation between exercise logic, SGF processing, and board rendering.

### Out of Scope

- `/practice` session mode (HANDOFF.md section 6, updated to 5 randomly selected exercises).
- Session persistence and progress tracking across multiple exercises.
- Live KataGo analysis. All analysis is precomputed and stored; the frontend never calls KataGo.
- New backend endpoints implemented by the team. The real HTTP endpoint exposing `GameHistoryDto` and SGFs does not exist yet. The user is implementing it independently.

### Development Constraints

- Do not implement the missing backend endpoint.
- Do not block frontend development on backend availability.
- Develop and test against `games_test/` placeholder SGFs.
- Do not invent production API contracts.
- Keep the architecture ready for future API integration.
- Design the Exercise screen to be reusable by the future `/practice` session mode.

## Quality Gates

1. Integration Manager approves API compatibility.
2. Designer approves visual fidelity.
3. Supervisor approves security and implementation.
4. Build and tests pass.

Never deploy without explicit user approval.