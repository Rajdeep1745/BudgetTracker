# Pocket Plan mobile

A native Flutter companion for the existing PocketPlan website. Android and iOS projects live here; the website and backend are unchanged. Uses the website logo, bundled Roboto typography, Material controls, the website's deep-purple/plum/cream palette, and light, dark, and device-following themes.

## Features

- Overview: month selection, remaining budget, Personal/Household pockets, savings, budget alerts, pull to refresh, and activity.
- Expenses: quick-entry bottom sheet, category and date selection, notes, edit, confirmed delete, server pagination, search, date/category filters, and sorting by date/category/description/amount in either direction. Tap an entry to edit or delete it.
- Plan: allowance, monthly fixed-cost amounts, optional negative carry-in, shared existing savings, monthly savings target, live calculations, and the Personal/Household split. Leaving an edited plan asks before discarding changes.
- Insights: selected-day spending, cumulative spending, remaining daily allowance, actual/ideal/projected pace, and top five categories for each pocket.
- Settings: persistent device currency, alert threshold, and appearance; shared fixed-cost/category management and carry-in settings.
- Connection failures provide retry. Forms retain inputs on failed saves. There is no offline mutation queue.

## Run

Install Flutter and Android SDK. From this directory, copy `.env.example` to `.env` and configure your backend:

```dotenv
API_BASE_URL=https://YOUR-BACKEND/api
```

Then run:

```sh
flutter pub get
flutter run --dart-define-from-file=.env
```

The API address includes `/api` and is injected at build time using Flutter's built-in environment support. `.env` is ignored by Git and is not bundled as an asset. The installed app has no API address field or device override; changing the address requires rebuilding. Old saved server preferences are ignored. A missing or invalid value shows a service-unavailable screen instead of prompting users for an address.

The supplied `.env.example` uses `http://10.0.2.2:5000/api` for an Android emulator. A local `.env` is initialized with that development address. For an iOS simulator or web preview, use `http://localhost:5000/api`. For a physical phone, set a reachable LAN address or a deployed HTTPS URL. Production builds must use your deployed HTTPS backend. API addresses are part of the compiled client configuration, so do not put secrets in this file.

Debug Android builds allow local HTTP. Release Android builds require HTTPS. iOS permits local networking, but deployed servers should use HTTPS. On-device LAN access may require granting the iOS local-network prompt and allowing the backend port through the host firewall.

The app intentionally follows the existing API's shared-budget model and does not add accounts or authentication. Currency changes affect display only and do not convert amounts. Fixed-cost and carry-in settings apply from the actual current month forward; viewing an older month does not change that effective date.

## Verify and build

```sh
dart format --output=none --set-exit-if-changed lib test tool
flutter analyze
flutter test
flutter build apk --debug --dart-define-from-file=.env
flutter build apk --release --dart-define-from-file=.env
flutter build web --dart-define-from-file=.env
```

Android outputs: `build/app/outputs/flutter-apk/app-debug.apk` and `app-release.apk`.

The generated release configuration currently uses the development signing key for local installation. Configure your own release signing before publishing to Google Play. iOS builds require macOS, Xcode, and your Apple signing configuration; they cannot be built on this Windows workstation.

Tests cover report calculations, future expenses, month-end and overspending edges, API error handling, deletion responses, preferences and URL validation, query filters/pagination, expense and budget submission, failed saves, navigation, and layout at phone/landscape/tablet sizes with enlarged text and reduced motion. API responses in automated tests are mocked; tests do not write to your database.

Render the actual Flutter widgets with fixtures for visual review:

```sh
flutter test test/ui_review_test.dart --dart-define=WRITE_UI_REVIEW=true
```

Screenshots are written to `build/ui-review/`. Rebuild platform icons from the original website SVG with `flutter test tool/generate_assets.dart`.

## Code layout

- `lib/core/config.dart`: validated build-time `API_BASE_URL` configuration.
- `lib/core/store.dart`: shared observable state, existing REST API client, preferences, race-safe loads, report calculations.
- `lib/widgets/common.dart`: semantic theme, reusable panels, states, confirmations, formatting primitives.
- `lib/screens/`: budget, expense/activity, insights, and settings screens.
- `lib/main.dart`: startup, four-tab navigation, month selection, overview.
- `assets/`: original website mark and bundled fonts/licenses.

No additional backend endpoints or database migrations are required. Same-category/day additions are merged by the existing backend; editing into an occupied daily entry surfaces its conflict message.
