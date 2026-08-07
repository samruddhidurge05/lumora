# Troubleshooting Guide

If co-workers still see errors on their end, please ask them to perform the following steps:

### 1. Pull Latest Remote Commits
```bash
git pull origin main
```
*(Subsequent commits from Avikapawar were also pushed on top of `464ad28`, so pulling will fetch all latest backend/frontend updates).*

### 2. Reload Language Server / IDE Window
In **VSCode**:
- Press `Ctrl + Shift + P`
- Select **Developer: Reload Window** (or **Pyright: Restart Language Server**).
*This forces Pyright/Pylance to clear stale type diagnostics.*

### 3. Restart Dev Servers
Restart the local frontend and backend servers to reload module imports:
- **Frontend**: `npm run dev`
- **Backend**: `uvicorn` (with your standard arguments)
