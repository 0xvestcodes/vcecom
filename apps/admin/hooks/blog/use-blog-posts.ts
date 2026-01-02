import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useBlogPosts(options?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "newest" | "oldest" | "alphabetical";
  storeId?: string;
}) {
  return useQuery({
    queryKey: ["blog-posts", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.page) params.set("page", String(options.page));
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.search) params.set("search", options.search);
      if (options?.sortBy) params.set("sortBy", options.sortBy);
      if (options?.storeId) params.set("storeId", options.storeId);

      const response = await fetch(
        `${API_BASE_URL}/admin/blog?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch blog posts");
      }

      return response.json();
    },
  });
}

export function useBlogPost(id: string) {
  return useQuery({
    queryKey: ["blog-post", id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/admin/blog/${id}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch blog post");
      }

      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateBlogPost(storeId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      slug: string;
      title: string;
      excerpt?: string;
      featuredImage?: string;
      content: string;
      seo?: { title?: string; description?: string; og_image?: string };
    }) => {
      const storeIdParam = storeId || process.env.NEXT_PUBLIC_STORE_ID || "";
      const response = await fetch(
        `${API_BASE_URL}/admin/blog?storeId=${storeIdParam}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create blog post");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    },
  });
}

export function useUpdateBlogPost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      slug?: string;
      title?: string;
      excerpt?: string;
      featuredImage?: string;
      content?: string;
      seo?: { title?: string; description?: string; og_image?: string };
    }) => {
      const response = await fetch(`${API_BASE_URL}/admin/blog/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update blog post");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-post", id] });
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    },
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/blog/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete blog post");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    },
  });
}

export function usePublishBlogPost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (published: boolean) => {
      const response = await fetch(
        `${API_BASE_URL}/admin/blog/${id}/publish?published=${published}`,
        {
          method: "PUT",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to publish/unpublish blog post");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-post", id] });
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    },
  });
}
