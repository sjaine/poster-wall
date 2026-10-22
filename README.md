# Poster Wall

포스터를 실제 인쇄 비율의 목업에 올려 미리보는 사이트. 배포 후에는 코드를 고치지 않고 사이트에서 모든 걸 관리해요.

- **방문자**: 로그인 없이 포스터를 보고, 사이즈를 바꿔볼 수 있어요 (본인 브라우저에만 저장).
- **관리자(나)**: 하단 `Admin` → 비밀번호로 로그인하면 포스터 추가(드래그 앤 드롭·붙여넣기·`+ Add`), 삭제(× 두 번), 기본 사이즈 저장이 가능해요. 저장한 사이즈는 모든 방문자의 기본값이 돼요.

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 올리고 Vercel에서 **Import** 해요.
2. 프로젝트의 **Storage → Create → Blob** 으로 스토어를 만들어요.
   - 접근 방식은 **Public** 을 선택해야 해요 (포스터 이미지를 누구나 볼 수 있어야 하니까요).
   - 연결하면 `BLOB_READ_WRITE_TOKEN` 환경변수가 자동으로 추가돼요.
3. **Settings → Environment Variables** 에 `ADMIN_PASSWORD` 를 추가해요 (길고 추측하기 어려운 값으로).
4. **Redeploy** 하면 끝이에요.

비밀번호를 바꾸면 기존 로그인은 모두 풀려요.

## 로컬 실행

```bash
npm install
vercel link && vercel env pull   # BLOB_READ_WRITE_TOKEN 가져오기 (Blob 연결 시 Development 환경 포함)
echo "ADMIN_PASSWORD=원하는비밀번호" >> .env.local
npm run dev
```

## 구조

| 경로 | 역할 |
| --- | --- |
| `app/PosterWall.tsx` | 화면 전체 (사이즈 설정, 목업, 미리보기 줄, 로그인) |
| `app/globals.css` | 스타일 (라이트/다크 자동) |
| `lib/store.ts` | Vercel Blob 읽기·쓰기 |
| `lib/auth.ts` | 관리자 비밀번호·쿠키 |
| `app/api/*` | 업로드, 삭제, 사이즈 저장, 로그인 |

데이터베이스 없이 Vercel Blob 하나만 써요. 포스터 이름·픽셀 크기·업로드 시각은 파일 경로에 담겨 있고, 기본 사이즈도 `settings/` 아래 작은 파일 하나로 저장돼요. 이미지 한 장은 50MB까지 올릴 수 있어요 (JPG, PNG, WebP, GIF, AVIF).
