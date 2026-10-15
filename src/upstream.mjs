import {pathToFileURL} from 'node:url';
import {resolvePrototypePaths} from './paths.mjs';

const paths=resolvePrototypePaths();
const runtime=await import(pathToFileURL(paths.runtimeExports).href);
export const {sdk,ai,codemode,Type}=runtime;
export const runtimeLabel=paths.runtimeLabel;
