import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Adds `.openapi()` to Zod.
 *
 * `extendZodWithOpenApi` mutates the shared Zod instance, so it has to run
 * before any module evaluates a schema that calls `.openapi()`. Import order
 * between sibling modules is easy to get wrong - doing it here, and having
 * every describing module import `z` from this file, makes the dependency
 * explicit and impossible to reorder by accident.
 */
extendZodWithOpenApi(z);

export { z };
