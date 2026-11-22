# Health project integration

Private setup page: https://lift-health-companion.tenaciouscanopy3.chatgpt.site

The **Lift Health Companion** Site exposes workout-reading and split-planning tools to its generated ChatGPT plugin. It is separate from the Lift Tracker PWA. At the user's explicit request, it supports direct updates to the same active split as well as separate inactive copies. Completed workouts, account rules, the active-plan selection, and Daily Tracker messages are not changed.

## User setup still required

1. Open the private setup page while signed into the owning ChatGPT account.
2. Complete Google sign-in using the same account used in Lift Tracker.
3. Install/connect **Lift Health Companion** in ChatGPT Plugins → Personal → Created by you, then select it in a Health-project chat.
4. Copy the page's review instructions into the Health project's instructions. These point to the existing **Daily Tracker** conversation and define date windows, completeness checks, estimates, and correction handling. This task has no supported tool to edit project instructions directly.

On November 22, 2026, Google sign-in rejected the companion with an unauthorized-domain error. The exact hostname `lift-health-companion.tenaciouscanopy3.chatgpt.site` was added to the existing project's approved sign-in domains using the existing signed-in administrator connection. A read-back verified the addition and preservation of all existing domains. The project is `lift-tracker-8674a`. Account permissions and database rules were not changed. Do not use wildcard domains.

Deployment and schema provisioning were verified. Twenty-four companion tests passed, including direct-update field/version guards, pre-edit recovery, save-mode isolation, metadata preservation, idempotent retries, deletion markers, settings conflicts, and account isolation. Thirty-one relevant app tests previously passed for the unchanged app. After the domain correction, the in-app browser's Continue with Google button reached the real Google email/phone sign-in form. Complete food-history retrieval, iPhone behavior, a real combined review, and real plan saves still require user verification.

## Planning and saving splits

The plugin provides `get_plan_template`, `list_plans`, `get_plan`, `preview_plan`, `get_plan_preview`, `save_active_plan`, and `save_plan_as_new`. Read the template and complete saved source plan before revising. The supported version-1 format matches `plan-files.mjs`: ordered days, stable exercise IDs, sets, target reps, rest, supersets, equipment/type, notes, and aliases. The generic six-day example is not the user's saved split.

`preview_plan` stores an encrypted, owner/account-bound proposal with a seven-day save window and returns the full validated plan/summary. Use `save_mode: update_active` for a requested direct update, or `new_plan` (default) for a separate copy. Show the preview and honor explicit save instructions. Same-lift IDs/aliases are retained; omitted optional source details are inherited when unambiguous. Genuinely different equipment requires a separate exercise identity.

`save_plan_as_new` accepts the immutable proposal ID and explicit approval. It creates one new inactive plan and fixes the destination ID for retries. It checks source changes, expiry, ownership, existing receipts, and persistent deletion markers. A create-only plan write and a field-masked, version-guarded `planLibraryInitialized` settings write are committed together; other settings and the active-plan pointer are preserved. Retrying a delayed save cannot create duplicate plans or resurrect deleted revisions. No real plan was saved while implementing these tools.

`save_active_plan` updates the same existing active split using the exact previewed plan version and a field mask. It preserves the plan's creation time, template metadata, unrelated fields, and active selection. A settings-version guard prevents races with active-selection/deletion changes. Matching save receipts make retries idempotent; an old preview cannot overwrite later edits or recreate a missing/deleted plan. The encrypted proposal retains the pre-edit split, readable through `get_plan_preview` even after its save window expires, for an explicitly requested restoration. No actual user plan was edited while implementing this capability.

The user explicitly authorized direct active-split updates and accepts responsibility for ensuring no workout is in progress. Do not add a separate workout-state assertion or confirmation gate. Activating a different saved plan still uses **Make Active** in the app. Refresh the companion and copy its updated project instructions into Health; a new chat may be needed for refreshed plugin tools.

## Future reviews

Use `get_review_sources` for the private Daily Tracker reference and full workflow, `connection_status` for local connection state, and `get_workouts` for the requested date range. A stored connection is not proof of current remote access. Read all pages until `next_cursor` is null. The caller cannot select a different account ID; the Google identity chosen during setup fixes the account path.

Dates use America/Chicago. The supplied project instructions define "last two weeks" as the preceding 14 completed local calendar days unless the user specifies otherwise; keep today's incomplete day separate. Translate local boundaries to UTC with the correct daylight-saving offsets.

The food entries remain in the user's Health project's Daily Tracker conversation. The plugin provides its reference, not a diet database or a conversation-history API. Access to recent entries has previously been verified through the app's conversation tools, but exhaustive access to arbitrary older entries has not. Use actual dated entries or final corrected daily totals. Never add multiple running summaries for one day, silently assume completeness, treat missing food as zero, or invent unavailable dates. A future durable nutrition-store integration requires separate work and authorization to write the log.

The hosted token is encrypted under a Sites runtime secret and keyed to the Site-scoped ChatGPT user. It is separate from the Windows DPAPI connection. Read tools have read-only metadata; preview/new-copy saves have non-destructive write metadata; active updates are marked as overwriting existing content. The underlying account credential retains its normal permissions. Disconnect removes the hosted token without deleting workouts or food logs. Plan proposals and pre-edit copies are encrypted with owner-bound context.

## Hosting maintenance

- Site ID: `appgprj_6b03653ca7148191bf029e2a9da4c8ed`.
- Generated plugin ID: `plugin_asdk_app_sites_b90ee4c50ef08191879aeec292142fba`.
- MCP endpoint: `https://lift-health-companion.tenaciouscanopy3.chatgpt.site/mcp`.
- Published source commit: `5380ceefc437ef6e2ca8980ccfe8bd2c733cf6e7` in the Site's own repository.
- Original local source: `C:/Users/16362/.codex/visualizations/2026/11/22/01a204d9-d78f-7991-af3d-cbd874a65c4d/health-companion-site`.

Use Sites' existing-source workflow and the same exact Site ID to restore or update its source. Do not recreate the Site or deploy this whole workout app into it. Preserve owner-only permissions and its existing `DB` binding and runtime encryption secret. The Site's README documents build, testing, encryption, and sign-in configuration. Credentials and retrieved workout/food records must never be written to this repository.
