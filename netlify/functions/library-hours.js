const LIBRARY_HOME_URL = 'https://library.donga.ac.kr/';
const LIBRARIES = {
  hallim: {
    id: 'useTime1',
    label: '한림',
    displayName: '한림도서관',
  },
  bumin: {
    id: 'useTime2',
    label: '부민',
    displayName: '부민도서관',
  },
};
const LIBRARY_REQUEST_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6',
};

function response(statusCode, body, cacheControl = 'no-store') {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
    body: JSON.stringify(body),
  };
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+:\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLibraryHours(html, library) {
  const current = LIBRARIES[library] || LIBRARIES.hallim;
  const panePattern = new RegExp(`<div id="${escapeRegExp(current.id)}"[\\s\\S]*?(?=<div id="useTime\\d"|<\\/div>\\s*<\\/div>\\s*<\\/div>\\s*<\\/section>)`, 'i');
  const pane = String(html || '').match(panePattern);
  if (!pane) return [];

  const items = [];
  const names = [...pane[0].matchAll(/<div class="item-name">([\s\S]*?)<\/div>/gi)];

  names.forEach((match, index) => {
    const name = cleanText(match[1]);
    const next = names[index + 1];
    const block = pane[0].slice(match.index, next ? next.index : undefined);
    const timeBlocks = [...block.matchAll(/<div class="item-time-value[^"]*">([\s\S]*?<\/em>)/gi)]
      .map(match => cleanText(match[1]))
      .filter(Boolean);

    if (name && timeBlocks.length) {
      items.push({
        name,
        time: timeBlocks.join(' · '),
      });
    }
  });

  return items;
}

exports.handler = async function handler(event) {
  try {
    const params = event.queryStringParameters || {};
    const library = LIBRARIES[params.library] ? params.library : 'hallim';
    const selected = LIBRARIES[library];
    const res = await fetch(LIBRARY_HOME_URL, { headers: LIBRARY_REQUEST_HEADERS });
    const html = await res.text();

    if (!res.ok) {
      return response(res.status, {
        error: 'Dong-A library page request failed.',
        status: res.status,
      });
    }

    const items = parseLibraryHours(html, library);
    if (!items.length) {
      return response(502, {
        error: `Could not parse ${selected.displayName} hours.`,
      });
    }

    return response(200, {
      library,
      libraryName: selected.displayName,
      libraryLabel: selected.label,
      items,
      source: LIBRARY_HOME_URL,
      updatedAt: new Date().toISOString(),
    }, 'public, max-age=600, stale-while-revalidate=1800');
  } catch (error) {
    return response(500, {
      error: 'Failed to load Dong-A library hours.',
      message: error && error.message ? error.message : String(error),
    });
  }
};
