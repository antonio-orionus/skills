<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- review_stack_entry_start -->

<a href="https://app.coderabbit.ai/change-stack/antonio-orionus/Arroxy/pull/327?scope=REDACTED&amp;cs_source=review_comment"><picture><source media="(prefers-color-scheme: dark)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=3"><source media="(prefers-color-scheme: light)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg?v=3"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg?v=3" alt="Review in Change Stack →" height="32"></picture></a>

<!-- review_stack_entry_end -->
<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->

> [!WARNING]
> ## Review limit reached
> 
> You've used all free OSS reviews for now. Wait for the free limit to reset to keep reviewing this public repository.
> 
> **Next included review available in 44 minutes.**
> 
> [Check out review usage here](https://app.coderabbit.ai/dashboard/review-capacity?orgId=REDACTED).
> 
> <details>
> <summary><strong>View limit details</strong></summary>
> <dl>
> <dd>
> 
> **Limit details:** You’ve used all 4 included reviews currently available.
> 
> [Learn how review limits work](https://docs.coderabbit.ai/management/rate-limits).
> 
> **Review configuration:**
> 
> <details>
> <summary><strong>⚙️ Run configuration</strong></summary>
> <dl>
> <dd>
> 
> - **Configuration used**: Repository: antonio-orionus/Arroxy/.coderabbit.yaml
> - **Review profile**: ASSERTIVE
> - **Plan**: Advanced
> - **Run ID**: `bf3b5293-2d2b-4784-a1f7-8fa56eab028b`
> 
> </dd>
> </dl>
> </details>
> 
> <details>
> <summary><strong>📥 Commits</strong></summary>
> <dl>
> <dd>
> 
> Reviewing files that changed from the base of the PR and between 0868505d47959028e01e208ce017b5dc33caac43 and ef8ff87f65588caf0564814c34547346d9ea2859.
> 
> </dd>
> </dl>
> </details>
> 
> <details>
> <summary><strong>📒 Files selected for processing: 3</strong></summary>
> <dl>
> <dd>
> 
> * `src/renderer/src/components/wizard/HotkeySettingsSection.tsx`
> * `src/renderer/src/lib/acceleratorKey.ts`
> * `tests/renderer/hotkey-settings.test.tsx`
> 
> </dd>
> </dl>
> </details>
> 
> </dd>
> </dl>
> </details>

<!-- end of auto-generated comment: rate limited by coderabbit.ai -->

<!-- recent_review_start -->

No actionable comments were generated in the recent review. 🎉

<details>
<summary><strong>ℹ️ Recent review info</strong></summary>
<dl>
<dd>

<details>
<summary><strong>⚙️ Run configuration</strong></summary>
<dl>
<dd>

- **Configuration used**: Repository: antonio-orionus/Arroxy/.coderabbit.yaml
- **Review profile**: ASSERTIVE
- **Plan**: Advanced
- **Run ID**: `72b47f3f-ac05-4fde-a099-ba0d5021fae0`

</dd>
</dl>
</details>

<details>
<summary><strong>📥 Commits</strong></summary>
<dl>
<dd>

Reviewing files that changed from the base of the PR and between 86f767b3fbf08ede1c1bf0936774ab0e7525952b and 0868505d47959028e01e208ce017b5dc33caac43.

</dd>
</dl>
</details>

<details>
<summary><strong>📒 Files selected for processing: 13</strong></summary>
<dl>
<dd>

* `src/main/services/diagnosticRedaction.ts`
* `src/main/services/vhxTitleRecovery.ts`
* `src/renderer/src/browserMock.ts`
* `src/renderer/src/components/wizard/HotkeySettingsSection.tsx`
* `src/renderer/src/lib/acceleratorKey.ts`
* `src/shared/schemas.ts`
* `src/shared/sites/index.ts`
* `src/shared/sites/youtube.ts`
* `src/shared/urlIntent.ts`
* `tests/renderer/hotkey-settings.test.tsx`
* `tests/unit/diagnostic-redaction.test.ts`
* `tests/unit/probe-service-vhx-title.test.ts`
* `tests/unit/site-lookup.test.ts`

</dd>
</dl>
</details>

**Included review availability:** This review used your included allowance. Your plan provides up to 4 included reviews per hour; 3 remain after this review.

</dd>
</dl>
</details>


<!-- review_details_start -->

<details>
<summary><strong>📜 Recent review details</strong></summary>
<dl>
<dd>

<details>
<summary><strong>🧰 Additional context used</strong></summary>
<dl>
<dd>

<details>
<summary><strong>📚 Code guidelines: 2</strong></summary>

```
AGENTS.md — auto-discovered
dev-docs/in-app-updates.md — auto-discovered
```

</details><details>
<summary><strong>📓 Path-based instructions: 5</strong></summary>

<details>
<summary><strong>Review React/UI code for state correctness, accessibility, i18n regressions, unsafe DOM usage, IPC misuse, race conditions, and user-facing error handling.</strong></summary>


**⚙️ CodeRabbit configuration file**

**Files:**
- `src/renderer/src/components/wizard/HotkeySettingsSection.tsx`
- `src/renderer/src/lib/acceleratorKey.ts`
- `src/renderer/src/browserMock.ts`

</details>
<details>
<summary><strong>This is Electron main-process code.</strong></summary>


**⚙️ CodeRabbit configuration file**

**Files:**
- `src/main/services/diagnosticRedaction.ts`
- `src/main/services/vhxTitleRecovery.ts`

</details>
<details>
<summary><strong>Prioritize meaningful coverage, determinism, and whether tests validate behavior.</strong></summary>


**⚙️ CodeRabbit configuration file**

**Files:**
- `tests/unit/diagnostic-redaction.test.ts`
- `tests/unit/probe-service-vhx-title.test.ts`
- `tests/unit/site-lookup.test.ts`
- `tests/renderer/hotkey-settings.test.tsx`

</details>
<details>
<summary><strong>Source excerpt: `README.md` and every `README.{lang}.md` are **generated** from `readme-src/` by `node readme-src/build.mjs`: never edit them, or their `Last updated:` stamp, directly.</strong></summary>


**📄 CodeRabbit inference engine (AGENTS.md)**

**Files:**
- `src/shared/schemas.ts`
- `tests/unit/diagnostic-redaction.test.ts`
- `src/shared/sites/youtube.ts`
- `src/renderer/src/components/wizard/HotkeySettingsSection.tsx`
- `src/renderer/src/lib/acceleratorKey.ts`
- `tests/unit/probe-service-vhx-title.test.ts`
- `src/renderer/src/browserMock.ts`
- `tests/unit/site-lookup.test.ts`
- `src/main/services/diagnosticRedaction.ts`
- `src/shared/urlIntent.ts`
- `src/shared/sites/index.ts`
- `tests/renderer/hotkey-settings.test.tsx`
- `src/main/services/vhxTitleRecovery.ts`

</details>
<details>
<summary><strong>Applicability reference: AGENTS.md: # Project-Scoped `electron-updater` checks 5 s after launch and every 6 h after, announcing each version once; auto-download is **off**, the user starts every update.</strong></summary>


**📄 CodeRabbit inference engine (dev-docs/in-app-updates.md)**

**Files:**
- `src/renderer/src/browserMock.ts`

</details>

</details><details>
<summary><strong>🪛 ast-grep (0.45.3)</strong></summary>

<details>
<summary><strong>src/shared/schemas.ts</strong></summary>

[warning] 294-294: Regular expression constructed from variable input detected. This can lead to Regular Expression Denial of Service (ReDoS) attacks if the variable contains malicious patterns. Use libraries like 'recheck' to validate regex safety or use static patterns.
Context: new RegExp(`^${HOTKEY_MODIFIER}(?:\\+${HOTKEY_MODIFIER})*\\+${HOTKEY_KEY}$`)
Note: [CWE-1333] Inefficient Regular Expression Complexity

(regexp-from-variable)

</details>

</details>
<details>
<summary><strong>🪛 OpenGrep (1.30.1)</strong></summary>
<dl>
<dd>

<details>
<summary><strong>src/renderer/src/lib/acceleratorKey.ts</strong></summary>
<dl>
<dd>

[ERROR] 52-52: A nonliteral argument is passed to exec/execSync. Identify the receiver: Node child_process methods execute shell commands, while regular-expression and database methods have different contracts. For shell execution, prefer execFile or spawn with an argument array.


(coderabbit.command-injection.exec-js)



[ERROR] 54-54: A nonliteral argument is passed to exec/execSync. Identify the receiver: Node child_process methods execute shell commands, while regular-expression and database methods have different contracts. For shell execution, prefer execFile or spawn with an argument array.


(coderabbit.command-injection.exec-js)



[ERROR] 56-56: A nonliteral argument is passed to exec/execSync. Identify the receiver: Node child_process methods execute shell commands, while regular-expression and database methods have different contracts. For shell execution, prefer execFile or spawn with an argument array.


(coderabbit.command-injection.exec-js)

</dd>
</dl>
</details>

</dd>
</dl>
</details>

</dd>
</dl>
</details>

<details>
<summary><strong>🔇 Additional comments: 13</strong></summary><blockquote>

<details>
<summary><strong>src/main/services/vhxTitleRecovery.ts: 1</strong></summary><blockquote>

`21-21`: LGTM!



Also applies to: 120-137, 139-139, 146-148

<!-- cr-comment:v1:60ce49dbc97535027ee6bbd9 -->

</blockquote></details>
<details>
<summary><strong>tests/unit/probe-service-vhx-title.test.ts: 1</strong></summary><blockquote>

`125-141`: LGTM!

<!-- cr-comment:v1:b7537175d1ef926b3f2c2360 -->

</blockquote></details>
<details>
<summary><strong>src/main/services/diagnosticRedaction.ts: 1</strong></summary><blockquote>

`1-4`: LGTM!



Also applies to: 7-9, 12-12, 21-24

<!-- cr-comment:v1:47e92c44c88b9aff2f5a191d -->

</blockquote></details>
<details>
<summary><strong>tests/unit/diagnostic-redaction.test.ts: 1</strong></summary><blockquote>

`20-30`: LGTM!

<!-- cr-comment:v1:f2bed1769edfa3f04dc808d5 -->

</blockquote></details>
<details>
<summary><strong>src/shared/sites/youtube.ts: 1</strong></summary><blockquote>

`12-19`: LGTM!



Also applies to: 59-59

<!-- cr-comment:v1:5cfac0e2dff1892076b29868 -->

</blockquote></details>
<details>
<summary><strong>src/shared/sites/index.ts: 1</strong></summary><blockquote>

`10-10`: LGTM!



Also applies to: 15-15, 17-17, 33-33, 60-60

<!-- cr-comment:v1:ef97f003e3a4a1b65bab42e7 -->

</blockquote></details>
<details>
<summary><strong>src/shared/urlIntent.ts: 1</strong></summary><blockquote>

`2-2`: LGTM!



Also applies to: 67-67, 136-136

<!-- cr-comment:v1:74fb872c63f9767eda8d0487 -->

</blockquote></details>
<details>
<summary><strong>src/renderer/src/browserMock.ts: 1</strong></summary><blockquote>

`2-2`: LGTM!



Also applies to: 90-90

<!-- cr-comment:v1:9742401f45f6ee8914c67495 -->

</blockquote></details>
<details>
<summary><strong>tests/unit/site-lookup.test.ts: 1</strong></summary><blockquote>

`3-3`: LGTM!



Also applies to: 77-90

<!-- cr-comment:v1:36eb9fda40b9cb057816b43e -->

</blockquote></details>
<details>
<summary><strong>src/renderer/src/lib/acceleratorKey.ts: 1</strong></summary><blockquote>

`1-60`: LGTM!

<!-- cr-comment:v1:99ea9823c179867e603e234e -->

</blockquote></details>
<details>
<summary><strong>src/shared/schemas.ts: 1</strong></summary><blockquote>

`283-295`: LGTM!

<!-- cr-comment:v1:58b97275d9fbd45b5d027ee0 -->

</blockquote></details>
<details>
<summary><strong>tests/renderer/hotkey-settings.test.tsx: 1</strong></summary><blockquote>

`87-87`: LGTM!



Also applies to: 98-98, 103-138, 145-146, 178-185

<!-- cr-comment:v1:17e642ed0988b9e457af863b -->

</blockquote></details>
<details>
<summary><strong>src/renderer/src/components/wizard/HotkeySettingsSection.tsx: 1</strong></summary><blockquote>

`124-124`: **🎯 Functional Correctness**

The claim depends on Electron 44.6.0 accelerator behavior, which is not established by the supplied repository source. The recorder maps the physical `event.code` to a character accelerator, but the repository does not show whether Electron registers that accelerator by physical key or by the character produced by the active keyboard layout. The proposed layout-specific correction cannot be selected safely without that contract.

<!-- cr-comment:v1:07e306fae9b45b6e91a21e55 -->

</blockquote></details>

</blockquote></details>

</dd>
</dl>
</details>

<!-- review_details_end -->





<!-- recent_review_end -->
<!-- walkthrough_start -->

<details>
<summary><strong>📝 Walkthrough</strong></summary>
<dl>
<dd>

The pull request updates diagnostic redaction, private IP detection, shared YouTube hostname recognition, and hotkey capture and validation.

**Changes: Diagnostic redaction**

|Layer / File(s)|Summary|
|:---|:---|
|**Redaction behavior and coverage** <br> `src/main/services/diagnosticRedaction.ts`, `tests/unit/diagnostic-redaction.test.ts`|`redactDiagnosticLog` delegates redaction to `redactText` with `ALWAYS_REDACT` and adds redaction for `pot` and `lsig` query values. Tests cover signed-media URL values and yt-dlp extractor arguments.|

**Private hostname detection**

|Layer / File(s)|Summary|
|:---|:---|
|**IP address checks and tests** <br> `src/main/services/vhxTitleRecovery.ts`, `tests/unit/probe-service-vhx-title.test.ts`|`isPrivateHostname` uses Node’s IP parsing and `BlockList` for blocked IPv4 and IPv6 ranges. Tests cover mapped, private, and public address cases.|

**YouTube hostname detection**

|Layer / File(s)|Summary|
|:---|:---|
|**Shared YouTube hostname helper** <br> `src/shared/sites/youtube.ts`|`isYouTubeHostname` recognizes `youtu.be`, `youtube.com` and its subdomains, and `youtube-nocookie.com` and its subdomains.|
|**URL and playlist-probe consumers** <br> `src/shared/sites/index.ts`, `src/shared/urlIntent.ts`, `src/renderer/src/browserMock.ts`, `tests/unit/site-lookup.test.ts`|Site lookup, URL intent, and playlist-probe detection use the shared helper. Tests cover recognized hosts and lookalikes.|

**Hotkey capture and validation**

|Layer / File(s)|Summary|
|:---|:---|
|**Accelerator mapping and schema** <br> `src/renderer/src/lib/acceleratorKey.ts`, `src/shared/schemas.ts`|`acceleratorKeyFromCode` maps supported physical keyboard codes to Electron accelerator names. The schema accepts the expanded key set and transforms trailing `+Backquote` values.|
|**Recording integration and tests** <br> `src/renderer/src/components/wizard/HotkeySettingsSection.tsx`, `tests/renderer/hotkey-settings.test.tsx`|Hotkey recording derives the key from `event.code`. Tests cover physical keys, modifier handling, and schema behavior.|

<!-- change_assessment_start -->
**Priority:** ➖ Normal







**Estimated code review effort:** 4 (Complex) | ~40 minutes

<!-- change_assessment_commit:"0868505d47959028e01e208ce017b5dc33caac43" -->
**Change:** Bug fix
<!-- change_assessment_end -->

**Suggested labels:** `bug`

</dd>
</dl>
</details>

<!-- walkthrough_end -->
<details>
<summary><strong>Merge Risk:</strong> <strong>⚪ Minimal</strong> · up to <code>08685</code></summary>
<dl>
<dd>

<!-- final_review_risk_start -->
<!-- final_review_risk_label
**Merge Risk:** **⚪ Minimal** · up to `08685`
-->
<!-- final_review_risk_coverage:{"sourceCommitId":"0868505d47959028e01e208ce017b5dc33caac43","coveredCommitId":"0868505d47959028e01e208ce017b5dc33caac43","kind":"reviewed"} -->

No actionable issue was established that should prevent merging. The recorded hotkey’s behavior on non-QWERTY macOS and Linux layouts remains unverified.
<!-- final_review_risk_end -->

</dd>
</dl>
</details>
<!-- pre_merge_checks_walkthrough_start -->

<details>
<summary><strong>Pre-merge checks: <sup><picture><img src="https://storage.googleapis.com/coderabbit_public_assets/pre-merge-checks-counter-passed-14-v2.svg" width="14" height="14" align="middle" alt="Passed" title="Passed"></picture></sup> 4</strong></summary>
<dl>
<dd>

|         Check name         |                                             Status                                             | Explanation                                                                                                                                                                                               |
| :------------------------ | :--------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|         Title check        | ![Passed](https://storage.googleapis.com/coderabbit_public_assets/pre-merge-checks-passed.svg) | The title clearly summarizes the four main fixes: the SSRF guard, YouTube nocookie site lookup, hotkey recorder, and diagnostic redaction.                                                                |
|     Linked Issues check    | ![Passed](https://storage.googleapis.com/coderabbit_public_assets/pre-merge-checks-passed.svg) | Check skipped because no linked issues were found for this pull request.                                                                                                                                  |
| Out of Scope Changes check | ![Passed](https://storage.googleapis.com/coderabbit_public_assets/pre-merge-checks-passed.svg) | Check skipped because no linked issues were found for this pull request.                                                                                                                                  |
|      Description check     | ![Passed](https://storage.googleapis.com/coderabbit_public_assets/pre-merge-checks-passed.svg) | The description clearly explains all four fixes, their causes, implementation details, and tests. It reports that `bun run check` passes. It does not use the template headings or explicitly confirm th… |

<details>
<summary><strong>Full details: Description check</strong></summary>
<dl>
<dd>

**Explanation**

The description clearly explains all four fixes, their causes, implementation details, and tests. It reports that `bun run check` passes. It does not use the template headings or explicitly confirm the base branch and change type, but the content is otherwise complete and relevant.

</dd>
</dl>
</details>

</dd>
</dl>
</details>

<!-- pre_merge_checks_walkthrough_end -->
<!-- finishing_touch_checkbox_start -->

<details>
<summary><strong>✨ Finishing Touches</strong></summary>
<dl>
<dd>

<details open>
<summary><strong>📝 Generate docstrings</strong></summary>
<dl>
<dd>

- [ ] <!-- {"checkboxId":"3e1879ae-f29b-4d0d-8e06-d12b7ba33d98"} --> Commit to this branch
- [ ] <!-- {"checkboxId":"7962f53c-55bc-4827-bfbf-6a18da830691"} --> Create a new PR

</dd>
</dl>
</details>
<details open>
<summary><strong>🧪 Generate unit tests (beta)</strong></summary>
<dl>
<dd>

- [ ] <!-- {"checkboxId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "radioGroupId": "utg-output-choice-group-6268933368"} --> Commit to this branch
- [ ] <!-- {"checkboxId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "radioGroupId": "utg-output-choice-group-6268933368"} --> Create a new PR

</dd>
</dl>
</details>

</dd>
</dl>
</details>

<!-- finishing_touch_checkbox_end -->

<!-- autopilot:start -->
- [ ] <!-- {"checkboxId":"2708ad07-9f24-4260-9c11-7dc76a49f2e3"} --> <strong title="Keep fixing CodeRabbit findings and required CI, and resolving merge conflicts">Autofix</strong> · Keep fixing CodeRabbit findings and required CI, and resolving merge conflicts
<!-- autopilot:end -->
<!-- tips_start -->



Thanks for using [CodeRabbit](https://coderabbit.ai?utm_source=oss&utm_medium=github&utm_campaign=antonio-orionus/Arroxy&utm_content=327)! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.

<details>
<summary><strong>❤️ Share</strong></summary>
<dl>
<dd>

- [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A&url=https%3A//coderabbit.ai)
- [Mastodon](https://mastodon.social/share?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A%20https%3A%2F%2Fcoderabbit.ai)
- [Reddit](https://www.reddit.com/submit?title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&text=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code.%20Check%20it%20out%3A%20https%3A//coderabbit.ai)
- [LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcoderabbit.ai&mini=true&title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&summary=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code)

</dd>
</dl>
</details>


<sub>Comment `@coderabbitai help` to get the list of available commands.</sub>

<!-- tips_end -->
