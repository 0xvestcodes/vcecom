import RedocApi from "@site/src/components/RedocApi";
import Layout from "@theme/Layout";

export default function AdminApi() {
  // Use local OpenAPI JSON file (generated during build) or fallback to live endpoint
  // In production build, the file will be in static/api-docs/openapi.json
  // In development, fallback to localhost endpoint
  const isDev =
    typeof window !== "undefined" && window.location.hostname === "localhost";
  const specUrl = isDev
    ? "http://localhost:3001/api/docs-json"
    : "/api-docs/openapi.json";

  return (
    <Layout
      title="Admin API Reference"
      description="Admin API endpoints for platform management"
    >
      <RedocApi specUrl={specUrl} title="Admin API" />
    </Layout>
  );
}
