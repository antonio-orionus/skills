<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- review_stack_entry_start -->

[![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/antonio-orionus/Arroxy/pull/201)

<!-- review_stack_entry_end -->
<!-- This is an auto-generated comment: skip review by coderabbit.ai -->

> [!IMPORTANT]
> ## Review skipped
> 
> Auto reviews are disabled on this repository. Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command.
> 
> <details>
> <summary>⚙️ Run configuration</summary>
> 
> **Configuration used**: Path: .coderabbit.yaml
> 
> **Review profile**: ASSERTIVE
> 
> **Plan**: Team
> 
> **Run ID**: `16bee87c-488b-43c4-91d2-5f11c065aed7`
> 
> </details>
> 
> You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file.
> 
> Use the checkbox below for a quick retry:
> - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> 🔍 Trigger review

<!-- end of auto-generated comment: skip review by coderabbit.ai -->

<!-- walkthrough_start -->

<details>
<summary>📝 Walkthrough</summary>

## Walkthrough

### Changes

The pull request adds hotkey registration state, shortcut hints, reset support, localization, and settings navigation. It also pins build assets, validates download caches, adds macOS signing, introduces Windows Defender scanning, improves portable notifications, and repairs invalid persisted profiles.

**Global hotkey experience**

|Layer / File(s)|Summary|
|---|---|
|**Hotkey contracts and defaults** <br> `src/shared/schemas.ts`, `src/shared/types.ts`, `src/shared/constants.ts`, `src/renderer/src/store/types.ts`, `src/shared/i18n/locales/*`, `i18n/locales/*`, `src/renderer/src/browserMock.ts`|Defines hotkey registration states, defaults, mock behavior, and localized hint and reset text.|
|**Registration state flow** <br> `src/renderer/src/store/systemSlice.ts`|Tracks pending, registered, conflict, and disabled states. It refreshes status through IPC and handles stale responses and failed updates.|
|**Shortcut display and settings interaction** <br> `src/renderer/src/lib/hotkeyLabel.ts`, `src/renderer/src/components/ui/kbd.tsx`, `src/renderer/src/components/wizard/*`, `src/renderer/src/dev/browserMockScenarios.ts`, `tests/renderer/*`, `tests/e2e/fixtureHarness.ts`|Formats platform-specific chords, adds the quick-download hint, supports reset and hotkey settings navigation, and covers the new behavior with tests and a mock scenario.|

**Build and installer validation**

|Layer / File(s)|Summary|
|---|---|
|**Pinned assets and checksum-aware downloads** <br> `scripts/build/btbnResolver.ts`, `scripts/build/fetch-embedded.sh`, `scripts/test-binaries/_lib.sh`, `tests/unit/btbn-resolver.test.ts`, `tests/scripts/fetch-lib-cache.test.ts`|Uses a pinned BtbN release by default and rejects invalid or incomplete cached downloads.|
|**Platform packaging hooks** <br> `build/afterPack.mjs`, `tests/unit/release-asset-names.test.ts`|Applies Electron fuses on macOS and Linux, signs macOS bundles, and wraps Linux executables.|
|**Windows artifact scan and workflow gate** <br> `.github/workflows/installer-smoke.yml`, `scripts/test-binaries/scan-windows-defender.ps1`, `tests/unit/release-asset-names.test.ts`|Adds scheduled and manual build options, scans required Windows binaries with Defender, and applies different failure handling for tag builds.|

**Windows notification routing**

|Layer / File(s)|Summary|
|---|---|
|**Windows notification identity** <br> `src/shared/constants.ts`, `src/main/index.ts`, `tests/unit/release-asset-names.test.ts`|Sets the Windows AppUserModelID before notifications are created and verifies it against the packaging configuration.|
|**Portable tray balloon routing** <br> `src/main/services/TrayManager.ts`, `src/main/services/hotkeyOsNotifier.ts`, `src/main/index.ts`, `tests/unit/hotkey-os-notifier.test.ts`|Uses tray balloons for portable Windows hotkey notifications and falls back to Electron notifications when no tray is available.|

**Settings profile normalization**

|Layer / File(s)|Summary|
|---|---|
|**Profile migration and repair** <br> `src/main/stores/SettingsStore.ts`, `tests/unit/settings-store.test.ts`, `tests/unit/download-profile-draft.test.ts`, `tests/unit/download-profiles.test.ts`|Validates profiles individually, removes invalid entries, repairs active references, applies legacy schema defaults, and logs migration summaries.|

**Estimated code review effort:** 5 (Critical) | ~100 minutes

<!-- final_review_risk_start -->
**Merge Risk:** _🟠 High_ · up to `c2cb1`

This PR changes shortcut state handling and Windows release validation, but overlapping shortcut updates can leave an unsaved accelerator and Windows tag releases can still publish after Defender rejects the packaged payload; the changed test module also has a known compilation issue. The PR should not merge until these risks are fixed or explicitly accepted.
<!-- final_review_risk_end -->

**Suggested labels:** `enhancement`, `bug`, `documentation`, `github_actions`

</details>

<!-- walkthrough_end -->
<!-- pre_merge_checks_walkthrough_start -->

<details>
<summary>🚥 Pre-merge checks | ✅ 3 | ❌ 1</summary>

### ❌ Failed checks (1 warning)

|     Check name    | Status     | Explanation                                                                                                                                                                                               | Resolution                                                                                                                                                                                                                                        |
| :---------------: | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Description check | ⚠️ Warning | The description provides a detailed summary and records validation commands, but it omits the required Base branch and Type sections and does not provide the required Testing section with manual verif… | Add the Base branch section and confirm the PR targets main. Select the applicable Type checkbox. Add a Testing section that documents the platform, scenario, and observed results. Keep the existing validation commands under the Checks sect… |

<details>
<summary>✅ Passed checks (3 passed)</summary>

|         Check name         | Status   | Explanation                                                                                                                                 |
| :------------------------: | :------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
|         Title check        | ✅ Passed | The title clearly identifies the Quick Download hotkey hint and release hardening changes. It is concise and related to the main changeset. |
|     Linked Issues check    | ✅ Passed | Check skipped because no linked issues were found for this pull request.                                                                    |
| Out of Scope Changes check | ✅ Passed | Check skipped because no linked issues were found for this pull request.                                                                    |

</details>

<details>
<summary>Full details: Description check</summary>

**Explanation**

The description provides a detailed summary and records validation commands, but it omits the required Base branch and Type sections and does not provide the required Testing section with manual verification details.

**Resolution**

Add the Base branch section and confirm the PR targets main. Select the applicable Type checkbox. Add a Testing section that documents the platform, scenario, and observed results. Keep the existing validation commands under the Checks section or clearly label them as automated checks.

</details>

</details>

<!-- pre_merge_checks_walkthrough_end -->
<!-- finishing_touch_checkbox_start -->

<details>
<summary>✨ Finishing Touches</summary>

<details>
<summary>📝 Generate docstrings</summary>

- [ ] <!-- {"checkboxId":"7962f53c-55bc-4827-bfbf-6a18da830691"} --> Create stacked PR
- [ ] <!-- {"checkboxId":"3e1879ae-f29b-4d0d-8e06-d12b7ba33d98"} --> Commit on current branch

</details>
<details>
<summary>🧪 Generate unit tests (beta)</summary>

- [ ] <!-- {"checkboxId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "radioGroupId": "utg-output-choice-group-5509733615"} -->   Create PR with unit tests
- [ ] <!-- {"checkboxId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "radioGroupId": "utg-output-choice-group-5509733615"} -->   Commit unit tests in branch `feat/quick-download-hotkey-hint`

</details>

</details>

<!-- finishing_touch_checkbox_end -->
<!-- tips_start -->

---

Thanks for using [CodeRabbit](https://coderabbit.ai?utm_source=oss&utm_medium=github&utm_campaign=antonio-orionus/Arroxy&utm_content=201)! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.

<details>
<summary>❤️ Share</summary>

- [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A&url=https%3A//coderabbit.ai)
- [Mastodon](https://mastodon.social/share?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A%20https%3A%2F%2Fcoderabbit.ai)
- [Reddit](https://www.reddit.com/submit?title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&text=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code.%20Check%20it%20out%3A%20https%3A//coderabbit.ai)
- [LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcoderabbit.ai&mini=true&title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&summary=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code)

</details>


<sub>Comment `@coderabbitai help` to get the list of available commands.</sub>

<!-- tips_end -->
