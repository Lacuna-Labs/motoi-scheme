// Thin re-export of the JS slat binding. Kept here so consumers can
// `import { slatLoads, slatDumps } from 'motoi-scheme'` without
// reaching into bindings/.

export { slatLoads, slatDumps, slatToJsonl, jsonlToSlat, SlatValue } from '../bindings/js/slat.js'
