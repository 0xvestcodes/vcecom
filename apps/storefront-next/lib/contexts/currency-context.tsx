"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

interface CurrencyContextType {
  selectedCurrency: string;
  currencies: Currency[];
  isLoading: boolean;
  setCurrency: (currencyCode: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

const CURRENCY_STORAGE_KEY = "storefront_currency";
const DEFAULT_CURRENCY = "INR";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] =
    useState<string>(DEFAULT_CURRENCY);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load currency from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) {
      setSelectedCurrencyState(stored);
    }
  }, []);

  // Fetch active currencies
  useEffect(() => {
    async function fetchCurrencies() {
      try {
        const response = await fetch("/api/currencies/active", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setCurrencies(data);

          // Validate stored currency is still active
          const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
          if (stored && data.some((c: Currency) => c.code === stored)) {
            setSelectedCurrencyState(stored);
          } else if (data.length > 0) {
            // Use default currency or first available
            const defaultCurrency =
              data.find((c: Currency) => c.code === DEFAULT_CURRENCY) ||
              data[0];
            setSelectedCurrencyState(defaultCurrency.code);
            localStorage.setItem(CURRENCY_STORAGE_KEY, defaultCurrency.code);
          }
        }
      } catch (error) {
        console.error("Failed to fetch currencies:", error);
        // Fallback to default
        setCurrencies([
          { code: DEFAULT_CURRENCY, name: "Indian Rupee", symbol: "₹" },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCurrencies();
  }, []);

  const setCurrency = useCallback(async (currencyCode: string) => {
    // Update cart currency if cart exists
    try {
      // Update cart currency via API route (which proxies to backend)
      await fetch("/api/cart/currency", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currency: currencyCode }),
      });
    } catch (error) {
      console.error("Failed to update cart currency:", error);
      // Continue anyway - currency selection should still work
    }

    setSelectedCurrencyState(currencyCode);
    localStorage.setItem(CURRENCY_STORAGE_KEY, currencyCode);

    // Reload page to refresh server-side data (product prices, cart totals)
    // This ensures all prices are recalculated with the new currency
    window.location.reload();
  }, []);

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        currencies,
        isLoading,
        setCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
