const fs = require('fs/promises');
const path = require('path');

const { handler: aladinBooks } = require('../netlify/functions/aladin-books');
const { handler: libraryHours } = require('../netlify/functions/library-hours');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

async function writeJson(relativePath, value) {
  const filePath = path.join(ROOT, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${relativePath}`);
}

async function callFunction(handler, queryStringParameters = {}) {
  const result = await handler({
    httpMethod: 'GET',
    headers: {},
    queryStringParameters,
    body: null,
  });
  const body = JSON.parse(result.body || '{}');
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(body.message || body.error || `Function returned ${result.statusCode}`);
  }
  return body;
}

async function writeErrorJson(relativePath, error) {
  await writeJson(relativePath, {
    error: error && error.message ? error.message : String(error),
    items: [],
    updatedAt: new Date().toISOString(),
  });
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  if (!process.env.ALADIN_TTB_KEY) {
    throw new Error('Missing ALADIN_TTB_KEY. Add it as a GitHub Actions repository secret before deploying.');
  }

  try {
    const data = await callFunction(aladinBooks, {
      queryType: 'Bestseller',
      maxResults: '20',
      searchTarget: 'Book',
      cover: 'Big',
      v: 'aladin-bestseller-v1',
    });
    await writeJson('data/aladin-books.json', data);
  } catch (error) {
    console.warn(`Could not generate Aladin data: ${error.message}`);
    await writeErrorJson('data/aladin-books.json', error);
  }

  for (const library of ['hallim', 'bumin']) {
    try {
      const data = await callFunction(libraryHours, { library });
      await writeJson(`data/library-hours-${library}.json`, data);
    } catch (error) {
      console.warn(`Could not generate ${library} hours: ${error.message}`);
      await writeErrorJson(`data/library-hours-${library}.json`, error);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
