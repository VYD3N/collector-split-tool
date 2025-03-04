# Collector Split Tool Deployment Guide

## Overview
This guide covers deploying the Collector Split Tool, a React application that helps calculate and manage NFT collector royalty splits.

## Prerequisites
- Node.js 16+ installed
- npm or yarn package manager
- A web server (e.g., Nginx, Apache) for hosting the static files

## Build Process

1. **Install Dependencies**
```bash
npm install
cd frontend && npm install
```

2. **Create Production Build**
```bash
npm run build
```
This will create a production build in the `frontend/build` directory.

## Deployment Options

### 1. Static Hosting (Recommended)

The application is a static React site that can be hosted on any static hosting service:

#### Using Netlify
1. Connect your repository to Netlify
2. Set build command: `cd frontend && npm run build`
3. Set publish directory: `frontend/build`
4. Configure environment variables:
   ```
   REACT_APP_TZKT_API_URL=https://api.tzkt.io
   ```

#### Using Vercel
1. Import your repository to Vercel
2. Set root directory: `frontend`
3. Set build command: `npm run build`
4. Configure environment variables in Vercel dashboard

#### Manual Deployment (Nginx)
1. Build the application
2. Copy the contents of `frontend/build` to your web server
3. Configure Nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Environment Variables

Configure these variables in your hosting platform:

```env
REACT_APP_TZKT_API_URL=https://api.tzkt.io
```

## Security Considerations

1. **API Rate Limiting**
   - TzKT API has rate limits, ensure your application respects them
   - Consider implementing client-side caching

2. **CORS**
   - No special CORS configuration needed as we're only calling the public TzKT API

## Monitoring

1. **Basic Monitoring**
   - Use hosting platform's built-in monitoring
   - Monitor for 404 errors or failed API calls

2. **Performance**
   - Monitor page load times
   - Track API response times

## Troubleshooting

Common issues and solutions:

1. **Build Failures**
   - Verify Node.js version compatibility
   - Check for missing dependencies
   - Verify environment variables are set

2. **Runtime Issues**
   - Check browser console for errors
   - Verify TzKT API connectivity
   - Check for JavaScript errors in the console

Need help? Open an issue in the repository! 