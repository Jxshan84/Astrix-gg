'use strict';

require('./utils/ensureDependencies.cjs')();

// KataBump and generic Node hosts may start this file directly.
// Register the tsx runtime so the TypeScript source is always the source of truth.
require('tsx/cjs');
require('./index.ts');
