# AutoBlog AI — Frontend

Web dashboard for **AutoBlog AI**, an automated blog generation platform with role-based access control. Built with **Next.js 15**, **React 19**, and **Tailwind CSS**.

---

## Tech Stack

| Layer        | Technology                     |
| ------------ | ------------------------------ |
| Framework    | Next.js 15 (App Router)        |
| UI Library   | React 19                       |
| Styling      | Tailwind CSS 3 + Typography    |
| Language     | TypeScript 5                   |
| HTTP Client  | Axios                          |
| Export       | xlsx (Excel export)            |
| Deployment   | Vercel                         |

---

## Project Structure

```
Frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   ├── globals.css         # Global styles
│   │   ├── login/              # Login page
│   │   ├── register/           # Registration page
│   │   ├── change-password/    # Password change
│   │   └── dashboard/
│   │       ├── layout.tsx      # Dashboard shell (sidebar)
│   │       ├── page.tsx        # Dashboard home
│   │       ├── admin/          # Admin panel (user management)
│   │       ├── change-password/# In-dashboard password change
│   │       ├── published/      # Published blogs
│   │       ├── review/         # Blogs pending review
│   │       └── topics/         # Topic management
│   ├── components/
│   │   ├── AdminGuard.tsx      # Admin-only route wrapper
│   │   ├── BlogEditor.tsx      # Rich blog editor
│   │   ├── ProtectedRoute.tsx  # Auth-protected route wrapper
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   └── Skeleton.tsx        # Loading skeleton
│   ├── context/
│   │   ├── AuthContext.tsx     # Authentication state
│   │   ├── ConfirmContext.tsx  # Confirmation dialog
│   │   └── ToastContext.tsx    # Toast notifications
│   ├── lib/
│   │   ├── api.ts             # Axios instance & interceptors
│   │   ├── constants.tsx      # App constants
│   │   └── curlParser.ts      # cURL command parser
│   └── types/
│       └── index.ts           # Shared TypeScript types
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── vercel.json
└── package.json
```

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 9

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` file in the `Frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Start development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Available Scripts

| Script          | Description                               |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Start Next.js dev server with hot-reload  |
| `npm run build` | Create optimised production build         |
| `npm start`     | Serve the production build                |
| `npm run lint`  | Lint with ESLint (Next.js config)         |

---

## Key Features

- **Authentication** — Login, register, JWT-based session management
- **Role-Based Access** — Admin & regular user roles with guarded routes
- **Blog Management** — Review, edit, and publish AI-generated blogs
- **Topic Management** — Create and manage topics for blog generation
- **Admin Panel** — User management (admin-only)
- **Dashboard** — Overview stats and analytics
- **Responsive UI** — Tailwind CSS with mobile-friendly layout

---

## Deployment

Configured for **Vercel** deployment via [vercel.json](vercel.json).

```bash
npx vercel --prod
```

---

## License

Private — All rights reserved.
