const fs = require('fs/promises');
const path = require('path');

const { handler: aladinBooks } = require('../netlify/functions/aladin-books');
const { handler: libraryHours } = require('../netlify/functions/library-hours');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DRIVE_FOLDER_ID = '1I0G9cfTIvnmXkxmFcpGpDHusr8ety-5-';

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

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

async function fetchDrivePosters() {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(DRIVE_FOLDER_ID)}#grid`;
  const res = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 GitHub Pages poster generator',
    },
  });
  const html = await res.text();
  if (!res.ok) throw new Error(`Google Drive folder HTML failed: ${res.status}`);

  const entries = [];
  const entryPattern = /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<img src="([^"]+)" alt="[^"]*"\/>[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  let match;
  while ((match = entryPattern.exec(html))) {
    const id = match[1];
    const thumbUrl = decodeHtml(match[2]).replace(/=s\d+$/, '=s2000');
    const name = decodeHtml(match[3]).replace(/<[^>]*>/g, '').trim() || 'poster';
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    const candidates = [thumbUrl, downloadUrl];

    entries.push({
      id,
      name,
      mimeType: '',
      modifiedTime: '',
      candidates,
      url: candidates[0],
      tried: 0,
    });
  }

  if (!entries.length) throw new Error('No poster entries found in Google Drive folder HTML.');

  return {
    items: entries,
    source: 'Google Drive shared folder',
    folderUrl: `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}?usp=sharing`,
    updatedAt: new Date().toISOString(),
  };
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

  try {
    await writeJson('data/posters.json', await fetchDrivePosters());
  } catch (error) {
    console.warn(`Could not generate poster data: ${error.message}`);
    await writeErrorJson('data/posters.json', error);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
