"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./search-bar";

interface Category {
  id: string;
  name: string;
  slug?: string;
}

interface MobileMenuProps {
  categories: Category[];
  isAuthenticated: boolean;
}

export function MobileMenu({ categories, isAuthenticated }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              }
            }}
            aria-label="Close menu"
          />
          <div className="fixed top-14 left-0 right-0 bg-background border-b z-50 md:hidden max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="container py-4 space-y-4">
              <div className="md:hidden">
                <SearchBar />
              </div>
              <nav className="space-y-2">
                <Link
                  href="/products"
                  className="block px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
                  onClick={() => setIsOpen(false)}
                >
                  All Products
                </Link>
                {categories.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-4 py-2 text-sm font-semibold text-muted-foreground">
                      Categories
                    </div>
                    {categories.slice(0, 10).map((category) => (
                      <Link
                        key={category.id}
                        href={`/categories/${category.slug || category.id}`}
                        className="block px-8 py-2 text-sm hover:bg-accent rounded-md"
                        onClick={() => setIsOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  {isAuthenticated ? (
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      My Account
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      className="block px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      Login
                    </Link>
                  )}
                </div>
              </nav>
            </div>
          </div>
        </>
      )}
    </>
  );
}
