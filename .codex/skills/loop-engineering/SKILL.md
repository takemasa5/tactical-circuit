---
name: loop-engineering
description: "Use when running loop engineering for GitHub Issues and pull requests: select the next actionable Issue, skip blocked or question-labeled work, implement missing PRs, handle review comments, request Codex review, and merge when ready."
---

# Loop Engineering

## Goal

Continuously advance GitHub Issues by selecting an actionable Issue, implementing it or responding to its pull request review, and finishing only when the Issue is merged, blocked, or requires specification clarification.

## Issue Selection

1. Inspect open GitHub Issues.
2. Select an Issue that is ready to work on.
3. Do not start an Issue if any dependent Issue is incomplete.
4. If the Issue already has a pull request:
   - Proceed to review feedback handling.
   - Do not work on it if the pull request has the `question` label.
5. If the Issue has no pull request:
   - Proceed to implementation.

## Implementation Workflow

1. Read the Issue carefully.
2. Identify the completion conditions.
3. Inspect the relevant code and documentation before editing.
4. Implement the minimum change needed to satisfy the Issue.
5. Run appropriate tests, checks, or builds when possible.
6. Create a pull request targeting `develop`.
7. Include `@codex review` in the pull request body to request review.
8. Report the pull request URL and the checks performed.

## Review Feedback Workflow

1. Inspect the pull request head commit, review status, checks, and review comments.
2. If review for the latest head commit is pending or has not run:
   - Do not treat the absence of review comments as review completion.
   - Wait for review completion before merging.
3. If review for the latest head commit is complete, all checks pass, and there are no actionable or unclassified review comments:
   - Merge the pull request into `develop`.
   - Report that the Issue is complete.
4. If there are actionable review comments:
   - Address the comments with minimal, focused changes.
   - Run appropriate tests, checks, or builds when possible.
   - Push the updates.
   - Comment `@codex review` on the pull request to request review of the updated head commit.
   - Return to step 1 and do not merge until that review is complete.
5. If a review comment requires specification clarification:
   - Add a comment explaining what needs clarification.
   - Add the `question` label to the pull request.
   - Stop work on that Issue and report the blocker.

## Labels and Blocking Rules

- `question`: Specification clarification is needed. Do not continue implementation until clarified.
- Dependent incomplete Issues: Treat as blocked. Do not start implementation.
- Existing pull request without `question`: Prefer review feedback handling over starting a new implementation.

## Pull Request Requirements

- Target branch: `develop`
- Include `@codex review` in the pull request body.
- Keep the pull request focused on the selected Issue.
- Do not modify unrelated files.
- Do not revert user changes unless explicitly requested.

## Completion Report

At the end, report:

- Selected Issue
- Decision: implemented, reviewed, merged, skipped, or blocked
- Pull request URL if created or updated
- Tests/checks run
- Remaining blocker if any
