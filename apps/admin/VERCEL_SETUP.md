# Vercel Deployment Setup for Admin App

This guide covers deploying the admin app to Vercel with proper environment variable validation.

## Prerequisites

- Vercel account
- Backend API deployed and accessible
- Domain configured (optional)

## Quick Setup

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/admin`
   - **Build Command**: `cd ../.. && pnpm --filter @vestcodes/vcecom-admin build`
   - **Output Directory**: `.next`
   - **Install Command**: `cd ../.. && pnpm install`

### 2. Configure Environment Variables

In Vercel project settings, add the following environment variables:

#### Required Variables

- **`NEXT_PUBLIC_API_URL`** (Required)
  - Description: Backend API URL (public, used by client-side code)
  - Example: `https://hw.vcecom.vestcodes.co`
  - Must be a valid HTTP/HTTPS URL
  - This is exposed to the browser, so ensure CORS is configured on the backend

#### Optional Variables

- **`API_URL`** (Optional)
  - Description: Backend API URL for server-side requests
  - Example: `https://hw.vcecom.vestcodes.co`
  - If not set, falls back to `NEXT_PUBLIC_API_URL`
  - Can be different from `NEXT_PUBLIC_API_URL` if you need internal routing

- **`NODE_ENV`** (Optional)
  - Description: Node environment
  - Default: `production`
  - Options: `development`, `production`, `test`

### 3. Environment Variable Validation

The `vercel.json` file includes schema validation for environment variables:

- **Type checking**: Ensures variables are strings
- **Pattern validation**: Validates URL format for API URLs
- **Required fields**: Ensures `NEXT_PUBLIC_API_URL` is set
- **Enum validation**: Validates `NODE_ENV` values

### 4. Deploy

1. Push your changes to the repository
2. Vercel will automatically detect the deployment
3. Check the build logs to ensure environment variables are validated correctly

## Environment-Specific Configuration

### Production

```env
NEXT_PUBLIC_API_URL=https://hw.vcecom.vestcodes.co
NODE_ENV=production
```

### Preview/Staging

```env
NEXT_PUBLIC_API_URL=https://staging-api.vcecom.vestcodes.co
NODE_ENV=production
```

### Development

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```

## Troubleshooting

### Build Fails with "Missing Required Environment Variable"

- Ensure `NEXT_PUBLIC_API_URL` is set in Vercel project settings
- Check that the variable name matches exactly (case-sensitive)
- Verify the variable is added to the correct environment (Production/Preview/Development)

### API Calls Fail

- Verify `NEXT_PUBLIC_API_URL` points to the correct backend URL
- Check backend CORS configuration allows requests from your Vercel domain
- Ensure the backend is accessible from the internet (not localhost)

### Environment Variable Not Available in Browser

- Only variables prefixed with `NEXT_PUBLIC_` are available in the browser
- Server-side variables (without prefix) are only available in API routes and server components
- Restart the development server after adding new environment variables

## Security Headers

The `vercel.json` configuration includes security headers:

- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information

## Custom Domain

To add a custom domain:

1. Go to Project Settings → Domains
2. Add your domain (e.g., `admin.vcecom.vestcodes.co`)
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_API_URL` if needed to match the new domain

## Monitoring

- Check Vercel deployment logs for build errors
- Monitor function logs for runtime errors
- Use Vercel Analytics for performance monitoring

## Additional Resources

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Deployment Documentation](https://vercel.com/docs/concepts/deployments/overview)

