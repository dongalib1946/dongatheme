const ALADIN_ITEM_LIST_URL = 'https://www.aladin.co.kr/ttb/api/ItemList.aspx';
const FETCH_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let memoryCache = null;

const QUERY_TYPES = new Set([
  'Bestseller',
  'ItemNewAll',
  'ItemNewSpecial',
  'BlogBest',
]);
const SEARCH_TARGETS = new Set(['Book', 'Foreign', 'Music', 'DVD']);
const COVER_SIZES = new Set(['Big', 'MidBig', 'Mid', 'Small', 'Mini', 'None']);
const EXCLUDED_BOOK_TERMS = [
  '만화',
  '웹툰',
  '라이트노벨',
  '수험서',
  '자격증',
  '공무원',
  '경찰',
  '소방',
  '임용',
  '변호사시험',
  'LEET',
  'PSAT',
  'NCS',
  '수능',
  '모의고사',
  '기출',
  '문제집',
  '문제풀이',
  '400제',
  '1000제',
  '토익',
  '토플',
  'JLPT',
  '한국사능력검정',
  '컴활',
  '공인중개사',
  '세무사',
  '회계사',
  '감정평가사',
  '손해평가사',
  '에듀윌',
  '해커스',
  '시나공',
];

function pick(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function intInRange(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

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

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeItem(item) {
  return {
    ...item,
    librarySource: '알라딘 베스트셀러',
    libraryCollection: item.categoryName || '',
    dataSource: 'Aladin Open API',
  };
}

function shouldExcludeBook(item) {
  const text = [
    item.title,
    item.categoryName,
    item.publisher,
    item.description,
  ].filter(Boolean).join(' ').toUpperCase();

  return EXCLUDED_BOOK_TERMS.some((term) => text.includes(term.toUpperCase()));
}

async function fetchAladinBestBooks({ ttbKey, queryType, maxResults, searchTarget, cover }) {
  const url = new URL(ALADIN_ITEM_LIST_URL);
  url.searchParams.set('ttbkey', ttbKey);
  url.searchParams.set('QueryType', queryType);
  url.searchParams.set('MaxResults', String(Math.min(50, Math.max(maxResults, 40))));
  url.searchParams.set('start', '1');
  url.searchParams.set('SearchTarget', searchTarget);
  url.searchParams.set('Cover', cover);
  url.searchParams.set('output', 'js');
  url.searchParams.set('Version', '20131101');

  const res = await fetchWithTimeout(url, {
    headers: {
      accept: 'application/json,text/javascript,*/*;q=0.8',
    },
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Aladin list failed: ${res.status}`);

  const data = JSON.parse(raw);
  if (data.errorCode) {
    throw new Error(data.errorMessage || `Aladin API error: ${data.errorCode}`);
  }

  return (data.item || [])
    .filter((item) => !shouldExcludeBook(item))
    .slice(0, maxResults)
    .map(normalizeItem);
}

exports.handler = async function handler(event) {
  const ttbKey = process.env.ALADIN_TTB_KEY;
  if (!ttbKey) {
    return response(500, {
      error: 'Missing ALADIN_TTB_KEY environment variable.',
      message: '알라딘 베스트셀러를 불러오려면 Netlify 환경변수 ALADIN_TTB_KEY가 필요합니다.',
    });
  }

  const params = event.queryStringParameters || {};
  const queryType = pick(params.queryType, QUERY_TYPES, 'Bestseller');
  const searchTarget = pick(params.searchTarget, SEARCH_TARGETS, 'Book');
  const cover = pick(params.cover, COVER_SIZES, 'Big');
  const maxResults = intInRange(params.maxResults, 20, 1, 50);
  const version = String(params.v || 'default');
  const dateKey = todayKey();
  const cacheKey = `${version}:${dateKey}:${queryType}:${searchTarget}:${maxResults}:${cover}`;

  if (memoryCache && memoryCache.key === cacheKey && Date.now() - memoryCache.savedAt < CACHE_TTL_MS) {
    return response(200, memoryCache.body, 'public, max-age=21600, stale-while-revalidate=43200');
  }

  try {
    const items = await fetchAladinBestBooks({
      ttbKey,
      queryType,
      maxResults,
      searchTarget,
      cover,
    });

    if (!items.length) {
      return response(502, {
        error: 'No Aladin bestseller books returned after filtering comics and test-prep books.',
        queryType,
        searchTarget,
      });
    }

    const body = {
      items,
      title: '알라딘 베스트셀러',
      link: 'https://www.aladin.co.kr/shop/common/wbest.aspx',
      updatedAt: new Date().toISOString(),
      dateKey,
      source: 'Aladin Open API',
      queryType,
      searchTarget,
    };
    memoryCache = { key: cacheKey, savedAt: Date.now(), body };
    return response(200, body, 'public, max-age=21600, stale-while-revalidate=43200');
  } catch (error) {
    return response(500, {
      error: 'Failed to load Aladin bestseller books.',
      message: error && error.message ? error.message : String(error),
    });
  }
};
