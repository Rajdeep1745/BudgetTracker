# Pocket Plan design decisions

UI UX Pro Max was consulted for the product design system and Flutter guidance. The supplied website palette takes priority: #290044 deep purple, #500071 primary purple, #8A2A78 plum, and #EEE3B0 cream. Guidance emphasizes readable contrast, shared state, and native navigation. The generic marketing-page pattern and handwritten font suggestion did not fit an expense tracker; this implementation uses a native task-focused shell and bundled Roboto instead.

- Four bottom destinations: Overview, Plan, Insights, Settings. Activity is a focused secondary route; adding an expense uses a keyboard-aware bottom sheet.
- Deep-purple balance card with cream details, purple primary actions, plum secondary accents, neutral light surfaces, and independently mapped purple dark surfaces. Cream actions on dark surfaces keep labels readable. Website mark retained without changing its artwork.
- 24dp phone gutters, 640dp maximum tablet content width, 4/8dp spacing rhythm, rounded 24dp panels, 48dp minimum Material controls.
- Amount is first in expense entry. Category selection and date picker use native Flutter controls. Failed saves retain data and show the server message.
- Typography follows system text scaling. Reports use a dropdown instead of a segmented control when enlarged text needs more room. Charts also expose a numerical and semantic summary.
- Budget edits are calculated locally for preview and sent as one existing API payload. Destructive actions and abandoning edited plans require explicit confirmation inside the app.
- Theme and currency preferences stay on device, matching the website's preference scope. Shared financial settings remain on the backend.

Tailwind is not applicable to Flutter widgets; styling uses centralized ThemeData and reusable Dart components.

- API routing is configured through a build-time `.env` file. Customers see connection recovery messages and a retry button; there is no address editor or stored endpoint override.
