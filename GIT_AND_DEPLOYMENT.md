# Setup and Deployment for Cute Todo Backend

The backend has been moved to a separate directory: `d:\My Source Code\cute_todo_be`.

## Git Setup
1. Initialize Git in `cute_todo_be`:
   ```powershell
   cd "d:\My Source Code\cute_todo_be"
   git init
   git add .
   git commit -m "Initial commit of backend"
   ```

2. Link to GitHub:
   - Create a repo `cute-todo-backend`.
   - Run:
   ```powershell
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

## Vercel Deployment

1. Import `cute-todo-backend` project in Vercel.
2. **Environment Variables** (Settings > Environment Variables):
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: (Your JSON service account)
   - `SMTP_HOST`: `smtp.gmail.com` (or your provider)
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `your-email@gmail.com`
   - `SMTP_PASS`: `your-app-password` (Generate an App Password if using Gmail)
   - `SMTP_FROM`: `"Cute Todo" <your-email@gmail.com>`

## Flutter Integration
1. Open `lib/services/backend_service.dart`.
2. Update `_baseUrl` with your deployed Vercel URL.
   Example: `https://cute-todo-backend.vercel.app/api`
