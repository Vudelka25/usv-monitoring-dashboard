# USV Monitoring Dashboard

A React, TypeScript, and Vite dashboard for monitoring simulated unmanned surface vessel (USV) telemetry. It presents vessel information, GPS, pose, and battery readings alongside a Leaflet map, with explicit indicators for degraded data and connection loss.

## Installation & Getting Started

1. Install **Node.js 22.x** (compatible with the project's Vite, Vitest, and jsdom dependencies), npm, and Git. Check your installation:

   ```sh
   node --version
   npm --version
   git --version
   ```

2. Clone the repository and enter its directory:

   ```sh
   git clone https://github.com/Vudelka25/usv-monitoring-dashboard.git
   cd usv-monitoring-dashboard
   ```

3. Install the dependencies recorded in the lockfile:

   ```sh
   npm ci
   ```

4. Start the development server:

   ```sh
   npm run dev
   ```

5. Open the local URL printed by Vite in your browser. Keep the terminal running while using the dashboard; press **Ctrl+C** to stop the server.

No backend or API credentials are required. Map tiles require internet access. Validation and production commands are listed under [Testing & Quality Checks](#testing--quality-checks).

## How to Use the Dashboard

### Interactive Anomaly Testing

Use the **Telemetry mode** selector in the top-right corner of the dashboard to manually trigger scenarios and observe changes in status indicators, warnings, and telemetry information. Readings update on the next simulated sample; GPS staleness and disconnection indicators follow the timing described below.

The selector provides four modes:

| Mode | Behavior |
| --- | --- |
| `LIVE STREAM · 1 Hz` | Emits telemetry every second. The automatic demo gradually degrades GPS accuracy, temporarily freezes the GPS fix, recovers, then lowers and restores battery charge. |
| `GPS ADVISORY` | Reports degraded GPS accuracy and freezes the GPS fix while other readings continue updating. |
| `BATTERY CRITICAL` | Reports 9% battery charge while GPS continues updating. |
| `DISCONNECTED` | Stops telemetry emissions; retained readings become stale after more than three seconds without an accepted sample. |

Manual GPS and battery modes override the automatic demonstration; returning to live mode resumes the sequence at its current sample number.

- Vessel identity, dimensions, GPS, pose, and battery summary remain visible.
- Select **VIEW DETAILS** or **GPS & POSE DETAILS** to inspect GPS and pose readings, or **BATTERY DETAILS** for battery readings. Critical battery and offline states take precedence over the selected details view.
- Click the vessel marker to open a popup displaying GPS coordinates, accuracy, and fix age; use its close button to dismiss it.
- Pan the map, scroll to zoom, or use the **+ / −** controls.
- When disconnected, select **RECONNECT STREAM** to resume the local simulation. The dashboard waits for a valid sample before reporting it online.

## Assignment Requirements

Developed for an Interview Challenge UI with an estimated 2–3-hour completion window, the project addresses the four requirements:

1. **Simulate telemetry:** static vessel name and dimensions, GPS coordinates and accuracy, yaw/pitch/roll, and battery charge, voltage, and current.
2. **Subscribe and process:** a telemetry hook manages the stream subscription and passes samples through runtime validation and derived-value processing.
3. **Display and interact:** persistent summaries and a geographic map provide an overview; details panels and the marker popup expose additional information.
4. **Provide unit tests:** service, hook, component, and recovery tests cover the main behaviors.

## Why React + TypeScript Instead of Qt

The assignment explicitly allows choosing a different technology stack, so I selected React and TypeScript based on my existing experience. Given the 2–3-hour time frame, this allowed me to focus on implementation quality and code structure rather than spending time learning Qt.

## Key Features & Human-Centered Operator Design

The overview keeps vessel position, orientation, battery condition, and connection status available together for situational awareness. Status text, semantic icons, and color indicators distinguish normal, advisory, critical, and offline conditions. Expanded details show the readings and thresholds behind alerts.

GPS fix age is tracked separately from stream activity: incoming pose and battery readings do not make an old GPS fix fresh. Stale GPS and disconnected telemetry are identified as last-known information, helping operators distinguish retained data from current observations.

## Real-Time Anomaly Guardian

The dashboard uses explicit rules rather than an advanced anomaly detection algorithm:

- **Connection:** offline after more than three seconds without an accepted sample.
- **GPS accuracy:** advisory when reported accuracy exceeds 10 m.
- **GPS freshness:** stale when the fix is at least three seconds old, even if the stream remains live.
- **Battery:** critical when state of charge falls below 15%.

Overall status prioritizes offline, then critical battery, then GPS accuracy advisory, then normal. GPS freshness is displayed separately. Recommendations support human decisions; the application does not control a vessel.

## Architecture & Separation of Concerns

`USVMonitoring` composes the dashboard and manages scenario selection and the details view. `Header`, `ConnectionStatus`, `VesselInfo`, and `DetailsPanel` handle their respective presentation responsibilities. `VesselMap`, `VesselMarker`, and `MapZoomControls` encapsulate React Leaflet integration and map interactions.

`useTelemetry` owns the stream lifecycle, subscription, accepted sample state, ordering checks, and connection timeout. `useNow` supplies the clock for age labels. Services generate and validate telemetry; shared types define the data contracts, and formatting utilities prepare display strings.

## Project Folder Structure

```text
src/
├── App.tsx                         # Global error boundary and dashboard
├── main.tsx                        # React entry point and StrictMode
├── index.scss                      # Global baseline styles
├── assets/                         # Branding, status icons, map assets
├── test/setup.ts                   # Shared test setup
└── features/usv-monitoring/
    ├── components/                 # Dashboard panels, map, and error UI
    ├── hooks/                      # useTelemetry and useNow
    ├── services/                   # Mock stream and telemetry processor
    ├── styles/                     # _tokens.scss and _mixins.scss
    ├── types/telemetry.types.ts    # Vessel and telemetry contracts
    ├── utils/telemetryFormatting.ts
    └── index.ts                    # Feature exports
```

Tests are colocated with the services, hooks, and components they exercise; the application boundary test sits beside `App.tsx`.

## SCSS Architecture

Component styles use SCSS Modules with BEM-style class names. Shared design tokens are CSS custom properties scoped to the dashboard root through `_tokens.scss`; `_mixins.scss` shares recurring eyebrow and action-button declarations. Global styles provide the font, page baseline, and box sizing, while component modules own layout and responsive rules.

At widths of 1100px and below, the three-column workspace stacks vertically: vessel information, map, then details. At 600px and below, spacing is reduced, the header is simplified, and status descriptions can wrap; the map's minimum height decreases from 300px to 260px. On wider screens with limited height, the vessel and details panels allow vertical scrolling.

## Telemetry Processing & Performance

The processor validates unknown input, required nested records, finite numbers, coordinate and charge ranges, timestamps, and sequence numbers. It normalizes yaw, calculates battery power, and derives advisory flags. Invalid, duplicate, and out-of-order samples are ignored without replacing the last accepted readings.

At the simulated 1 Hz rate, accepted readings and their status changes update directly, without an additional throttle or buffer. Scenario changes take effect on subsequent emissions; connection loss uses its timeout. The implementation avoids extra memoization where the current flow does not demonstrate a need for it.

The map stays mounted across telemetry updates. A stable marker uses `requestAnimationFrame` to interpolate positions over 900 ms and retargets from its displayed position when coordinates change. Pending frames are cancelled on retargeting and unmount; stream subscriptions and timers also have cleanup.

## Error Handling & Recovery

A global Error Boundary in `App` provides a full-page fallback for dashboard failures. A local boundary inside `VesselMap` replaces a failed map with its own fallback, allowing telemetry and the remaining panels to continue working.

Both fallbacks provide **Try again**, which resets the boundary and attempts to remount its contents. Recovery succeeds when the underlying cause has been resolved; otherwise the fallback remains. Error boundaries do not handle asynchronous map tile network failures.

## Testing & Quality Checks

Tests use **Vitest**, **React Testing Library**, and **jsdom**. Coverage includes validation and thresholds, simulated scenarios and timing, subscription cleanup and StrictMode behavior, rejected samples, stale data and reconnection, details interactions, marker interpolation and cleanup, popup and zoom actions, and error boundary recovery. Map boundary tests also exercise real Leaflet and React Leaflet in jsdom.

Run these commands from the project directory:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Rerun tests during development. |
| `npm run lint` | Run ESLint. |
| `npx tsc -b` | Check the application's and Vite configuration's TypeScript projects. |
| `npm run build` | Run TypeScript checks and create the production build in `dist/`. |
| `npm run preview` | Serve an existing production build locally for review. |

## Limitations

- All vessel data and anomalies are simulated; there is no hardware connection, backend, or autonomous control.
- The automatic scenario is an accelerated demonstration driven by sample count, not a physical battery or navigation model.
- OpenStreetMap tiles depend on external network availability.
- There is no telemetry history, persistence, or multi-vessel monitoring.
- jsdom tests cover application behavior but do not replace visual and interaction checks in a browser.
