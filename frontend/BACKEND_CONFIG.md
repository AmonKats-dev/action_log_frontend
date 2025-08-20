# Backend Connection Configuration

This guide explains how to configure the frontend to connect to different backend environments.

## Environment Variables

The frontend uses environment variables to determine which backend to connect to:

- `VITE_API_URL`: The base URL for the backend API

## Configuration Files

### 1. Local Development (`env.local`)
```
VITE_API_URL=http://localhost:8000/api
```

### 2. Production - PythonAnywhere (`env.production`)
```
VITE_API_URL=https://yourusername.pythonanywhere.com/api
```

## Setup Instructions

### For Local Development:
1. Copy `env.local` to `.env.local`
2. The frontend will automatically connect to `http://localhost:8000/api`

### For PythonAnywhere Production:
1. Copy `env.production` to `.env.production`
2. Replace `yourusername` with your actual PythonAnywhere username
3. Build the project with: `npm run build`
4. The production build will use the PythonAnywhere URL

### For Custom Domain:
If you have a custom domain pointing to PythonAnywhere:
```
VITE_API_URL=https://yourdomain.com/api
```

## Building for Production

When building for production, Vite will automatically use the `.env.production` file:

```bash
npm run build
```

## Verification

To verify the configuration:
1. Check the browser's Network tab to see API requests
2. Ensure requests are going to the correct backend URL
3. Check the browser console for any CORS or connection errors

## Troubleshooting

### CORS Issues
If you encounter CORS errors, ensure your PythonAnywhere backend has the correct CORS configuration:

```python
# In your Django settings
CORS_ALLOWED_ORIGINS = [
    "https://yourusername.pythonanywhere.com",
    "https://yourdomain.com",
    "http://localhost:5173",  # For local development
]
```

### SSL/HTTPS Issues
PythonAnywhere provides HTTPS by default. Ensure your frontend is also served over HTTPS in production.
