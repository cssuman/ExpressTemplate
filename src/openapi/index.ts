import { Router } from 'express';
import helmet from 'helmet';

import { getOpenApiDocument } from '@/openapi/document';

/**
 * Interactive API reference.
 *
 *   GET /docs              browsable reference with a "Try it" console
 *   GET /docs/openapi.json the raw specification - import it into Postman or
 *                          Insomnia, or generate a client from it
 *
 * The whole feature lives in this folder behind one guarded line in app.ts.
 * See src/openapi/README.md to remove it.
 */
const openApiRouter = Router();

/**
 * The renderer, pinned.
 *
 * Scalar is loaded as a script rather than as an npm package on purpose: its
 * Express wrapper is ESM-only, and this project compiles to CommonJS, so
 * requiring it fails on Node 18 and 20. A pinned script tag works on every
 * supported Node version, adds nothing to the install, and makes swapping
 * renderers a one-line change.
 *
 * Bump deliberately - `latest` would let the page change under you.
 */
const SCALAR_VERSION = '1.72.1';
const SCALAR_BUNDLE = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.min.js`;

/**
 * Subresource Integrity for that bundle. Pinning the version alone does not
 * protect against a compromised or substituted CDN artifact, and this is the
 * page where a reader pastes their API key into the "Try it" console. The
 * browser refuses to execute the script if the hash does not match.
 *
 * Regenerate whenever SCALAR_VERSION changes:
 *   curl -sL <bundle url> | openssl dgst -sha384 -binary | openssl base64 -A
 */
const SCALAR_INTEGRITY = 'sha384-JezfTaoGe2t8F2YRYUQosjM0S21blpE8j3yOUgTEiTKCyLWx9K4lfwjKPd8Dp7WY';

const configuration = {
    /** Where the UI fetches the specification from. */
    url: '/docs/openapi.json',
    /** Pre-selects the x-api-key field in the "Try it" panel. */
    authentication: { preferredSecurityScheme: 'ApiKeyAuth' },
    hideDownloadButton: false,
};

/**
 * Scalar loads its bundle from a CDN, which the application's strict
 * Content-Security-Policy blocks. This relaxes the policy for the docs page
 * ONLY - every API response keeps the policy set in app.ts.
 *
 * Re-running helmet here replaces the CSP header for these routes.
 */
const docsContentSecurityPolicy = helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        // 'self' is what lets the "Try it" console call this API.
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        workerSrc: ["'self'", 'blob:'],
    },
});

/**
 * Escapes a value for safe embedding in an HTML attribute. The configuration is
 * ours rather than user input, but an unescaped `</script>` in a future config
 * value would break out of the tag - so the guard stays.
 */
const escapeAttribute = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const referencePage = (): string => `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>ExpressTemplate API Reference</title>
    </head>
    <body>
        <script id="api-reference" data-configuration="${escapeAttribute(JSON.stringify(configuration))}"></script>
        <script
            src="${SCALAR_BUNDLE}"
            integrity="${SCALAR_INTEGRITY}"
            crossorigin="anonymous"
        ></script>
        <noscript>
            This reference needs JavaScript. The specification itself is at
            <a href="/docs/openapi.json">/docs/openapi.json</a>.
        </noscript>
    </body>
</html>
`;

openApiRouter.get('/openapi.json', (_req, res) => {
    res.json(getOpenApiDocument());
});

openApiRouter.get('/', docsContentSecurityPolicy, (_req, res) => {
    res.type('html').send(referencePage());
});

export default openApiRouter;
