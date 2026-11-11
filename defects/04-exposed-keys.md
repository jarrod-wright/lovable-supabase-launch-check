# Class 4 - keys in the bundle and in git history (fixed-list item 5)

Synthetic demo. Built to be broken. No client data, no real keys.

## What it looks like on `before`

A service-role-shaped key sits in the client tree, and an early commit carried it;
a later commit removed it from the working tree but the history keeps it. The value
is a dummy shaped like the real thing; the placement is the defect.

## Its check

`repro/run_checks.py` decodes JWT-shaped strings in the tree and in full git
history and flags any carrying a `service_role` claim.

## The failing reproduction

Run: `git log -p --all | grep -c service_role`. The count is not zero. On a fixed
app the service key exists only in server-side secrets, and history is cleaned
before the repository goes public.
