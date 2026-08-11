# Google 로그인 설정

애플리케이션은 Google OAuth 2.0 Authorization Code Flow만 사용합니다. 별도 회원가입,
비밀번호 로그인, 관리자 이메일 허용 목록은 없습니다. Google 인증에 처음 성공한 사용자는
`users`에 자동 생성됩니다.

## Google Cloud Console

1. Google Cloud Console에서 프로젝트를 선택하거나 생성합니다.
2. Google Auth Platform의 동의 화면을 구성합니다.
3. OAuth Client에서 **웹 애플리케이션** 클라이언트를 생성합니다.
4. 승인된 리디렉션 URI에 아래 주소를 정확히 등록합니다.

```text
https://yang-sisters-adventure.higwon2.workers.dev/api/auth/google/callback
```

로컬 테스트가 필요하면 사용하는 로컬 주소의 동일 경로도 별도로 등록합니다.

## Cloudflare Secret

발급된 값을 GitHub, `wrangler.jsonc`, `.env` 파일에 커밋하지 않습니다. Cloudflare Worker의
Settings > Variables and Secrets에서 다음 두 값을 **Secret**으로 등록합니다.

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Secret을 등록한 뒤 Worker를 다시 배포해야 새 설정이 적용됩니다. 설정 전에는 로그인 버튼을
눌렀을 때 로그인 화면에 "Google 로그인이 아직 설정되지 않았습니다."가 표시됩니다.

## 접근 범위

Google 로그인이 성공하면 서비스 사용자 계정은 자동 생성되지만, 기존 여행 데이터 접근 권한은
자동으로 생기지 않습니다. 여행 접근은 계속 `trip_members`로 검사합니다. 여행 생성과 초대 흐름은
별도 이슈에서 구현합니다.
