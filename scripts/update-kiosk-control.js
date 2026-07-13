const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTROL_FILE = path.join(ROOT, 'kiosk-control.json');
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

function normalizeCampusState(campus, state = {}) {
  const base = defaultCampusState(campus);
  return {
    ...base,
    ...state,
    library: campus,
    theme: THEMES.has(state.theme) ? state.theme : base.theme,
  };
}

function normalizeState(state = {}) {
  if (state.campuses) {
    return {
      campuses: {
        hallim: normalizeCampusState('hallim', state.campuses.hallim),
        bumin: normalizeCampusState('bumin', state.campuses.bumin),
      },
    };
  }

  return {
    campuses: {
      hallim: normalizeCampusState('hallim', state),
      bumin: normalizeCampusState('bumin', state),
    },
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await fs.readFile(CONTROL_FILE, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return normalizeState();
    throw error;
  }
}

async function main() {
  const campus = process.env.KIOSK_CAMPUS || 'hallim';
  const theme = process.env.KIOSK_THEME || 'keep';
  const shouldReload = process.env.KIOSK_RELOAD === 'true';

  if (!CAMPUSES.has(campus)) throw new Error(`Invalid KIOSK_CAMPUS: ${campus}`);
  if (theme !== 'keep' && !THEMES.has(theme)) throw new Error(`Invalid KIOSK_THEME: ${theme}`);

  const state = await readState();
  const now = new Date().toISOString();
  const nextCampusState = {
    ...state.campuses[campus],
    updatedAt: now,
  };

  if (theme !== 'keep') nextCampusState.theme = theme;
  if (shouldReload) nextCampusState.reloadVersion = now;

  state.campuses[campus] = normalizeCampusState(campus, nextCampusState);
  await fs.writeFile(CONTROL_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(`Updated kiosk-control.json for ${campus}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
