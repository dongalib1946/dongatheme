const pin = document.getElementById('pin');
const loginBtn = document.getElementById('loginBtn');
const saveBtn = document.getElementById('saveBtn');
const reloadBtn = document.getElementById('reloadBtn');
const statusEl = document.getElementById('status');
const ADMIN_CAMPUS = (() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('campus') || params.get('library');
  if(requested === 'bumin') return 'bumin';
  return window.location.pathname.toLowerCase().includes('bumin') ? 'bumin' : 'hallim';
})();
const ADMIN_LABELS = {
  hallim: '한림도서관',
  bumin: '부민도서관',
};

let authenticated = false;

function applyAdminPageChrome(){
  const label = ADMIN_LABELS[ADMIN_CAMPUS] || ADMIN_LABELS.hallim;
  const title = `${label} 키오스크 원격 제어`;
  document.title = title;

  const heading = document.querySelector('h1');
  if(heading) heading.textContent = title;

  const homeLink = document.querySelector('.home-link');
  if(homeLink){
    homeLink.href = ADMIN_CAMPUS === 'bumin' ? 'bumin.html' : 'index.html';
    homeLink.setAttribute('aria-label', `${label} 키오스크 홈으로 돌아가기`);
  }
}

function setStatus(text, type = ''){
  statusEl.textContent = text;
  statusEl.className = `status ${type ? `is-${type}` : ''}`;
}

function setControlsEnabled(enabled){
  authenticated = enabled;
  saveBtn.disabled = !enabled;
  reloadBtn.disabled = !enabled;
}

function selectedValue(name){
  return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
}

function setSelectedValue(name, value){
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if(el) el.checked = true;
}

function applyState(data){
  setSelectedValue('theme', data.theme || 'navy-glass');
}

function requirePin(){
  const adminPin = pin.value.trim();
  if(!adminPin){
    setStatus('관리자 PIN을 입력해주세요.', 'error');
    pin.focus();
    return '';
  }
  return adminPin;
}

function friendlyError(data, fallback){
  if(data?.message) return data.message;
  if(data?.error === 'Missing KIOSK_ADMIN_PIN environment variable.'){
    return 'Netlify 환경변수 KIOSK_ADMIN_PIN이 아직 등록되지 않았습니다.';
  }
  if(data?.error === 'Invalid admin PIN.'){
    return '관리자 PIN이 올바르지 않습니다.';
  }
  return data?.error || fallback;
}

async function postControl(payload, busyText, { requireLogin = true } = {}){
  const adminPin = requirePin();
  if(!adminPin) return null;
  if(requireLogin && !authenticated){
    setStatus('먼저 로그인해주세요.', 'error');
    return null;
  }

  loginBtn.disabled = true;
  saveBtn.disabled = true;
  reloadBtn.disabled = true;
  setStatus(busyText);

  try{
    const res = await fetch('/.netlify/functions/kiosk-control', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-pin': adminPin,
      },
      body: JSON.stringify({ pin: adminPin, campus: ADMIN_CAMPUS, ...payload }),
    });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok) throw new Error(friendlyError(data, `요청 실패: ${res.status}`));
    return data;
  }catch(err){
    setStatus(err.message || '요청 처리에 실패했습니다.', 'error');
    return null;
  }finally{
    loginBtn.disabled = false;
    setControlsEnabled(authenticated);
  }
}

loginBtn.addEventListener('click', async ()=>{
  const data = await postControl({ action: 'verify' }, '관리자 PIN을 확인하는 중입니다...', { requireLogin: false });
  if(!data) return;

  applyState(data);
  setControlsEnabled(data.storageAvailable !== false);

  const storageText = data.storageAvailable === false
    ? ' PIN은 확인됐지만 설정 저장소 연결이 필요합니다.'
    : '';
  setStatus(`로그인되었습니다. 현재 설정을 불러왔습니다.${storageText}`, data.storageAvailable === false ? 'error' : 'ok');
});

pin.addEventListener('keydown', (event)=>{
  if(event.key === 'Enter') loginBtn.click();
});

saveBtn.addEventListener('click', async ()=>{
  const data = await postControl({
    action: 'settings',
    theme: selectedValue('theme'),
  }, '설정을 저장하는 중입니다...');
  if(!data) return;

  applyState(data);
  setStatus(`설정을 저장했습니다. (${ADMIN_LABELS[ADMIN_CAMPUS]}, ${data.theme})`, 'ok');
});

reloadBtn.addEventListener('click', async ()=>{
  const data = await postControl({ action: 'reload' }, '새로고침 신호를 보내는 중입니다...');
  if(!data) return;

  const time = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString('ko-KR')
    : new Date().toLocaleString('ko-KR');
  setStatus(`새로고침 신호를 보냈습니다. (${time})`, 'ok');
});

setControlsEnabled(false);
applyAdminPageChrome();
setStatus(`${ADMIN_LABELS[ADMIN_CAMPUS]} 관리자 PIN 입력 후 로그인해주세요.`);
