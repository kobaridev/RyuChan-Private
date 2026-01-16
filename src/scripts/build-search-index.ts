#!/usr/bin/env tsx

import { generateSearchIndex } from '../lib/search-indexer';

async function main() {
  try {
    await generateSearchIndex();
    console.log('Search index generation completed successfully');
  } catch (error) {
    console.error('Error generating search index:', error);
    process.exit(1);
  }
}

main();
