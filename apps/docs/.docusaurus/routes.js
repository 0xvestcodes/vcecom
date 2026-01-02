import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/api-reference/admin',
    component: ComponentCreator('/api-reference/admin', 'b62'),
    exact: true
  },
  {
    path: '/api-reference/store',
    component: ComponentCreator('/api-reference/store', '402'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '1a3'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', '017'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', '4b4'),
            routes: [
              {
                path: '/docs/admin/pagination',
                component: ComponentCreator('/docs/admin/pagination', '028'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/api-reference/admin-api',
                component: ComponentCreator('/docs/api-reference/admin-api', 'da5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/api-reference/store-api',
                component: ComponentCreator('/docs/api-reference/store-api', '847'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/dependencies',
                component: ComponentCreator('/docs/architecture/dependencies', '83a'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/modules',
                component: ComponentCreator('/docs/architecture/modules', 'f0e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/monorepo',
                component: ComponentCreator('/docs/architecture/monorepo', 'cb1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/overview',
                component: ComponentCreator('/docs/architecture/overview', 'dc8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/authentication/admin-auth',
                component: ComponentCreator('/docs/authentication/admin-auth', '466'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/authentication/storefront-auth',
                component: ComponentCreator('/docs/authentication/storefront-auth', '2c9'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/cart-integration',
                component: ComponentCreator('/docs/bundles/cart-integration', 'c02'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/choice-sets',
                component: ComponentCreator('/docs/bundles/choice-sets', 'af8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/definition',
                component: ComponentCreator('/docs/bundles/definition', '701'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/overview',
                component: ComponentCreator('/docs/bundles/overview', '79d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/pricing',
                component: ComponentCreator('/docs/bundles/pricing', 'fca'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/collections',
                component: ComponentCreator('/docs/catalog/collections', 'f36'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/inventory',
                component: ComponentCreator('/docs/catalog/inventory', 'd07'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/products',
                component: ComponentCreator('/docs/catalog/products', 'ead'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/variants',
                component: ComponentCreator('/docs/catalog/variants', 'd73'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/guest-checkout',
                component: ComponentCreator('/docs/checkout/guest-checkout', '273'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/inventory-flow',
                component: ComponentCreator('/docs/checkout/inventory-flow', '045'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/overview',
                component: ComponentCreator('/docs/checkout/overview', '453'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/payment-intent',
                component: ComponentCreator('/docs/checkout/payment-intent', '30b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/state-machine',
                component: ComponentCreator('/docs/checkout/state-machine', '93a'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/webhooks',
                component: ComponentCreator('/docs/checkout/webhooks', 'f72'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/database-schema/erd',
                component: ComponentCreator('/docs/database-schema/erd', '4f3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/database-schema/overview',
                component: ComponentCreator('/docs/database-schema/overview', '2d4'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/database-schema/tables',
                component: ComponentCreator('/docs/database-schema/tables', 'c9c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/docker',
                component: ComponentCreator('/docs/deployment/docker', '18b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/overview',
                component: ComponentCreator('/docs/deployment/overview', '9ea'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/production',
                component: ComponentCreator('/docs/deployment/production', 'f51'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/scaling',
                component: ComponentCreator('/docs/deployment/scaling', '08c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/definitions',
                component: ComponentCreator('/docs/discounts/definitions', '33e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/drift-detection',
                component: ComponentCreator('/docs/discounts/drift-detection', 'c4f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/engine',
                component: ComponentCreator('/docs/discounts/engine', '66d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/overview',
                component: ComponentCreator('/docs/discounts/overview', '98f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/priority-stacking',
                component: ComponentCreator('/docs/discounts/priority-stacking', '41b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/snapshots',
                component: ComponentCreator('/docs/discounts/snapshots', '52f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/introduction',
                component: ComponentCreator('/docs/introduction', '78f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/introduction/',
                component: ComponentCreator('/docs/introduction/', 'da1'),
                exact: true
              },
              {
                path: '/docs/observability/context',
                component: ComponentCreator('/docs/observability/context', 'c65'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/correlation',
                component: ComponentCreator('/docs/observability/correlation', '726'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/logging',
                component: ComponentCreator('/docs/observability/logging', '878'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/tracing',
                component: ComponentCreator('/docs/observability/tracing', 'b6b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/creation',
                component: ComponentCreator('/docs/orders/creation', '209'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/fulfillment',
                component: ComponentCreator('/docs/orders/fulfillment', '37d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/inventory-reconciliation',
                component: ComponentCreator('/docs/orders/inventory-reconciliation', '438'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/overview',
                component: ComponentCreator('/docs/orders/overview', '875'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/reconciliation',
                component: ComponentCreator('/docs/orders/reconciliation', 'e9e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/refunds',
                component: ComponentCreator('/docs/orders/refunds', '1d2'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/customer-groups',
                component: ComponentCreator('/docs/pricing/customer-groups', '9c9'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/drift-detection',
                component: ComponentCreator('/docs/pricing/drift-detection', 'cea'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/overview',
                component: ComponentCreator('/docs/pricing/overview', '8f3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/price-lists',
                component: ComponentCreator('/docs/pricing/price-lists', '6e7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/pricing-engine',
                component: ComponentCreator('/docs/pricing/pricing-engine', '09d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/snapshots',
                component: ComponentCreator('/docs/pricing/snapshots', '645'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/caching-layers',
                component: ComponentCreator('/docs/redis/caching-layers', '956'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/expirations',
                component: ComponentCreator('/docs/redis/expirations', '3c8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/key-patterns',
                component: ComponentCreator('/docs/redis/key-patterns', '217'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/overview',
                component: ComponentCreator('/docs/redis/overview', '57d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/aggregation',
                component: ComponentCreator('/docs/reviews/aggregation', '3ac'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/caching',
                component: ComponentCreator('/docs/reviews/caching', 'adb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/moderation',
                component: ComponentCreator('/docs/reviews/moderation', '66a'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/overview',
                component: ComponentCreator('/docs/reviews/overview', 'c1f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/verified-purchase',
                component: ComponentCreator('/docs/reviews/verified-purchase', 'c4f'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', 'e5f'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
