# Admin Panel

E-commerce admin panel built with modern React stack.

## Tech Stack

- **Next.js 16** - App Router
- **React Query** (`@tanstack/react-query`) - Server state management
- **shadcn/ui** - UI component library
- **Tailwind CSS v4** - Styling
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **fetch** - Native fetch API (no Axios)

## Getting Started

First, install dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
apps/admin/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles with shadcn/ui variables
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── providers.tsx      # React Query provider
│   └── example-form.tsx   # Example form component
├── hooks/
│   ├── use-api-query.ts   # Custom hook for GET requests
│   └── use-api-mutation.ts # Custom hook for mutations
├── lib/
│   ├── api.ts             # Fetch-based API client
│   ├── react-query.ts     # React Query configuration
│   └── utils.ts           # Utility functions (cn helper)
└── components.json        # shadcn/ui configuration
```

## Usage Examples

### API Queries

```tsx
import { useApiQuery } from "@/hooks/use-api-query";

function UsersList() {
  const { data, isLoading, error } = useApiQuery<User[]>("/api/users");
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{/* render users */}</div>;
}
```

### API Mutations

```tsx
import { useApiMutation } from "@/hooks/use-api-mutation";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

function CreateUser() {
  const queryClient = useQueryClient();
  
  const mutation = useApiMutation({
    mutationFn: (data: CreateUserDto) => api.post("/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
  
  return <button onClick={() => mutation.mutate({ name: "John" })}>Create</button>;
}
```

### Forms with React Hook Form + Zod

See `components/example-form.tsx` for a complete example of:
- Form validation with Zod
- React Hook Form integration
- shadcn/ui form components
- React Query mutations

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3002
```

- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_STOREFRONT_URL` - Storefront URL for CMS preview functionality

## Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add [component-name]
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [React Hook Form Documentation](https://react-hook-form.com)
- [Zod Documentation](https://zod.dev)
