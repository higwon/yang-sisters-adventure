# Yang Sisters Adventure

여러 여행 멤버가 보홀 여행의 일정, 장소, 준비물, 비용과 예약 정보를 한곳에서 관리하는 반응형 협업 앱입니다. 포함된 Bohol Trip 데이터는 UI 확인을 위한 샘플입니다.

## 기술 스택

- React 19, TypeScript strict, Vite
- Cloudflare Workers, Hono, Zod
- Cloudflare D1 (SQLite), Wrangler
- CSS 기반 반응형 UI, Lucide 아이콘
- Vitest, ESLint

## 구조

```text
src/                 React UI, API client, domain/settlement logic
worker/index.ts      같은 배포 단위의 Hono REST API
migrations/          D1 schema, indexes, development seed
wrangler.jsonc       Worker, Assets, D1 binding
```

브라우저는 `/api/*`를 호출하고 Worker가 D1을 조회·변경합니다. 사용자와 여행은 `trip_members`로 연결되며 현재 UI만 Bohol Trip(id 1)에 집중합니다. 날짜는 DB에 `YYYY-MM-DD`, 시간은 해당 여행 timezone의 `HH:mm` 로컬 벽시계 값으로 저장합니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Vite 개발 서버가 React, Worker API와 로컬 D1을 함께 실행합니다. `.wrangler/state`의 로컬 DB에는 migration의 샘플 데이터가 입력됩니다.

## Cloudflare / D1 설정

```bash
npx wrangler login
npx wrangler d1 create yang-sisters-adventure
```

출력된 `database_id`를 `wrangler.jsonc`의 `REPLACE_WITH_YOUR_D1_DATABASE_ID`와 교체합니다. 원격 DB에 migration을 적용합니다.

```bash
npm run db:migrate:remote
```

현재 필수 비밀 환경변수는 없습니다. 향후 인증을 붙일 때 로컬 비밀은 커밋하지 않는 `.dev.vars`, 운영 비밀은 `npx wrangler secret put NAME`으로 관리하세요. 여권·카드 번호 같은 민감정보는 저장하지 마세요.

## 검증과 배포

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run deploy
```

`npm run deploy`는 빌드 후 Worker, 정적 assets와 D1 binding을 Cloudflare에 배포합니다. 최초 배포 전 원격 migration을 먼저 적용해야 합니다.

## 현재 범위

홈 요약, 날짜별 일정 조회, 장소·준비·비용·예약 추가, 체크 완료 변경, KRW/PHP별 균등 비용 분할 및 정산 미리보기를 제공합니다. 일정 편집, 세부 참여 비율 편집, 실제 로그인/권한 검사, 환율·지도 API, 여러 여행을 선택하는 UI는 다음 단계입니다.
