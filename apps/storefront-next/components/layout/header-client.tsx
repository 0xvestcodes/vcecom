"use client";

import { ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencySelector } from "./currency-selector";
import { MobileMenu } from "./mobile-menu";
import { SearchBar } from "./search-bar";

interface HeaderClientProps {
  categories: Array<{
    id: string;
    name: string;
    slug?: string;
  }>;
  isAuthenticated: boolean;
}

export function HeaderClient({
  categories,
  isAuthenticated,
}: HeaderClientProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container">
        {/* Top bar */}
        <div className="flex h-14 items-center justify-between border-b">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold text-xl">Store</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/products"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                All Products
              </Link>
              {categories.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-1">
                    Categories
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {categories.slice(0, 8).map((category) => (
                      <DropdownMenuItem key={category.id} asChild>
                        <Link
                          href={`/categories/${category.slug || category.id}`}
                        >
                          {category.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <SearchBar />
            </div>
            <CurrencySelector />
            <Button variant="ghost" size="icon" asChild>
              <Link href="/cart">
                <ShoppingCart className="h-5 w-5" />
                <span className="sr-only">Cart</span>
              </Link>
            </Button>
            {isAuthenticated ? (
              <Button variant="ghost" size="icon" asChild>
                <Link href="/account">
                  <User className="h-5 w-5" />
                  <span className="sr-only">Account</span>
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
            )}
            <MobileMenu
              categories={categories}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>
        {/* Category bar */}
        <div className="hidden md:flex h-12 items-center gap-6 overflow-x-auto">
          {categories.slice(0, 6).map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug || category.id}`}
              className="text-sm font-medium whitespace-nowrap transition-colors hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
