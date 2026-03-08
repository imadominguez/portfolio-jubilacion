# Project Coding Rules

## General Principles

- Prefer simplicity over complexity.
- Keep business logic separate from UI components.
- Use TypeScript strictly.
- Avoid unnecessary abstractions.

---

# Next.js Rules

- Use App Router architecture.
- Prefer Server Components.
- Use Server Actions for mutations.
- Avoid unnecessary API routes.

---

# Database Rules

- All database access must go through Prisma.
- Use clear relational modeling.
- Avoid duplicating financial data unless needed for historical accuracy.

---

# State Management

- Use Zustand only for client UI state.
- Do not store server data in Zustand.

---

# Financial Data Rules

- Never overwrite historical portfolio snapshots.
- Always preserve imported financial data.
- Use immutable records for portfolio history.

---

# UI Rules

- Use shadcn/ui components.
- Follow dashboard UI patterns.
- Use responsive design.

---

# Code Quality

- Small components
- Strong typing
- Clear naming
- Avoid premature optimization
