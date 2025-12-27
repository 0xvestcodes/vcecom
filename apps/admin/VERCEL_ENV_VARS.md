# Vercel Environment Variables

## Required Environment Variables

### `NEXT_PUBLIC_API_URL` (Required)

**Description**: Backend API URL used by client-side code. This must be publicly accessible and properly configured for CORS.

**Format**: Must be a valid HTTP/HTTPS URL

**Examples**:
- Production: `https://hw.vcecom.vestcodes.co`
- Staging: `https://staging-api.vcecom.vestcodes.co`
- Development: `http://localhost:3001`

**Validation**:
- ✅ Must start with `http://` or `https://`
- ✅ Must include a valid hostname
- ❌ Cannot be empty or undefined
- ❌ Cannot be a relative URL

**How to Set in Vercel**:
1. Go to Project Settings → Environment Variables
2. Add new variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your backend API URL (e.g., `https://hw.vcecom.vestcodes.co`)
   - **Environment**: Select Production, Preview, and/or Development as needed
3. Click "Save"

## Optional Environment Variables

### `API_URL` (Optional)

**Description**: Backend API URL for server-side requests. If not set, falls back to `NEXT_PUBLIC_API_URL`.

**When to Use**: Use this if you need a different URL for server-side API calls (e.g., internal routing, different authentication).

**Format**: Must be a valid HTTP/HTTPS URL

**Example**: `https://internal-api.vcecom.vestcodes.co`

### `NODE_ENV` (Optional)

**Description**: Node.js environment. Defaults to `production` in Vercel deployments.

**Valid Values**: `development`, `production`, `test`

**Default**: `production`

**Note**: Vercel automatically sets this to `production` for production deployments and `development` for preview deployments.

## Environment Variable Validation

The app includes runtime validation that:

1. **Checks for required variables** at startup
2. **Validates URL format** to ensure proper configuration
3. **Provides clear error messages** if variables are missing or invalid

### Validation Errors

If you see errors like:

```
Missing required environment variable: NEXT_PUBLIC_API_URL
```

**Solution**: Add the variable in Vercel project settings.

If you see errors like:

```
Invalid NEXT_PUBLIC_API_URL format: "invalid-url"
```

**Solution**: Ensure the URL starts with `http://` or `https://` and includes a valid hostname.

## Setting Variables for Different Environments

### Production

```env
NEXT_PUBLIC_API_URL=https://hw.vcecom.vestcodes.co
```

### Preview/Staging

```env
NEXT_PUBLIC_API_URL=https://staging-api.vcecom.vestcodes.co
```

### Development

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing Environment Variables

After setting environment variables in Vercel:

1. **Redeploy** your application (variables are only available after redeployment)
2. **Check build logs** for validation errors
3. **Test the application** to ensure API calls work correctly

## Security Notes

- `NEXT_PUBLIC_*` variables are **exposed to the browser** - never include secrets
- Use server-side only variables (without `NEXT_PUBLIC_` prefix) for sensitive data
- Ensure your backend API has proper CORS configuration for your Vercel domain

## Troubleshooting

### Variable Not Available After Setting

- Variables are only available after redeployment
- Ensure the variable is set for the correct environment (Production/Preview/Development)
- Check that the variable name matches exactly (case-sensitive)

### API Calls Fail

- Verify `NEXT_PUBLIC_API_URL` points to the correct backend
- Check backend CORS configuration allows your Vercel domain
- Ensure backend is accessible from the internet (not localhost)

### Build Fails with Validation Error

- Check build logs for specific validation error
- Ensure required variables are set in Vercel
- Verify URL format matches requirements

