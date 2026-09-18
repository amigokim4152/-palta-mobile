# Golden User 001 branch concurrency note

On 2026-09-18, multiple parallel work sessions wrote contradictory Auth changes to `integration/golden-user-001-v1` within the same minute. One path implemented development synthetic Auth while another explicitly removed it and restored provider-only Auth.

To prevent silent overwrites, executable Gate 01A synthetic Auth implementation must continue on the focused branch `integration/golden-user-001-auth-synthetic-v1`. The controller branch should only be advanced to that verified implementation after Gate 01A checks pass and the branch head is rechecked for concurrent changes.

Do not force-update either branch over newer work.
