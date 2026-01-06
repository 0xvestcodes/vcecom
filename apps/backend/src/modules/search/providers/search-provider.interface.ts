/**
 * Search provider interface
 * Abstract interface for search engine implementations
 */

import type {
  BatchIndexResult,
  IndexOptions,
  IndexStats,
  SearchDocument,
  SearchQuery,
  SearchResponse,
} from "../types/search-provider.types";

/**
 * Abstract search provider interface
 * All search engine implementations must implement this interface
 */
export interface ISearchProvider {
  /**
   * Initialize the search provider
   * Called once when the provider is instantiated
   */
  initialize(): Promise<void>;

  /**
   * Check if the provider is ready to use
   */
  isReady(): boolean;

  /**
   * Create or update an index
   */
  createIndex(indexName: string, options?: IndexOptions): Promise<void>;

  /**
   * Delete an index
   */
  deleteIndex(indexName: string): Promise<void>;

  /**
   * Check if an index exists
   */
  indexExists(indexName: string): Promise<boolean>;

  /**
   * Get index statistics
   */
  getIndexStats(indexName: string): Promise<IndexStats>;

  /**
   * Index a single document
   */
  indexDocument(indexName: string, document: SearchDocument): Promise<void>;

  /**
   * Index multiple documents in batch
   */
  indexDocuments(
    indexName: string,
    documents: SearchDocument[],
  ): Promise<BatchIndexResult>;

  /**
   * Delete a document from the index
   */
  deleteDocument(indexName: string, documentId: string): Promise<void>;

  /**
   * Delete multiple documents from the index
   */
  deleteDocuments(
    indexName: string,
    documentIds: string[],
  ): Promise<BatchIndexResult>;

  /**
   * Clear all documents from an index
   */
  clearIndex(indexName: string): Promise<void>;

  /**
   * Search documents in an index
   */
  search<T extends SearchDocument = SearchDocument>(
    indexName: string,
    query: SearchQuery,
  ): Promise<SearchResponse<T>>;

  /**
   * Update index settings (ranking rules, synonyms, etc.)
   */
  updateIndexSettings(
    indexName: string,
    settings: IndexOptions["settings"],
  ): Promise<void>;

  /**
   * Get current index settings
   */
  getIndexSettings(indexName: string): Promise<IndexOptions["settings"]>;
}
