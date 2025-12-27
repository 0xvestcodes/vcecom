# Netlify Deployment Setup for Admin App

This guide covers deploying the admin app to Netlify with proper environment variable configuration.

## Prerequisites

- Netlify account
- Backend API deployed and accessible
- Domain configured (optional)

## Quick Setup

### 1. Connect Repository to Netlify

**Via Netlify Dashboard:**
1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git repository
4. Configure build settings:
   - **Base directory**: Leave empty (root of repo)
   - **Build command**: `pnpm --filter @vestcodes/vcecom-admin build`
   - **Publish directory**: `apps/admin/.next`
   - **Node version**: `20.x`

**Via Netlify CLI:**
```bash
cd apps/admin
netlify init
# Follow prompts to link/create project
```

### 2. Configure Environment Variables

**Via Netlify Dashboard:**
1. Go to Site Settings → Environment Variables
2. Add the following variables:

**Required:**
- `NEXT_PUBLIC_API_URL` = `https://hw.vcecom.vestcodes.co`

**Optional:**
- `API_URL` = `https://hw.vcecom.vestcodes.co` (falls back to NEXT_PUBLIC_API_URL)
- `NODE_ENV` = `production`

**Via Netlify CLI:**
```bash
cd apps/admin
netlify env:set NEXT_PUBLIC_API_URL "https://hw.vcecom.vestcodes.co"
netlify env:set NEXT_PUBLIC_API_URL "https://hw.vcecom.vestcodes.co" --context production
netlify env:set NEXT_PUBLIC_API_URL "https://hw.vcecom.vestcodes.co" --context deploy-preview
```

### 3. Deploy

**Via Netlify Dashboard:**
- Push to your repository - Netlify will auto-deploy

**Via Netlify CLI:**
```bash
cd apps/admin
# Deploy to production
netlify deploy --prod

# Or deploy a preview
netlify deploy
```

## Configuration Files

### `netlify.toml`

The `netlify.toml` file is already configured with:
- Build command for monorepo
- Publish directory
- Security headers
- Next.js plugin

### Environment Variable Validation

The app validates environment variables at runtime (not during build) to allow builds to proceed. The validation will fail at runtime if `NEXT_PUBLIC_API_URL` is not set.

## Environment-Specific Configuration

### Production
```bash
netlify env:set NEXT_PUBLIC_API_URL "https://hw.vcecom.vestcodes.co" --context production
```

### Deploy Previews
```bash
netlify env:set NEXT_PUBLIC_API_URL "https://hw.vcecom.vestcodes.co" --context deploy-preview
```

### Branch Deploys
```bash
netlify env:set NEXT_PUBLIC_API_URL "https://hw.vcecom.vestcodes.co" --context branch-deploy
```

## Troubleshooting

### Build Fails with "Missing required environment variable"

**Solution**: The build should now proceed without env vars. If you see this error at runtime:
1. Add `NEXT_PUBLIC_API_URL` in Netlify site settings
2. Redeploy the site

### API Calls Fail

- Verify `NEXT_PUBLIC_API_URL` points to the correct backend
- Check backend CORS configuration allows your Netlify domain
- Ensure backend is accessible from the internet

### Build Command Not Found

- Ensure `pnpm` is available in Netlify build environment
- Check that base directory is set correctly
- Verify build command matches monorepo structure

## Custom Domain

To add a custom domain:

1. Go to Site Settings → Domain management
2. Add your domain (e.g., `admin.vcecom.vestcodes.co`)
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_API_URL` if needed

## Monitoring

- Check Netlify deploy logs for build errors
- Monitor function logs for runtime errors
- Use Netlify Analytics for performance monitoring

## Additional Resources

- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Netlify Next.js Plugin](https://docs.netlify.com/integrations/frameworks/next-js/)
- [Netlify CLI Documentation](https://cli.netlify.com/)

