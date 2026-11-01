# Backend/domain boundary

The first milestone keeps server-side business logic in the Next.js application to reduce operational complexity. Domain modules must remain independent of UI components and persistence adapters.

Planned domains: identity/access, gym settings, staff, members, memberships, finance ledger, attendance, classes/bookings, workouts, nutrition, progress, media, CMS, notifications and audit.

Use PostgreSQL transactions for capacity-limited bookings and financial writes. Do not place waitlist membership in a serialized array column. Do not expose private data through public CMS/media endpoints.
