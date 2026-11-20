# Project guidance

- Organization users come from Dataverse `systemusers`; selectable users must be enabled and Read-Write (`isdisabled eq false and accessmode eq 0`).
- Project owner, idea owner, task owner, and task requester lookups bind to `/systemusers(<id>)`. Do not create or manage PersonUser records in the app.
