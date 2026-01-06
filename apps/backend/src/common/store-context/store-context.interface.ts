/**
 * Store context interface
 * Represents the store context for the current request
 */
export interface StoreContext {
  storeId: string;
  storeName?: string;
  storeDomain?: string;
  storeCurrency?: string;
}

/**
 * Store context request extension
 * Extends Express Request to include store context
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      storeContext?: StoreContext;
    }
  }
}
