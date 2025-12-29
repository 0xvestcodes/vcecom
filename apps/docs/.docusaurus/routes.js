import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
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
    component: ComponentCreator('/docs', '9d0'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', '0e2'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', '373'),
            routes: [
              {
                path: '/docs/admin/pagination',
                component: ComponentCreator('/docs/admin/pagination', '424'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/api-reference/admin-api',
                component: ComponentCreator('/docs/api-reference/admin-api', '090'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/api-reference/store-api',
                component: ComponentCreator('/docs/api-reference/store-api', '97b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/bugs',
                component: ComponentCreator('/docs/architecture/bugs', 'b1f'),
                exact: true
              },
              {
                path: '/docs/architecture/dependencies',
                component: ComponentCreator('/docs/architecture/dependencies', 'ccf'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/modules',
                component: ComponentCreator('/docs/architecture/modules', '756'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/monorepo',
                component: ComponentCreator('/docs/architecture/monorepo', 'ad4'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture/overview',
                component: ComponentCreator('/docs/architecture/overview', 'd82'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/authentication/admin-auth',
                component: ComponentCreator('/docs/authentication/admin-auth', '922'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/authentication/storefront-auth',
                component: ComponentCreator('/docs/authentication/storefront-auth', '193'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/cart-integration',
                component: ComponentCreator('/docs/bundles/cart-integration', 'cc2'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/choice-sets',
                component: ComponentCreator('/docs/bundles/choice-sets', 'cee'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/definition',
                component: ComponentCreator('/docs/bundles/definition', '6fd'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/overview',
                component: ComponentCreator('/docs/bundles/overview', 'e81'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/bundles/pricing',
                component: ComponentCreator('/docs/bundles/pricing', '4c7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/collections',
                component: ComponentCreator('/docs/catalog/collections', '6da'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/inventory',
                component: ComponentCreator('/docs/catalog/inventory', '8e5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/products',
                component: ComponentCreator('/docs/catalog/products', 'd67'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/catalog/variants',
                component: ComponentCreator('/docs/catalog/variants', 'afa'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/guest-checkout',
                component: ComponentCreator('/docs/checkout/guest-checkout', '5e6'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/inventory-flow',
                component: ComponentCreator('/docs/checkout/inventory-flow', 'adb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/overview',
                component: ComponentCreator('/docs/checkout/overview', 'df5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/payment-intent',
                component: ComponentCreator('/docs/checkout/payment-intent', 'c81'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/state-machine',
                component: ComponentCreator('/docs/checkout/state-machine', '5dd'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/checkout/webhooks',
                component: ComponentCreator('/docs/checkout/webhooks', 'e8f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/database-schema/erd',
                component: ComponentCreator('/docs/database-schema/erd', '054'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/database-schema/overview',
                component: ComponentCreator('/docs/database-schema/overview', '484'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/database-schema/tables',
                component: ComponentCreator('/docs/database-schema/tables', 'f05'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/docker',
                component: ComponentCreator('/docs/deployment/docker', '3d0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/overview',
                component: ComponentCreator('/docs/deployment/overview', 'd63'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/production',
                component: ComponentCreator('/docs/deployment/production', '9ee'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment/scaling',
                component: ComponentCreator('/docs/deployment/scaling', '148'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/definitions',
                component: ComponentCreator('/docs/discounts/definitions', '95f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/drift-detection',
                component: ComponentCreator('/docs/discounts/drift-detection', 'b39'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/engine',
                component: ComponentCreator('/docs/discounts/engine', 'afc'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/overview',
                component: ComponentCreator('/docs/discounts/overview', 'e4b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/priority-stacking',
                component: ComponentCreator('/docs/discounts/priority-stacking', '8fc'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/discounts/snapshots',
                component: ComponentCreator('/docs/discounts/snapshots', '410'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/introduction',
                component: ComponentCreator('/docs/introduction', 'c2c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/context',
                component: ComponentCreator('/docs/observability/context', '3f6'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/correlation',
                component: ComponentCreator('/docs/observability/correlation', 'b55'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/health-checks',
                component: ComponentCreator('/docs/observability/health-checks', 'a06'),
                exact: true
              },
              {
                path: '/docs/observability/logging',
                component: ComponentCreator('/docs/observability/logging', '9e5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/observability/tracing',
                component: ComponentCreator('/docs/observability/tracing', '3bf'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/creation',
                component: ComponentCreator('/docs/orders/creation', '5a3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/error-handling',
                component: ComponentCreator('/docs/orders/error-handling', '7c0'),
                exact: true
              },
              {
                path: '/docs/orders/fulfillment',
                component: ComponentCreator('/docs/orders/fulfillment', '3b7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/inventory-reconciliation',
                component: ComponentCreator('/docs/orders/inventory-reconciliation', '4e7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/overview',
                component: ComponentCreator('/docs/orders/overview', '44b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/reconciliation',
                component: ComponentCreator('/docs/orders/reconciliation', '752'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/refunds',
                component: ComponentCreator('/docs/orders/refunds', '3e8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/orders/troubleshooting',
                component: ComponentCreator('/docs/orders/troubleshooting', '874'),
                exact: true
              },
              {
                path: '/docs/pricing/customer-groups',
                component: ComponentCreator('/docs/pricing/customer-groups', 'cd5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/drift-detection',
                component: ComponentCreator('/docs/pricing/drift-detection', 'a0d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/overview',
                component: ComponentCreator('/docs/pricing/overview', '281'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/price-lists',
                component: ComponentCreator('/docs/pricing/price-lists', 'afe'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/pricing-engine',
                component: ComponentCreator('/docs/pricing/pricing-engine', '9f7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/pricing/snapshots',
                component: ComponentCreator('/docs/pricing/snapshots', '782'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/caching-layers',
                component: ComponentCreator('/docs/redis/caching-layers', '096'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/expirations',
                component: ComponentCreator('/docs/redis/expirations', '22c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/key-patterns',
                component: ComponentCreator('/docs/redis/key-patterns', '976'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/redis/overview',
                component: ComponentCreator('/docs/redis/overview', 'af1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/aggregation',
                component: ComponentCreator('/docs/reviews/aggregation', 'a20'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/caching',
                component: ComponentCreator('/docs/reviews/caching', '26c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/moderation',
                component: ComponentCreator('/docs/reviews/moderation', 'a2c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/overview',
                component: ComponentCreator('/docs/reviews/overview', '0a4'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/reviews/verified-purchase',
                component: ComponentCreator('/docs/reviews/verified-purchase', '96f'),
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
