# `src/openapi` — interactive API reference

Serves a browsable, executable reference at **`/docs`**, generated from the same
Zod schemas that validate requests at runtime.

| Route                    | Serves                            |
| ------------------------ | --------------------------------- |
| `GET /docs`              | Scalar UI with a "Try it" console |
| `GET /docs/openapi.json` | The raw OpenAPI 3.0 document      |

Controlled by `ENABLE_API_DOCS`. Defaults to **on** outside production.

## Why it is generated, not written

The specification is built from `src/schema/*.schema.ts` — the same objects
`validateSchema` uses. Hand-written API docs (or JSDoc annotations) are a second
copy of the contract, and second copies drift. Change a schema here and the
published docs change with it.

## A note on `extend-zod.ts`

`extendZodWithOpenApi` mutates the shared Zod instance, so it must run before
any module evaluates a schema that calls `.openapi()`. That happens in
`extend-zod.ts`, which re-exports `z`. **Import `z` from there** in anything that
describes a schema — importing from `'zod'` directly works only by luck of
import order, and the failure mode is a module-load crash that `tsx watch`
reports as silence.

## Adding an endpoint

One block in `document.ts`:

```ts
registerEndpoint({
    method: 'post',
    path: '/api/v0/products',
    tags: ['Products'],
    summary: 'Create a product',
    description: 'What a reader needs to know that the schema does not already say.',
    schema: createProductSchema, // body/query/params are read from it
    secure: true, // adds the x-api-key requirement
    response: {
        description: 'Created',
        schema: successEnvelope(productSchema, 'Product created'),
        example: { success: true, status: 201, message: 'Product created', data: { id: 'p_01H', name: 'Desk' } },
    },
    errors: {
        '400': { description: 'Validation failed (E006).' },
    },
});
```

`429` and `500` are added automatically — every endpoint can be rate limited,
and anything can break.

### Always give a concrete `example`

A schema tells a reader the _shape_; an example tells them what a real response
looks like. Without one, the renderer invents placeholders — `"appName":
"string"` — which teaches nobody anything.

This matters twice as much for errors, because every error response shares one
`ErrorResponse` schema. A single example baked into that shared schema would
illustrate _every_ failure with the same body: this page once showed a 429 and a
500 both rendered as a 400 validation error against `POST /send-email`. So the
example is built per response, from the endpoint's own path and method and the
status being described — see `buildErrorResponse` and `ERROR_CATALOGUE` in
`document.ts`. Add a status to the catalogue once, and every endpoint that
declares it gets correct wording.

Override the catalogue wording per endpoint when the generic text is not
specific enough:

```ts
errors: {
    '400': {
        description: '`loop` was not an integer between 0 and 60 (E006).',
        details: 'query.loop: Number must be less than or equal to 60',
    },
},
```

## Removing the feature entirely

Four steps, no traces left:

1. **Delete this folder** — `rm -rf src/openapi`
2. **Remove two lines from `src/app.ts`** — the `openApiRouter` import, and the
   guarded `app.use('/docs', ...)` mount
3. **Remove the flag** — `ENABLE_API_DOCS` from `src/schema/env.schema.ts`,
   `src/config/env.ts` and `.env.example`
4. **Uninstall** — `npm uninstall @scalar/express-api-reference @asteasolutions/zod-to-openapi`

Nothing else in the codebase imports from here, so `npm run check` passing after
step 4 means the removal is complete.

## Swapping the UI

Only `index.ts` knows which renderer is used. The specification at
`/docs/openapi.json` is standard OpenAPI, so any viewer works — Swagger UI,
Redoc, Stoplight Elements, or Postman's importer. Scalar was chosen because its
server-side footprint is a few KB (the UI itself loads from a CDN), where
`swagger-ui-dist` ships about 12 MB of assets your server has to serve.

The CDN dependency is the trade-off: the page needs internet access to render.
To self-host instead, install `@scalar/api-reference` and serve its bundle from
`public/`, then point the script tag at it and drop the `cdn.jsdelivr.net`
entries from the CSP in `index.ts`.
