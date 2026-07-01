---
name: loop-engineering
description: "Drive one GitHub Issue through implementation, pull request review, and merge by repeatedly working, checking review and CI state, addressing feedback, and continuing until the pull request is merged into develop and the Issue is closed. Use for loop engineering of a single work task."
---

# Loop Engineering

## Goal

Complete exactly one Issue by repeating this lifecycle:

1. Satisfy the Issue completion conditions and open a pull request.
2. Address pull request review findings and failed checks.
3. Merge a reviewed pull request with no remaining findings into `develop`, then close the pull request and Issue.

After selecting an Issue, do not switch to another Issue. Do not stop merely because a pull request was created, changes were pushed, or review was requested.

## Preconditions

- Require the `develop` branch to exist. If it does not exist, report the blocker and do not substitute another base branch.
- Use the Issue specified by the user. If none is specified, select one open Issue whose dependencies are complete.
- Record the selected Issue and keep it fixed until a terminal condition is reached.
- Locate the Issue's existing pull request before deciding to implement.

## Main Loop

Repeat the following steps for the selected Issue until a terminal condition is reached.

### 1. Inspect State

- Read the Issue, completion conditions, dependencies, and linked pull request.
- When a pull request exists, inspect its latest head commit, checks, review status, and thread-aware review comments.
- Follow repository instructions such as `AGENTS.md`; they take precedence over this skill.

### 2. Implement When No Pull Request Exists

1. Read the relevant specifications and existing code.
2. Implement the minimum change that satisfies every Issue completion condition.
3. Add or update tests and documentation required by the change.
4. Run the relevant tests, checks, formatting, lint, typecheck, and build.
5. Create a focused pull request targeting `develop`.
6. Include `Closes #<issue-number>` and `@codex review` in the pull request body.
7. Continue this Main Loop with the new pull request. Do not stop after reporting its URL.

### 3. Handle Checks

- If checks are pending, wait and inspect them again.
- If a check fails, diagnose the failure, make the minimum required fix, rerun relevant local checks, push the update, comment `@codex review`, and return to Inspect State.
- Do not merge unless all required checks for the latest head commit pass.

### 4. Handle Review

- If review for the latest head commit is pending or has not run, wait and inspect it again. Do not treat zero comments as review completion.
- Classify every unclassified review finding against the Issue, specifications, existing Issues, and handoff records:
  - Fix a valid finding that is in scope.
  - Reply with the tracking Issue or handoff ID when the finding is already registered.
  - Reply with a concrete reason when no change is required.
  - If specification clarification is required, explain the question, add the `question` label, and enter the blocked terminal condition.
- When one or more findings require changes, address all selected findings with minimal focused changes, run relevant checks, push the update, comment `@codex review`, and return to Inspect State.
- Do not merge while an actionable or unclassified review finding remains.

### 5. Merge and Close

Merge only when all of the following are true for the latest head commit:

- Review is complete and reports no remaining actionable findings.
- Every review finding is resolved or has a recorded no-change, tracking Issue, or handoff rationale.
- All required checks pass.
- The pull request still satisfies the selected Issue completion conditions.

Then:

1. Merge the pull request into `develop`.
2. Confirm that the pull request is merged and closed.
3. Confirm that the selected Issue is closed by the merge. If it is still open, close it only after verifying every completion condition.
4. Perform repository-required post-merge cleanup.
5. Report completion and stop.

## Terminal Conditions

Stop only when one of these conditions is true:

- Completed: the pull request is merged into `develop` and both the pull request and Issue are closed.
- Blocked: a dependency, missing `develop` branch, permission, external failure, or required user decision prevents further progress.
- Specification clarification: the pull request has the `question` label and the unresolved question is reported.

Pending checks or review are not terminal conditions. Wait and continue the Main Loop.

## Safety

- Keep the pull request focused on the selected Issue.
- Do not modify unrelated files.
- Do not revert user changes unless explicitly requested.
- Do not bypass branch protection, required checks, review, or repository instructions.

## Completion Report

Report:

- Selected Issue
- Terminal condition: completed, blocked, or specification clarification
- Pull request URL if created or updated
- Tests/checks run
- Review status for the merged or current head commit
- Remaining blocker if any
