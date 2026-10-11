import { register } from 'node:module';
register(new URL('./browser-loader.mjs', import.meta.url));
