# Step 8 — Summary Report to User

After the reviewer returns `accepted`, the Root Agent reports back to the user. This is the only point in the workflow where the user hears from the Root Agent about the completed work — the Root Agent relays what the sub-agents produced and what the reviewer accepted, without re-verifying the work itself.

The report must include:

- What was done (feature implemented / bug fixed)
- Files changed (taken from the sub-agent result and reviewer response)
- Tests added or updated (taken from the tester result)
- The reviewer's acceptance note and any `Recommendations` they left for follow-up
- Any outstanding notes or follow-up recommendations

Also update the `Status` column in the `## Task List` section of the markdown plan document.
