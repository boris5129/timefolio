# REST API

기본 경로 /api. 변경 요청에는 GET /auth/csrf가 돌려준 header와 token이 필요하다. 인증 성공 또는 로그아웃 후 토큰을 다시 조회한다. 실패 형식은 { "message": "한국어 오류" }이다. 인증 필요 401, 권한/CSRF 403, 없는 사용자 소유 데이터 404, 중복/참조 충돌 409, 잘못된 입력 400.

| 메서드 및 경로 | 본문 또는 쿼리 | 정상 응답 |
|---|---|---|
| GET /auth/csrf | | 200 {header,token} |
| POST /auth/register | email,password | 201 |
| POST /auth/login | email,password | 200 {email} |
| GET /auth/me | | 200 {email} |
| POST /auth/logout | | 204 |
| GET /categories | | 200 목록 |
| POST /categories | name,color,icon | 201 카테고리 |
| PUT /categories/{id} | name,color,icon | 200 카테고리 |
| DELETE /categories/{id} | | 204 |
| GET /entries?date=YYYY-MM-DD | | 200 날짜 요약 및 활동 목록 |
| GET /entries/recent | | 200 최근 활동 |
| POST /entries | title,categoryId,start,end,kind,memo | 201 활동 |
| PUT /entries/{id} | 동일 | 200 활동 |
| DELETE /entries/{id} | | 204 |
| POST /entries/copy | date | 200 {created} |

start/end는 사용자 시간대의 ISO 분 시각이다. kind는 ACTUAL 또는 PLANNED이다. 후속 단계에서 반복, 확보, 중첩, 목표, 재투자, 추천, 시뮬레이션, 통계, 설정, 백업 엔드포인트를 해당 단계의 스키마와 함께 확정한다.
