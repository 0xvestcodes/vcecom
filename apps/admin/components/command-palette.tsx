"use client";

import {
  Boxes,
  DollarSign,
  Package,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAdminBundles } from "@/hooks/bundles/use-admin-bundles";
import { useAdminCustomers } from "@/hooks/customers/use-admin-customers";
import { useAdminDiscounts } from "@/hooks/discounts/use-admin-discounts";
import { useVariantsIndex } from "@/hooks/inventory/use-variants-index";
import { useAdminOrders } from "@/hooks/orders/use-admin-orders";
import { useAdminPriceLists } from "@/hooks/pricing/use-admin-price-lists";
import { useAdminProducts } from "@/hooks/products/use-admin-products";
import { useCommandK } from "@/hooks/use-command-k";
import { getAllNavItems } from "@/lib/navigation";

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, closeCommandPalette } = useCommandK();
  const [search, setSearch] = useState("");
  const navItems = getAllNavItems();
  const trimmedSearch = search.trim();
  const hasSearch = trimmedSearch.length > 0;

  // Search products
  const shouldSearchProducts = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("product") ||
        trimmedSearch.toLowerCase().includes("prod") ||
        trimmedSearch.length >= 2)
    );
  }, [hasSearch, trimmedSearch]);

  const { data: productsData } = useAdminProducts(
    shouldSearchProducts
      ? {
          search: trimmedSearch,
          limit: 5,
        }
      : undefined,
  );

  // Search orders if search term looks like an order number or contains "order"
  const shouldSearchOrders = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("order") ||
        /^[A-Z0-9-]+$/i.test(trimmedSearch))
    );
  }, [hasSearch, trimmedSearch]);

  const { data: ordersData } = useAdminOrders(
    shouldSearchOrders
      ? {
          search: trimmedSearch,
          limit: 5,
        }
      : undefined,
  );

  // Search customers
  const shouldSearchCustomers = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("customer") ||
        trimmedSearch.toLowerCase().includes("user") ||
        trimmedSearch.includes("@") ||
        /^\+?[0-9-]+$/.test(trimmedSearch) ||
        trimmedSearch.length >= 2)
    );
  }, [hasSearch, trimmedSearch]);

  const { data: customersData } = useAdminCustomers(
    shouldSearchCustomers
      ? {
          search: trimmedSearch,
          limit: 5,
        }
      : undefined,
  );

  // Search inventory variants if query looks like SKU
  const shouldSearchInventory = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("inventory") ||
        trimmedSearch.toLowerCase().includes("sku") ||
        /^[A-Z0-9-]+$/i.test(trimmedSearch))
    );
  }, [hasSearch, trimmedSearch]);

  const { data: variantsIndex } = useVariantsIndex();
  const matchingVariants = useMemo(() => {
    if (!shouldSearchInventory || !variantsIndex) return [];
    const query = trimmedSearch.toLowerCase();
    return variantsIndex.variants
      .filter(
        (v) =>
          v.sku.toLowerCase().includes(query) ||
          v.productTitle.toLowerCase().includes(query),
      )
      .slice(0, 5);
  }, [shouldSearchInventory, variantsIndex, trimmedSearch]);

  // Search bundles
  const shouldSearchBundles = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("bundle") ||
        trimmedSearch.length >= 2)
    );
  }, [hasSearch, trimmedSearch]);

  const { data: bundlesData } = useAdminBundles(
    shouldSearchBundles
      ? {
          limit: 5,
        }
      : undefined,
  );

  // Search discounts
  const shouldSearchDiscounts = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("discount") ||
        trimmedSearch.toLowerCase().includes("coupon") ||
        trimmedSearch.length >= 2)
    );
  }, [hasSearch, trimmedSearch]);

  const { data: discountsData } = useAdminDiscounts(
    shouldSearchDiscounts
      ? {
          search: trimmedSearch,
          limit: 5,
        }
      : undefined,
  );

  // Search price lists
  const shouldSearchPriceLists = useMemo(() => {
    return (
      hasSearch &&
      (trimmedSearch.toLowerCase().includes("price") ||
        trimmedSearch.toLowerCase().includes("pricing") ||
        trimmedSearch.length >= 2)
    );
  }, [hasSearch, trimmedSearch]);

  const { data: priceListsData } = useAdminPriceLists(
    shouldSearchPriceLists ? { search: trimmedSearch } : undefined,
  );

  // Filter navigation items based on search
  const filteredItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase()),
  );

  // Group navigation items by section
  const _groupedItems = filteredItems.reduce(
    (acc, item) => {
      const section = item.href.split("/")[1] || "other";
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(item);
      return acc;
    },
    {} as Record<string, typeof navItems>,
  );

  const handleSelect = (href: string) => {
    router.push(href);
    closeCommandPalette();
    setSearch("");
  };

  const orders = ordersData?.data || [];
  const products = productsData?.data || [];
  const customers = customersData?.data || [];
  const bundles = bundlesData?.data || [];
  const discounts = discountsData?.data || [];
  const priceLists = Array.isArray(priceListsData) ? priceListsData : [];

  const _hasResults =
    orders.length > 0 ||
    products.length > 0 ||
    customers.length > 0 ||
    matchingVariants.length > 0 ||
    bundles.length > 0 ||
    discounts.length > 0 ||
    priceLists.length > 0 ||
    filteredItems.length > 0;

  return (
    <CommandDialog open={isOpen} onOpenChange={closeCommandPalette}>
      <CommandInput
        placeholder="Search products, orders, customers, variants, bundles, discounts..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {hasSearch ? "No results found." : "Start typing to search..."}
        </CommandEmpty>

        {/* Products */}
        {shouldSearchProducts && products.length > 0 && (
          <CommandGroup heading="Products">
            {products.map((product) => (
              <CommandItem
                key={product.id}
                value={`product-${product.id}`}
                onSelect={() => handleSelect(`/products/${product.id}`)}
              >
                <Package className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{product.title}</span>
                  {product.status && (
                    <span className="text-xs text-muted-foreground">
                      {product.status}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
            {productsData && productsData.total > products.length && (
              <CommandItem
                value="view-all-products"
                onSelect={() => handleSelect("/products")}
              >
                <Package className="mr-2 h-4 w-4" />
                View all products ({productsData.total} total)
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Orders */}
        {shouldSearchOrders && orders.length > 0 && (
          <CommandGroup heading="Orders">
            {orders.map((order) => (
              <CommandItem
                key={order.id}
                value={`order-${order.orderNumber}`}
                onSelect={() => handleSelect(`/orders/${order.id}`)}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{order.orderNumber}</span>
                  {order.customerName && (
                    <span className="text-xs text-muted-foreground">
                      {order.customerName}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
            {ordersData && ordersData.total > orders.length && (
              <CommandItem
                value="view-all-orders"
                onSelect={() => handleSelect("/orders")}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                View all orders ({ordersData.total} total)
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Customers */}
        {shouldSearchCustomers && customers.length > 0 && (
          <CommandGroup heading="Customers">
            {customers.map((customer) => (
              <CommandItem
                key={customer.id}
                value={`customer-${customer.id}`}
                onSelect={() => handleSelect(`/customers`)}
              >
                <Users className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    {customer.name || customer.email}
                  </span>
                  {customer.email && customer.name && (
                    <span className="text-xs text-muted-foreground">
                      {customer.email}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
            {customersData && customersData.total > customers.length && (
              <CommandItem
                value="view-all-customers"
                onSelect={() => handleSelect("/customers")}
              >
                <Users className="mr-2 h-4 w-4" />
                View all customers ({customersData.total} total)
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Inventory Variants */}
        {shouldSearchInventory && matchingVariants.length > 0 && (
          <CommandGroup heading="Inventory">
            {matchingVariants.map((variant) => (
              <CommandItem
                key={variant.variantId}
                value={`inventory-${variant.sku}`}
                onSelect={() => handleSelect(`/inventory/${variant.variantId}`)}
              >
                <Package className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{variant.sku}</span>
                  <span className="text-xs text-muted-foreground">
                    {variant.productTitle}
                  </span>
                </div>
              </CommandItem>
            ))}
            <CommandItem
              value="view-all-inventory"
              onSelect={() => handleSelect("/inventory")}
            >
              <Package className="mr-2 h-4 w-4" />
              View all inventory
            </CommandItem>
          </CommandGroup>
        )}

        {/* Bundles */}
        {shouldSearchBundles && bundles.length > 0 && (
          <CommandGroup heading="Bundles">
            {bundles.map((bundle) => (
              <CommandItem
                key={bundle.id}
                value={`bundle-${bundle.id}`}
                onSelect={() => handleSelect(`/bundles/${bundle.id}`)}
              >
                <Boxes className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{bundle.title}</span>
                  {bundle.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {bundle.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
            {bundlesData && bundlesData.total > bundles.length && (
              <CommandItem
                value="view-all-bundles"
                onSelect={() => handleSelect("/bundles")}
              >
                <Boxes className="mr-2 h-4 w-4" />
                View all bundles ({bundlesData.total} total)
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Discounts */}
        {shouldSearchDiscounts && discounts.length > 0 && (
          <CommandGroup heading="Discounts">
            {discounts.map((discount) => (
              <CommandItem
                key={discount.id}
                value={`discount-${discount.id}`}
                onSelect={() => handleSelect(`/discounts/${discount.id}`)}
              >
                <Tag className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    {discount.code} - {discount.name}
                  </span>
                  {discount.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {discount.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
            {discountsData && discountsData.total > discounts.length && (
              <CommandItem
                value="view-all-discounts"
                onSelect={() => handleSelect("/discounts")}
              >
                <Tag className="mr-2 h-4 w-4" />
                View all discounts ({discountsData.total} total)
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Price Lists */}
        {shouldSearchPriceLists && priceLists.length > 0 && (
          <CommandGroup heading="Price Lists">
            {priceLists.slice(0, 5).map((priceList) => (
              <CommandItem
                key={priceList.id}
                value={`price-list-${priceList.id}`}
                onSelect={() => handleSelect(`/price-lists/${priceList.id}`)}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{priceList.name}</span>
                  {priceList.type && (
                    <span className="text-xs text-muted-foreground">
                      {priceList.type}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
            {priceLists.length > 5 && (
              <CommandItem
                value="view-all-price-lists"
                onSelect={() => handleSelect("/price-lists")}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                View all price lists ({priceLists.length} total)
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Navigation */}
        {filteredItems.length > 0 && (
          <CommandGroup heading="Navigation">
            {filteredItems.map((item, index) => (
              <CommandItem
                key={`${item.href}-${item.label}-${index}`}
                value={item.label}
                onSelect={() => handleSelect(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
