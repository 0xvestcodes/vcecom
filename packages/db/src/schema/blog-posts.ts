import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { users } from "./users";

/**
 * Blog Posts table - stores blog posts separately from content registry
 * Blog posts are a collection (multiple entries) vs content registry which are singletons
 */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    featuredImage: text("featured_image"),
    content: text("content").notNull(), // Markdown content
    published: boolean("published").default(false).notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    seo: jsonb("seo").$type<{
      title?: string;
      description?: string;
      og_image?: string;
    }>(),
  },
  (table) => ({
    storeSlugUnique: unique("blog_posts_store_slug_unique").on(
      table.storeId,
      table.slug,
    ),
    storeIdIdx: index("blog_posts_store_id_idx").on(table.storeId),
    slugIdx: index("blog_posts_slug_idx").on(table.slug),
    publishedIdx: index("blog_posts_published_idx").on(table.published),
    publishedAtIdx: index("blog_posts_published_at_idx").on(table.publishedAt),
    createdAtIdx: index("blog_posts_created_at_idx").on(table.createdAt),
  }),
);

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  store: one(stores, {
    fields: [blogPosts.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [blogPosts.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [blogPosts.updatedBy],
    references: [users.id],
  }),
}));

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
