"use client";

import { LogOut, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";

export function Header() {
  const { data: user } = useAuth();
  const logout = useLogout();
  const { data: cart } = useCart();

  const cartItemCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold">
            VCEcom
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/products"
              className="text-sm font-medium hover:text-primary"
            >
              Products
            </Link>
            <Link
              href="/bundles"
              className="text-sm font-medium hover:text-primary"
            >
              Bundles
            </Link>
            <Link
              href="/categories"
              className="text-sm font-medium hover:text-primary"
            >
              Categories
            </Link>
            <Link
              href="/collections"
              className="text-sm font-medium hover:text-primary"
            >
              Collections
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Search - placeholder for now */}
            <div className="hidden md:block">
              <Link href="/search">
                <Button variant="ghost" size="sm">
                  Search
                </Button>
              </Link>
            </div>

            {/* Cart */}
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {cartItemCount > 9 ? "9+" : cartItemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-2">
                <Link href="/account">
                  <Button variant="ghost" size="sm">
                    <User className="h-5 w-5 mr-2" />
                    Account
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
