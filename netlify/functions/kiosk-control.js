const STORE_NAME = 'kiosk-control';
const CONTROL_KEY = 'reload-state';
const CAMPUSES = new Set(['hallim', 'bumin']);
const THEMES = new Set(['navy-glass', 'aurora', 'midnight', 'slate', 'daylight', 'mint', 'coral']);

function defaultCampusState(campus) {
  return {
    reloadVersion: 'initial',
    updatedAt: null,
    library: campus,
    theme: 'navy-glass',
  };
}

function defaultState() {
  return {
    campuses: {
      hallim: defaultCampusState('hallim'),
      bumin: defaultCampusState('bumin'),
    },
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

async function getStoreSafe(event) {
  try {
    const { connectLambda, getStore } = require('@netlify/blobs');
    if (typeof connectLambda === 'function' && event && event.blobs) {
      connectLambda(event);
    }
    return getStore(STORE_NAME);
  } catch (error) {
    console.error('[kiosk-control] blob store unavailable', error);
    return null;
  }
}

function normalizeCampusState(campus, state) {
  const base = defaultCampusState(campus);
  const source = state && typeof state === 'object' ? state : {};
  return {
    ...base,
    ...source,
    library: campus,
    theme: THEMES.has(source.theme) ? source.theme : base.theme,
  };
}

function normalizeState(state) {
  if (state && typeof state === 'object' && state.campuses) {
    return {
      campuses: {
        hallim: normalizeCampusState('hallim', state.campuses.hallim),
        bumin: normalizeCampusState('bumin', state.campuses.bumin),
      },
    };
  }

  const legacy = state && typeof state === 'object' ? state : {};
  return {
    campuses: {
      hallim: normalizeCampusState('hallim', legacy),
      bumin: normalizeCampusState('bumin', legacy),
    },
  };
}

async function readState(store) {
  if (!store) return { ...defaultState(), storageAvailable: false };

  const raw = await store.get(CONTROL_KEY);
  if (!raw) {
    return { ...defaultState(), storageAvailable: true };
  }

  try {
    return { ...normalizeState(JSON.parse(raw)), storageAvailable: true };
  } catch (_) {
    return {
      ...normalizeState({
        reloadVersion: String(raw || 'initial'),
        updatedAt: null,
      }),
      storageAvailable: true,
    };
  }
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch (_) {
    return {};
  }
}

function selectCampus(value) {
  return CAMPUSES.has(value) ? value : 'hallim';
}

function getRequestCampus(event, body) {
  const params = event.queryStringParameters || {};
  return selectCampus(params.campus || params.library || body.campus || body.library);
}

function clientState(fullState, campus, extra = {}) {
  return {
    ...fullState.campuses[campus],
    campus,
    library: campus,
    ...extra,
  };
}

function getRequestPin(event) {
  const headerPin = event.headers['x-admin-pin'] || event.headers['X-Admin-Pin'];
  if (headerPin) return String(headerPin);

  try {
    const body = JSON.parse(event.body || '{}');
    return String(body.pin || '');
  } catch (_) {
    return '';
  }
}

exports.handler = async function handler(event) {
  try {
    const store = await getStoreSafe(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const campus = getRequestCampus(event, body);

    if (event.httpMethod === 'GET') {
      const state = await readState(store);
      return json(200, clientState(state, campus, {
        storageAvailable: state.storageAvailable,
      }));
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed.' });
    }

    const adminPin = process.env.KIOSK_ADMIN_PIN;
    if (!adminPin) {
      return json(500, { error: 'Missing KIOSK_ADMIN_PIN environment variable.' });
    }

    if (getRequestPin(event) !== adminPin) {
      return json(401, { error: 'Invalid admin PIN.' });
    }

    const currentState = await readState(store);
    const action = String(body.action || 'reload');

    if (action === 'verify') {
      return json(200, clientState(currentState, campus, {
        authenticated: true,
        storageAvailable: Boolean(store),
      }));
    }

    if (!store) {
      return json(503, {
        error: 'Kiosk settings storage is unavailable.',
        message: 'Netlify Blobs 저장소를 사용할 수 없어 설정을 저장할 수 없습니다.',
      });
    }

    const now = new Date().toISOString();
    const nextState = normalizeState(currentState);
    const nextCampusState = {
      ...nextState.campuses[campus],
      updatedAt: now,
    };

    if (body.theme !== undefined) {
      if (!THEMES.has(body.theme)) return json(400, { error: 'Invalid theme.' });
      nextCampusState.theme = body.theme;
    }

    if (action === 'reload') {
      nextCampusState.reloadVersion = now;
    } else if (action !== 'settings') {
      return json(400, { error: 'Invalid action.' });
    }

    nextState.campuses[campus] = normalizeCampusState(campus, nextCampusState);

    await store.set(CONTROL_KEY, JSON.stringify(nextState));
    return json(200, clientState(nextState, campus));
  } catch (error) {
    console.error('[kiosk-control] unhandled error', error);
    return json(500, {
      error: 'Kiosk control failed.',
      message: error && error.message ? error.message : String(error),
    });
  }
};
