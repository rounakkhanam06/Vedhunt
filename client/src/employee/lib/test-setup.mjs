// Lets `node --test` import the client's ES modules, which use extensionless
// specifiers (Vite resolves those; plain Node does not). Test-only:
//   node --import ./client/src/employee/lib/test-setup.mjs --test client/src/employee/lib/leads.test.js
import { register } from 'node:module';

register(
  'data:text/javascript,' + encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      try {
        return await next(specifier, context);
      } catch (error) {
        if (/^\\.{1,2}\\//.test(specifier) && !/\\.[a-z]+$/i.test(specifier)) return next(specifier + '.js', context);
        throw error;
      }
    }
  `),
  import.meta.url,
);
