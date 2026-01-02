"use client";

import Link from "next/link";
import type { Footer } from "@/content-schema";

interface ThemeFooterProps {
  footer?: Footer;
  children?: React.ReactNode;
}

/**
 * Footer component
 * Uses content registry for footer content
 */
export function ThemeFooter({ footer, children }: ThemeFooterProps) {
  if (children) {
    return (
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">{children}</div>
      </footer>
    );
  }

  if (!footer) {
    return (
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <p className="text-sm text-muted-foreground">Footer not configured</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-8">
        {footer.columns && footer.columns.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {footer.columns.map((column, index) => (
              <div key={index}>
                <h3 className="font-semibold mb-4">{column.title}</h3>
                <ul className="space-y-2">
                  {column.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        href={link.url}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {footer.social && (
          <div className="flex items-center gap-4 mb-4">
            {footer.social.facebook && (
              <Link
                href={footer.social.facebook}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Facebook
              </Link>
            )}
            {footer.social.twitter && (
              <Link
                href={footer.social.twitter}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Twitter
              </Link>
            )}
            {footer.social.instagram && (
              <Link
                href={footer.social.instagram}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Instagram
              </Link>
            )}
            {footer.social.linkedin && (
              <Link
                href={footer.social.linkedin}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                LinkedIn
              </Link>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground">{footer.copyright}</div>
      </div>
    </footer>
  );
}
