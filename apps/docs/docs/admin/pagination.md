# Admin Pagination

## Overview

All admin pages use a standardized pagination system for consistent user experience and efficient data loading. The pagination system is implemented using the `PaginationControls` component.

## Standardized Pagination Component

### PaginationControls Component

The `PaginationControls` component provides consistent pagination UI across all admin pages:

```typescript
interface PaginationControlsProps {
  paginationInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPreviousPage: () => void;
  onNextPage: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLoading?: boolean;
  itemLabel?: string; // e.g., "products", "orders", "discounts"
}
```

### Usage Example

```typescript
import { PaginationControls } from "@/components/pagination/pagination-controls";

function DiscountsPage() {
  const { data, isLoading } = useDiscounts({ page, limit });
  
  return (
    <div>
      {/* Discounts list */}
      <DiscountsList discounts={data?.data} />
      
      {/* Pagination */}
      <PaginationControls
        paginationInfo={data?.pagination}
        onPreviousPage={() => setPage(p => p - 1)}
        onNextPage={() => setPage(p => p + 1)}
        canGoPrevious={page > 1}
        canGoNext={page < (data?.pagination.totalPages || 1)}
        isLoading={isLoading}
        itemLabel="discounts"
      />
    </div>
  );
}
```

## Pages with Standardized Pagination

The following admin pages use the standardized `PaginationControls` component:

### 1. Discounts Page

**Location**: `apps/admin/components/discounts/discounts-page-client.tsx`

**Features**:
- Paginated discount list
- Standard pagination controls
- Loading states

### 2. Bundles Page

**Location**: `apps/admin/components/bundles/bundles-page-client.tsx`

**Features**:
- Paginated bundle list
- Standard pagination controls
- Loading states

### 3. Collections Page

**Location**: `apps/admin/components/collections/collections-page-client.tsx`

**Features**:
- Paginated collection list
- Standard pagination controls
- Loading states

### 4. Reviews Page

**Location**: `apps/admin/components/reviews/reviews-page-client.tsx`

**Features**:
- Paginated review list
- Standard pagination controls
- Loading states

## Pagination API Response Format

All paginated API endpoints return data in a consistent format:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Example Response

```json
{
  "data": [
    {
      "id": "discount-1",
      "code": "SAVE20",
      "value": 20
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Pagination Parameters

### Query Parameters

All paginated endpoints accept standard pagination parameters:

- `page`: Page number (default: 1, minimum: 1)
- `limit`: Items per page (default: 20, maximum: 100)

### Example Request

```http
GET /admin/discounts?page=2&limit=20
```

## Pagination State Management

### URL-Based State

Pagination state is typically managed via URL query parameters:

```typescript
// Read from URL
const searchParams = useSearchParams();
const page = parseInt(searchParams.get("page") || "1", 10);
const limit = parseInt(searchParams.get("limit") || "20", 10);

// Update URL
const router = useRouter();
router.push(`/admin/discounts?page=${newPage}&limit=${limit}`);
```

### React Query Integration

Pagination works seamlessly with React Query:

```typescript
function useDiscounts({ page, limit }: PaginationParams) {
  return useQuery({
    queryKey: ["discounts", page, limit],
    queryFn: () => fetchDiscounts({ page, limit }),
  });
}
```

## Pagination Controls UI

### Visual Design

The `PaginationControls` component displays:

- **Page Information**: "Showing X-Y of Z items"
- **Previous Button**: Disabled when on first page
- **Next Button**: Disabled when on last page
- **Loading State**: Shows loading indicator during data fetch

### Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management

## Best Practices

1. **Consistent Limits**: Use standard page sizes (10, 20, 50, 100)
2. **URL State**: Store pagination in URL for bookmarking and sharing
3. **Loading States**: Show loading indicators during pagination
4. **Error Handling**: Handle pagination errors gracefully
5. **Performance**: Use React Query caching for efficient data loading

## Migration Guide

### Before (Custom Pagination)

```typescript
// Custom pagination implementation
<div className="pagination">
  <button onClick={handlePrevious}>Previous</button>
  <span>Page {page}</span>
  <button onClick={handleNext}>Next</button>
</div>
```

### After (Standardized Pagination)

```typescript
// Using PaginationControls component
<PaginationControls
  paginationInfo={pagination}
  onPreviousPage={handlePrevious}
  onNextPage={handleNext}
  canGoPrevious={page > 1}
  canGoNext={page < totalPages}
  isLoading={isLoading}
  itemLabel="discounts"
/>
```

## Future Enhancements

1. **Page Size Selector**: Allow users to change items per page
2. **Jump to Page**: Direct navigation to specific page
3. **Pagination Presets**: Remember user's preferred page size
4. **Infinite Scroll**: Optional infinite scroll mode
5. **Virtual Scrolling**: For very large datasets

