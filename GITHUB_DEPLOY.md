# GitHub Pages 배포 메모

## 1. GitHub Actions secrets 등록

저장소 `dongalib1946/dongatheme`에서 아래 순서로 등록합니다.

1. `Settings`로 이동
2. 왼쪽 메뉴 `Secrets and variables` -> `Actions` 선택
3. `New repository secret` 클릭
4. `Name`과 `Secret` 값을 입력한 뒤 저장

등록할 값:

- `ALADIN_TTB_KEY`: 알라딘 Open API 키입니다. GitHub Actions가 배포할 때 `data/aladin-books.json`을 생성하는 데 사용합니다.
- `KIOSK_ADMIN_PIN`: GitHub Pages만 사용할 때는 브라우저에서 안전하게 검증할 서버가 없으므로 런타임에는 사용되지 않습니다. 나중에 Netlify/Vercel/Cloudflare Functions 같은 서버리스 기능을 다시 붙일 경우 같은 이름으로 사용합니다.
- `GOOGLE_API_KEY`: Google Drive 포스터 목록을 `data/posters.json`으로 생성하는 데 사용합니다. API 키의 HTTP referrer 제한에는 `https://dongalib1946.github.io/*`를 추가하세요.

비밀키는 HTML이나 JS 파일에 직접 넣지 마세요. 공개 저장소와 GitHub Pages에서는 그대로 노출됩니다.

## 2. GitHub Pages 설정

1. 저장소 `Settings` -> `Pages`로 이동
2. `Build and deployment`의 `Source`를 `GitHub Actions`로 선택
3. `Actions` 탭에서 `Deploy to GitHub Pages` 워크플로가 성공하는지 확인

배포 주소는 보통 아래 형식입니다.

```text
https://dongalib1946.github.io/dongatheme/
```

## 3. 키오스크 제어

GitHub Pages는 서버 코드를 실행하지 못하므로 기존 관리자 페이지의 PIN 검증/저장 API는 동작하지 않습니다.

대신 `Actions` 탭에서 `Update kiosk control` 워크플로를 수동 실행하면 `kiosk-control.json`이 갱신되고, 이어서 Pages가 다시 배포됩니다.

- `campus`: `hallim` 또는 `bumin`
- `theme`: 적용할 테마, 바꾸지 않으려면 `keep`
- `reload`: 키오스크 새로고침 신호를 보낼지 여부

GitHub Pages 재배포가 끝난 뒤 키오스크 화면에 반영됩니다.
