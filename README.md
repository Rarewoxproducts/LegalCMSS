# Legal Case Management System

A professional case management system built for law firms with role-based access control, real-time updates, and secure authentication.

## Features

- **Authentication**: Email/password login using Supabase Auth
- **Role-Based Access Control**: Three user roles (Admin, Lawyer, Viewer)
- **Case Management**: Create, view, update, and track legal cases
- **User Management**: Admin can create users and assign roles
- **Case Assignments**: Assign cases to specific users
- **Case Notes**: Add and track case notes and updates
- **Dashboard**: Overview of case statistics and recent activity
- **Responsive Design**: Professional law firm aesthetic that works on all devices

## Technology Stack

- **Frontend**: Next.js 13 (App Router) + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Security**: Row Level Security (RLS) policies
- **UI Components**: shadcn/ui
- **State Management**: React hooks only

## User Roles

### Admin
- Create and manage users
- Assign user roles
- Create and manage all cases
- Assign cases to users
- Update case status
- Add case notes

### Lawyer
- View assigned cases
- Update case status
- Add case notes

### Viewer
- View assigned cases (read-only)

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Environment variables are already configured in `.env`

3. The database schema has been applied to your Supabase project with the following tables:
   - `profiles` - User profiles with roles
   - `cases` - Legal case information
   - `case_assignments` - Case to user assignments

4. Create your first admin user:
   - Go to your Supabase project dashboard
   - Navigate to Authentication > Users
   - Create a new user with an email and password
   - Then go to Table Editor > profiles
   - Insert a new row with:
     - `id`: (copy the user's ID from auth.users)
     - `full_name`: Your name
     - `role`: admin
     - `created_at`: (will auto-fill)

5. Start the development server:
```bash
npm run dev
```

6. Open your browser and go to `http://localhost:3000`

7. Log in with the admin credentials you created

### Building for Production

```bash
npm run build
npm start
```

## Database Schema

### profiles
- `id` (uuid, references auth.users)
- `full_name` (text)
- `role` (text: admin, lawyer, viewer)
- `created_at` (timestamp)

### cases
- `id` (uuid)
- `case_number` (text, unique)
- `title` (text)
- `client_name` (text)
- `case_type` (text)
- `description` (text)
- `status` (text: open, in_progress, closed)
- `notes` (jsonb)
- `created_by` (uuid)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### case_assignments
- `id` (uuid)
- `case_id` (uuid)
- `user_id` (uuid)
- `assigned_at` (timestamp)

## Security

- All tables have Row Level Security (RLS) enabled
- Users can only access data they're authorized to see
- Admins have full access to all data
- Lawyers and Viewers can only access their assigned cases
- Passwords are securely hashed by Supabase Auth
- No sensitive data is exposed to the client

## Usage Guide

### Creating a Case (Admin Only)

1. Navigate to the Cases page
2. Click "Create Case"
3. Fill in the case details
4. Assign users to the case
5. Click "Create Case"

### Updating Case Status (Admin & Lawyer)

1. Open a case detail page
2. Use the status dropdown on the right sidebar
3. Select the new status

### Adding Case Notes (Admin & Lawyer)

1. Open a case detail page
2. Scroll to the "Case Notes" section
3. Type your note in the text area
4. Click "Add Note"

### Managing Users (Admin Only)

1. Navigate to the Users page
2. Click "Create User"
3. Fill in user details and assign a role
4. You can also change existing user roles from this page

## Project Structure

```
project/
├── app/
│   ├── dashboard/
│   │   ├── cases/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx      # Case detail page
│   │   │   └── page.tsx          # Cases list page
│   │   ├── users/
│   │   │   └── page.tsx          # User management page
│   │   ├── layout.tsx            # Dashboard layout with sidebar
│   │   └── page.tsx              # Dashboard home page
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (redirects)
├── components/
│   └── ui/                       # shadcn/ui components
├── contexts/
│   └── auth-context.tsx          # Authentication context
├── lib/
│   ├── supabase.ts               # Supabase client config
│   └── utils.ts                  # Utility functions
└── .env                          # Environment variables
```

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
