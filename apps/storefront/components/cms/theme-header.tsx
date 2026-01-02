"use client";

import { LogOut, ShoppingCart, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Navigation } from "@/content-schema";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import type { StoreConfig } from "@/lib/validations/store-config";

interface ThemeHeaderProps {
  navigation?: Navigation;
  storeConfig?: StoreConfig;
}

/**
 * Header component
 * Uses content registry for navigation
 */
export function ThemeHeader({ navigation, storeConfig }: ThemeHeaderProps) {
  const { data: user } = useAuth();
  const logout = useLogout();
  const { data: cart } = useCart();

  const cartItemCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Logo from store config or placeholder
  const logoContent = storeConfig?.logoUrl ? (
    <Image
      src={storeConfig.logoUrl}
      alt={storeConfig.name || "Logo"}
      width={120}
      height={40}
      className="h-10 w-auto"
      priority
    />
  ) : (
    <Link href="/" className="text-xl font-bold">
      {storeConfig?.name || "Store"}
    </Link>
  );

  // Header content (logo, nav, cart, auth)
  const headerContent = (
    <>
      {/* Logo */}
      {logoContent}

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {navigation?.items && navigation.items.length > 0 ? (
          <ul className="flex items-center gap-6">
            {navigation.items.map((item, index) => (
              <li key={`nav-item-${index}`}>
                <Link
                  href={item.href}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
                {item.children && item.children.length > 0 && (
                  <ul className="absolute mt-2 hidden group-hover:block">
                    {item.children.map((child, childIndex) => (
                      <li key={`nav-child-${index}-${childIndex}`}>
                        <Link
                          href={child.href}
                          className="block px-4 py-2 text-sm hover:bg-muted"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">
            Navigation not configured
          </span>
        )}
      </nav>

      {/* Right Side Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
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
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {headerContent}
        </div>
      </div>
    </header>
  );
}
