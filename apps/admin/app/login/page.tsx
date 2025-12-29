"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { setAuthToken } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  deviceId: z.string().min(1, "Device ID is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  // Check if redirected due to expired token
  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setError("Your session has expired. Please log in again.");
    }
  }, [searchParams]);

  // Generate device ID once on mount
  const [deviceId] = useState(() => {
    if (typeof window === "undefined") return "";
    // Try to get existing device ID from localStorage, or generate new one
    const stored = localStorage.getItem("admin_device_id");
    if (stored) return stored;
    const newDeviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("admin_device_id", newDeviceId);
    return newDeviceId;
  });

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      deviceId: deviceId,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      // Call backend directly - backend sets httpOnly cookies
      // apiFetch includes credentials: "include" to handle cookies properly
      return api.post<{
        accessToken: string;
        refreshToken: string;
        id: string;
        email: string;
        role: string;
        requires2fa: boolean;
      }>(endpoints.auth.login, data);
    },
    onSuccess: (data) => {
      if (data.requires2fa) {
        // Handle 2FA flow (to be implemented)
        setError(
          "2FA verification required. This feature is not yet implemented.",
        );
        return;
      }

      // Store tokens (cookies are set by backend)
      if (data.accessToken) {
        setAuthToken(data.accessToken);
      }

      // Redirect to dashboard or original destination
      // Use window.location.href instead of router.push to ensure cookies are set
      // This ensures a full page navigation which properly handles cookie setting
      const redirectTo = searchParams.get("redirect") || "/";
      // Small delay to ensure cookies are set before redirect
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 100);
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(error.message || "An error occurred during login");
      }
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setError(null);
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <Shield className="h-8 w-8 text-foreground/80" />
            </div>
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Welcome To Admin Panel
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Sign in to access the account area
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Email"
                        className="bg-muted/30 border-border/50 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Password"
                        className="bg-muted/30 border-border/50 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {error && (
                <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full text-sm"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Logging in..." : "Continue with Email"}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                Forgot password? -{" "}
                <Link
                  href="/reset"
                  className="text-primary hover:underline transition-colors"
                >
                  Reset
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
