# Health project integration

Private setup page: https://lift-health-companion.tenaciouscanopy3.chatgpt.site

The **Lift Health Companion** Site exposes read-only workout tools to its generated ChatGPT plugin. It is separate from the Lift Tracker PWA. It does not modify plans, workout records, account rules, or Daily Tracker messages.

## User setup still required

1. Open the private setup page while signed into the owning ChatGPT account.
2. Complete Google sign-in using the same account used in Lift Tracker.
3. Install/connect **Lift Health Companion** in ChatGPT Plugins → Personal → Created by you, then select it in a Health-project chat.
4. Copy the page's review instructions into the Health project's instructions. These point to the existing **Daily Tracker** conversation and define date windows, completeness checks, estimates, and correction handling. This task has no supported tool to edit project instructions directly.

If Google reports an unauthorized domain, the project owner must deliberately authorize the exact hostname `lift-health-companion.tenaciouscanopy3.chatgpt.site` in the existing project's authentication settings. The project is `lift-tracker-8674a`. This task has not changed authorized domains, account permissions, or database rules. Do not use wildcard domains.

Deployment and schema provisioning were verified. Nine synthetic tests passed, covering caller isolation, credential encryption, date ranges, paging, setup requests, and safe disconnect. Real Google sign-in, plugin connection, complete food-history retrieval, iPhone behavior, and a real combined review remain unverified until user setup is finished.

## Future reviews

Use `get_review_sources` for the private Daily Tracker reference and full workflow, `connection_status` for local connection state, and `get_workouts` for the requested date range. A stored connection is not proof of current remote access. Read all pages until `next_cursor` is null. The caller cannot select a different account ID; the Google identity chosen during setup fixes the account path.

Dates use America/Chicago. The supplied project instructions define "last two weeks" as the preceding 14 completed local calendar days unless the user specifies otherwise; keep today's incomplete day separate. Translate local boundaries to UTC with the correct daylight-saving offsets.

The food entries remain in the user's Health project's Daily Tracker conversation. The plugin provides its reference, not a diet database or a conversation-history API. Access to recent entries has previously been verified through the app's conversation tools, but exhaustive access to arbitrary older entries has not. Use actual dated entries or final corrected daily totals. Never add multiple running summaries for one day, silently assume completeness, treat missing food as zero, or invent unavailable dates. A future durable nutrition-store integration requires separate work and authorization to write the log.

The hosted token is encrypted under a Sites runtime secret and keyed to the Site-scoped ChatGPT user. It is separate from the Windows DPAPI connection. Only read tools are exposed, but the underlying Google/Firebase account credential retains the account's normal permissions. Disconnect on the setup page removes the hosted copy without deleting workouts or food logs.

## Hosting maintenance

- Site ID: `appgprj_6b03653ca7148191bf029e2a9da4c8ed`.
- Generated plugin ID: `plugin_asdk_app_sites_b90ee4c50ef08191879aeec292142fba`.
- MCP endpoint: `https://lift-health-companion.tenaciouscanopy3.chatgpt.site/mcp`.
- Published source commit: `9542883397b5321dbbf9e6aa185859b9a1a8fb46` in the Site's own repository.
- Original local source: `C:/Users/16362/.codex/visualizations/2026/11/22/01a204d9-d78f-7991-af3d-cbd874a65c4d/health-companion-site`.

Use Sites' existing-source workflow and the same exact Site ID to restore or update its source. Do not recreate the Site or deploy this whole workout app into it. Preserve owner-only permissions and its existing `DB` binding and runtime encryption secret. The Site's README documents build, testing, encryption, and sign-in configuration. Credentials and retrieved workout/food records must never be written to this repository.
