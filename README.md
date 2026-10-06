# MealMate — Frontend

A personal meal and routine tracking web application built with React + Vite.

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 19 | UI framework |
| Vite 8 | Dev server & build |
| Tailwind CSS v4 | Styling |
| React Router v7 | Client-side routing |
| Axios | HTTP client |
| Recharts | Analytics charts |
| React Hook Form + Zod | Forms & validation |
| Lucide React | Icon system |
| date-fns | Date utilities |
| Context API | Auth & toast state |

## Quick Start

### Prerequisites

- Node.js >= 20
- MealMate backend running (see ../Mealmate-Server/)

### Installation

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env and set:
#   VITE_API_BASE_URL=http://localhost:5000/api
#   VITE_VAPID_PUBLIC_KEY=<your VAPID public key>  # optional
```

### Development

```bash
npm run dev
# Opens at http://localhost:5173
```

### Production Build

```bash
npm run build
# Output in dist/
```

## Project Structure

```
src/
  context/
    AuthContext.jsx       # JWT auth state, login/logout/register
    ToastContext.jsx      # Global toast notification system
  layouts/
    AppLayout.jsx         # Sidebar + mobile header layout
  pages/
    auth/
      LoginPage.jsx
      RegisterPage.jsx
    Dashboard.jsx         # Today's overview (meals, doses, food)
    MealSchedule.jsx      # Meal schedule + occurrence management
    FoodTracker.jsx       # Spreadsheet-style food tracking
    DoseTracker.jsx       # Dose schedule + occurrence management
    Analytics.jsx         # Charts and trends
    Settings.jsx          # Profile, notifications, account
    NotFound.jsx          # 404 page
  routes/
    ProtectedRoute.jsx    # ProtectedRoute and GuestRoute guards
  services/
    api.js                # Axios client (JWT injection, 401 handling)
    authService.js        # Auth endpoints
    userService.js        # User profile and preferences
    mealService.js        # Meals and meal occurrences
    foodService.js        # Foods and food tracking
    doseService.js        # Doses and dose occurrences
    analyticsService.js   # Analytics endpoints
    notificationService.js # Notifications and push subscription
  App.jsx                 # Router + providers
  main.jsx                # Entry point + SW registration
  index.css               # Design system (CSS custom properties)
public/
  sw.js                   # Service worker (web push)
```

## Backend Connection

The frontend connects to the MealMate backend at VITE_API_BASE_URL (default: http://localhost:5000/api).

All authenticated requests use a Bearer JWT token stored in localStorage under the key mealmate_token.

Token verification happens on every page load via GET /api/auth/me. If expired, the user is redirected to /login?session=expired.

## Web Push Notifications (Optional)

1. Generate VAPID keys: npx web-push generate-vapid-keys
2. Add keys to server .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
3. Add public key to client .env: VITE_VAPID_PUBLIC_KEY=...
4. The service worker (public/sw.js) is registered automatically at startup.

Without a VAPID key the app remains fully functional — only push is unavailable.

## Known Gaps

- Password change: no backend endpoint exists
- Forgot/reset password: no backend endpoint exists
- Food analytics response shape: handled defensively based on actual service response
- Push notifications: requires VAPID configuration and HTTPS or localhost

## Running Together

```bash
# Terminal 1 (Mealmate-Server/)
npm run dev

# Terminal 2 (Mealmate-Client/)
npm run dev
```

Then open http://localhost:5173
