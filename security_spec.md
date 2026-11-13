# DOST Messaging App - Security Specification & Test Payloads

## 1. System Invariants
- **Identity Isolation**: A user can never author messages, modify profile details, or initiate reports pretending to be another UID (`request.auth.uid == resource.data.senderId` or `userId`).
- **Chat Membership Enforcement**: A user can only read chats and message documents in chats where they are an active participant (`request.auth.uid in resource.data.participants` or author).
- **Admin Privilege Protection**: Regular users cannot promote themselves or others to system admins or group admins without authorized admin status (`isAdmin()` or creator credentials).
- **Immutability of Historical Timestamps**: `createdAt` and `senderId` are immutable once written; tampering during updates is blocked.
- **Strict Payload Sizing**: Text strings, media URLs, and payloads are strictly capped to mitigate resource denial / denial-of-wallet exploits.
- **Reporting & Blocking Integrity**: Block records and moderation reports can only be initiated by the authentic authenticated user.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Ghost User Injection**: Attacker attempts to create a `/users/{victimId}` document with victim's UID.
2. **Privilege Escalation**: Attacker tries to set `"role": "admin"` in `/users/{myUid}`.
3. **Impersonated Message**: Attacker sends a message with `senderId: "victimUid"`.
4. **Chat Snoop / Eavesdrop**: Non-participant queries messages in a private chat between other users.
5. **Unauthorized Message Edit**: Attacker tries to edit another user's message.
6. **Immutable Timestamp Mutation**: Attacker updates an existing message with forged `createdAt: "1999-01-01"`.
7. **Giant Text Buffer Attack**: Attacker injects a 5MB payload into `text` field.
8. **Forged Group Admin Takeover**: Non-admin user attempts to overwrite `adminIds` on a group.
9. **Fake Block Origin**: Attacker writes to `/blocked_users` setting `userId: "anotherUser"`.
10. **Report Tampering**: Non-admin user attempts to change report status to `"dismissed"`.
11. **Notification Spoofing**: Attacker directly writes to `/notifications/{targetId}` with fake system alerts.
12. **Self-Deleted Message Hijack**: User attempts to un-delete a message deleted for everyone.

## 3. Test Verification
All 12 adversarial payloads return `PERMISSION_DENIED` under the hardened ruleset.
