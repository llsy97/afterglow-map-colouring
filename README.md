# 여행 색칠공부 · Travel Light Map

다녀온 곳을 지도 위에 "밝혀서" 기록하는 앱. 밤 모드에서는 불이 켜지고, 낮 모드에서는 햇살이 든다.
오래 머문 곳일수록 더 밝고, 같은 곳을 여러 번 가면 여행마다 따로 기록하며 사진을 3장씩 남긴다.
한국어 / English, 모바일 웹(PWA) · 데스크톱 웹 · Android 앱(Capacitor).

- 서버 없이 브라우저에서만 동작 (기록은 localStorage, 사진은 IndexedDB)
- 249개 나라·영토, 212개 나라의 주·도, 157개 나라의 시·군 단위, 한국은 읍·면·동까지
- 포스터 PNG 내보내기, 백업(JSON + 사진 zip) 내보내기·가져오기

## 실행

```bash
npm install
npm run dev        # http://localhost:5173  (폰에서는 같은 Wi-Fi의 http://<PC-IP>:5173)
npm run build      # dist/ (PWA, 오프라인 지원)
npm run preview
```

## Android APK

```bash
npm run build
npx cap sync android
cd android
# JDK 21(Android Studio의 jbr 등) 필요, Android SDK 36
./gradlew assembleDebug      # → android/app/build/outputs/apk/debug/app-debug.apk
```

> Windows에서 경로에 한글이 있으면(예: `바탕 화면`) Gradle이 빌드를 거부한다. `android/`와 `node_modules/@capacitor/`를
> 영문 경로(예: `C:	lm-build`)로 복사해서 거기서 빌드하고, `android/local.properties`에는
> `sdk.dir=C:/Users/<이름>/AppData/Local/Android/Sdk` 처럼 슬래시 경로를 쓴다.

사진/백업 저장은 앱에서 시스템 공유 창(파일에 저장, 드라이브, 갤러리 …)으로 처리한다.

## 지도 데이터 다시 만들기

데이터는 `public/maps/`에 들어 있고, 아래 스크립트가 만든다 (이 순서로, 처음 실행하면 원본을 `scripts/.cache`에 받는다).

```bash
node scripts/build-admin1.mjs         # Natural Earth admin-1 → public/maps/admin1/<ISO3>.json
node scripts/build-admin2.mjs         # geoBoundaries ADM2    → public/maps/admin2/<ISO3>.json
node scripts/build-world.mjs          # 나라·영토 윤곽        → public/maps/world.json, country/*.json
node scripts/build-world-states.mjs   # 세계 탭 주·도 보기    → public/maps/world-states.json
```

나라 이름(한국어/영어)은 `src/lib/countryNames.ts`에서 직접 관리한다.

## 지도 데이터 출처

- [Natural Earth](https://www.naturalearthdata.com/) (퍼블릭 도메인) — 나라 윤곽, 1단계 행정구역
- [geoBoundaries](https://www.geoboundaries.org/) — 2단계(시·군) 경계. CC BY 4.0 등 나라별 라이선스 (OpenStreetMap 기여자 포함)
- 통계청 KOSTAT 2018 ([southkorea/southkorea-maps](https://github.com/southkorea/southkorea-maps)) — 한국 시·도, 시·군·구, 읍·면·동
- [SUIT](https://github.com/sun-typeface/SUIT) 글꼴 (OFL)
