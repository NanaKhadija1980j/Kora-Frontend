# [1.9.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.8.0...v1.9.0) (2026-07-29)


### Features

* Close i18n gaps across four locales with CI missing-key check ([154a2e5](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/154a2e568e15687a6f95cb99d05a21612622dfa6))
* commit Virtualize marketplace grid and add performance CI gate ([94b8239](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/94b8239aafec57f93e8e420957ef289d5d6b2b43))
* integrate Synaps KYC SDK, secondary escrow UX, gate funding, and dashboard widgets ([98e3cd5](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/98e3cd5c27c5a4a6ae64818bccb4f51726393f55)), closes [#487](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/487) [#488](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/488) [#490](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/490) [#491](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/491)
* **marketplace:** add comparison store persistence and shareable comparison urls ([0185e45](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/0185e45cbb2c624969d8e74598eaafa511e5a99e))
* **performance:** optimize marketplace with virtualized invoice grid ([#435](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/435)) ([1742780](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/1742780e9ca401bd011873e25f2be64eb33bed60))
* Polish theme toggle with system preference and FOUC prevention ([adc3485](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/adc3485248a0d1926584e8cad5bf713255e7525b))
* resolve issues [#472](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/472), [#469](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/469), [#465](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/465), and [#464](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/464) ([52f3686](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/52f3686e14dabee1a286c77f0352b8d041d658ad))
* **secondary-market:** build secondary market browse page with position filters ([195ab16](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/195ab16c8aac1b5656791d142afd99b8ab7d87a9))
* **secondary-market:** implement transfer_position soroban contract integration ([43a5a3c](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/43a5a3c64f6cc0262771033142693900b1177797))
* **soroban:** harden sequence manager for concurrent multi-tx flows ([634bdfe](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/634bdfe0e14def6d085b782da64f90f2e64caca6))
* **testing:** add ipfs upload and verification integration tests ([3c6d610](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/3c6d6101c15483773575e50ab56ad31effec692e))
* **testing:** build api route integration tests for auth and upload ([#476](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/476)) ([4cd481e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/4cd481e8eddc8928d9b951b466def3a73ddd7b8a))

# [1.8.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.7.0...v1.8.0) (2026-07-27)


### Features

* **analytics:** implement analytics date-range filter bar with query sync - Add 1y preset to DateRangePicker (7d/30d/90d/1y/YTD/All) - Add invalid range validation in custom date picker (from > to shows error) - Fix duplicate positionsQuery declaration that caused a compile error - Remove unused range/setRange state; filters.dateRange drives all slices - Persist custom date range (from/to) in URL search params and restore on load - sliceByRange covers 1y (full 12-month dataset) and handles unknown keys - filtersFromParams validates custom range and falls back to default if invalid Closes [#388](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/388) ([28252d3](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/28252d30297176ce3523bf92ffd831875cd149ec))
* invoice state machine refactor with transition buttons and cancel dialog tests ([5fc0a13](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/5fc0a13f054b13d80f0c878f13694aa4d3a68162))
* **invoice-lifecycle:** complete live createinvoice mint pipeline on testnet - Add infinite query key to queryKeys for marketplace cache invalidation - Add per-stage progress UI (IPFS pin vs on-chain mint) with stage indicators - Invalidate marketplace infinite/all cache after successful mint so new invoice appears immediately on /marketplace without manual refresh - Progress callbacks drive uploadStage state (ipfs → chain → done) Closes [#379](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/379) ([6a70e30](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/6a70e30286a0b606198ad190268d00acb7626565))
* **marketplace:** implement advanced marketplace filter persistence and deep linking - Import and render ActiveFilterChips below the search/sort bar when any filter is active — chips sync with URL via the existing Zustand↔URL loop - Clear-all on chips calls resetFilters() which zeroes the store; the debounced URL sync effect then strips all params from the address bar - Mobile bottom sheet already shares renderFiltersList() so all filter controls are at full parity between mobile and desktop Closes [#377](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/377) ([f7115e2](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f7115e20cc3433f4ee8b7df2eb965da91d51fdc2))

# [1.7.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.6.0...v1.7.0) (2026-07-27)


### Features

* add devtools coverage and runtime flags ([a47e123](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/a47e1237497da32029c3c3e2918d4b7ee10bd347))
* **analytics:** wire portfolio CSV/PDF export to live filtered positions ([7a6739e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/7a6739ea4907b1a0438c2330bb6347c8ddb76ab2)), closes [#387](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/387)
* **observability:** add query cache rules and performance workflow ([5c77fba](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/5c77fbae27aa79eb917ca2f11bee4eb164d9c131))
* **share:** canonical token-id deep links, post-mint CTA, PNG OG ([59d0a2e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/59d0a2ebcc146e3d73b9df67a6ad8cc5147190b6)), closes [#383](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/383)
* **sme:** enable batch cancel/repay with sequential tx queue ([cc784f6](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/cc784f6df9f01b33069ec28af0631e0a21bf44d0)), closes [#382](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/382)
* **tx:** add simulation preview to claim and map Soroban errors ([828ec3b](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/828ec3b3e55071fda95d983af9283c8fa0f0bd59)), closes [#385](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/385)

# [1.6.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.5.0...v1.6.0) (2026-07-26)


### Features

* **accessibility:** build shortcutreferencemodal with searchable shortcut list ([be65efe](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/be65efed0adf0b8ab24d41ee3632c08a65c93bc5)), closes [#480](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/480)
* **documentation:** add contributor quick-start guide for stellar wave participants ([ea85731](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/ea8573163d179099012bcf364ec7591775889e02)), closes [#482](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/482)
* **marketplace:** implement advanced marketplace filter persistence and deep linking ([4f01b60](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/4f01b604114c6da7244a1a901fb75abd58c717c7)), closes [#483](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/483)
* **ui:** implement data-table component for sme invoice management ([d0d250e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d0d250ec48a9ce88551143e51a5695b475bc962a)), closes [#481](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/481)

# [1.5.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.4.0...v1.5.0) (2026-07-26)


### Features

* **performance:** add web vitals regression gate in ci ([f8ca527](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f8ca5276c1e6ef74d2fb9e88d6c2fd703db4d67e))
* **performance:** optimize ipfs invoice svg previews for lcp ([9bcf251](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9bcf251f84fbe97c49ce23c2eeb1fc80154bbb32))
* **pwa:** audit pwa cache exclusions for wallet and tx routes ([55eac6f](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/55eac6f0142b28cda68cd2187df93c5c8b65158a))

# [1.4.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.3.0...v1.4.0) (2026-07-26)


### Bug Fixes

* **security:** bind upload pinning to cryptographically verified wallet session ([29481fc](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/29481fcac4928dbbc7b0abe9b2d79901912581e9))
* **security:** enforce CSRF verification on upload and vitals mutation routes ([83e8610](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/83e8610f7161ff556da40a6bdee81930eb9e796f))
* **security:** nonce-based script-src CSP and add mainnet RPC to connect-src ([9ce2149](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9ce2149ff61ee6055e264468a96b7a94bf29dc95))
* **security:** reject dangerous URL schemes in IPFS metadata sanitization ([69fdf92](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/69fdf92f332b4a1c0cb810731f373935dff39b04))


### Features

* **accessibility:** fix axe violations on analytics and transactions routes ([2e712ed](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/2e712ed627fd7586b1b7503deb7c000d10af4c1c))
* **ipfs:** migrate all pinata uploads to server-side api route ([16d58fd](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/16d58fda0246ed43967255ed88461abf0b7375da))
* **performance:** tune tanstack query stale times per network mode ([e2d9e62](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/e2d9e625414d44de42f91f8053e1f35456ef8551))

# [1.3.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.2.0...v1.3.0) (2026-07-26)


### Features

* **accessibility:** add screen-reader announcements for transaction toasts ([08b8b78](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/08b8b785f5f1097f92f84cd3aba76059d798990a)), closes [#441](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/441)
* **accessibility:** implement keyboard-navigable marketplace filter panel ([20ffd68](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/20ffd68a4a017b89f2da0f4f43ec60ce07f1a143)), closes [#440](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/440)
* add user-facing VirusTotal rejection reason parser for upload flow ([9e2f169](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9e2f169af1b4e52f36eb287dfb7d9159e830aad0))
* persist TanStack Query invoice cache to IndexedDB with stale/last-sync tracking ([a1da54e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/a1da54e70d06afad20c9d7c9b002264f1a41bc3f))
* queue signed XDR drafts in IndexedDB for offline resubmission ([9aea95e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9aea95ead2996ce86784a69c8d488d2463dc799a))
* **secondary-market:** design secondary market listing ui for invoice positions ([1e0777b](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/1e0777b3be38e476321db18b55e1d5b365a73a50)), closes [#442](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/442)
* **secondary-market:** implement transfer_position soroban contract integration ([aadcdd7](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/aadcdd77d3429355a72b62d34b42efa7057abe2d)), closes [#443](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/443)
* **soroban:** implement live invoice listing via soroban event indexer ([e9bb445](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/e9bb4450eb9a718530f14395822b860e75bdaf99))
* track InstallPrompt install/dismiss analytics with SME/investor cohorts ([12cc5e7](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/12cc5e756fe03423d4249ac2acafafdb8279a01b))
* **wallet:** complete wallet ownership verification challenge flow ([10a5229](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/10a5229040ad30ea2c8eeb531669ffb5b2ea5816))

# [1.2.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.1.0...v1.2.0) (2026-07-25)


### Bug Fixes

* resolve merge conflicts with upstream/main ([c5ac024](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c5ac02446ecb947822b1e593024cec31135d739f))


### Features

* add route-level code splitting ([#253](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/253)) and service worker static asset caching ([#255](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/255)) ([bab73ef](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/bab73efa5a9d41916c77dc430624e22a803fd9fd))
* implement marketplace virtual scrolling ([#251](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/251)) and add error boundary tests ([#250](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/250)) ([13752d5](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/13752d57914a4183b9f5922754128baebad7e1a0))
* systematic lazy loading for wallet kit, Recharts, Stellar SDK, and pdf export ([6340129](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/6340129d8e8b1e3da76d0571ec57ab36afd24eee))

# [1.1.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/compare/v1.0.0...v1.1.0) (2026-07-24)


### Features

* **ipfs:** resilient IPFS layer — gateway fallback, CID integrity, metadata versioning, Pinata degradation UX ([b08a796](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/b08a796cf5f49772c33a7887dd550960e443474d)), closes [#392](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/392) [#393](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/393) [#393](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/393) [#392](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/392) [#394](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/394)

# 1.0.0 (2026-07-24)


### Bug Fixes

* add pt-BR locale support and fix missing env/middleware references ([f9307ae](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f9307ae43dc16eb33978b50c57f28013e00eeaf4))
* **ci:** green CI gates for invoice SEO PR ([34d2662](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/34d2662507991dfb3581351b6e3e48bb5200ee00))
* **ci:** green CI gates for marketplace prefetch PR ([1530afb](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/1530afbb54094fcb074c19346bad0719e6e55c53))
* **ci:** green CI gates for portfolio allocation PR ([c25fd5c](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c25fd5c3d66580abd5834b240ba8cc7ded9a8bcb))
* **ci:** green CI gates for testnet USDC faucet PR ([9ec9f5f](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9ec9f5f06099c72998a6d5aeceadbdda6ed4906c))
* **ci:** repair print CSS escape and soften broken suite gates ([8236ae3](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8236ae35fcbc1b9256601c77c574c00734c18e01))
* **ci:** sync package.json next/axios with lockfile ([9e56eb6](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9e56eb6eaf8292dfab638470550af8651494a0ca))
* **ci:** unblock CI for marketplace prefetch PR ([5691679](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/5691679fcf991d845b05be5ae9a95d9001e9136d))
* **ci:** unblock CI for testnet USDC faucet PR ([3af28d6](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/3af28d646c403c9e0f1f448e0d1451500346bc43))
* **dashboard:** implement responsive multi-panel layout for SME and investor dashboards ([4062aac](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/4062aac73e9e018239ba4d97c533b1288e20763f))
* **dashboard:** memoize positionsData to clear exhaustive-deps lint warning ([c070a03](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c070a03f7bc29a1723f616c0fd0014f11499849b))
* make lint-staged type-check read tsconfig.json again ([64b51f7](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/64b51f73c429e1d37768e1983cc314e3a7a167fc))
* move themeColor to viewport export and fix JSX in translation calls ([495c102](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/495c102d13ef02a9dd4d214a160af90b73f71097))
* remove duplicate MOCK_INVOICES export, docs restructure  and convert forbidden next/dynamic ssr=false imports to client components ([35b851f](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/35b851f19d965c1c30f30564a14e672e78c01772))
* resolve all ESLint hook warnings — useMemo, useCallback, aria roles ([d844b60](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d844b60cb5d6f7e9dccb4321e5466f626f70fa18))
* resolve build errors — duplicate export, broken JSON, missing imports ([cca1341](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/cca1341036b8b3e56b2d15691f353824660effe4))
* resolve issue [#2](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/2) — improve invoice creation wizard UX flow ([2fc869c](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/2fc869c15fcb5be3348ae79049981dac6bc95ded))
* resolve issue [#3](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/3) — design marketplace listing and invoice detail pages ([331084d](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/331084ddbcf33bbde04f7f7eb3785aefdb17ac3d))
* resolve issues [#186](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/186), [#187](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/187), [#190](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/190), [#223](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/223) ([cf9e5b7](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/cf9e5b71a36e4643026ca9a05176a392ec27f2b1))
* resolve issues [#191](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/191) [#193](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/193) [#196](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/196) [#198](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/198) ([edba15a](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/edba15ac76d6233b7274c1a0d2168b614fa2344c))
* resolve issues [#212](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/212), [#214](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/214), [#216](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/216), [#218](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/218) ([45b223d](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/45b223d9c9e2c625fc4961879861c9f8d795e094))
* resolve upstream merge and type errors blocking production build ([f768625](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f768625443591a483a6685e1a10b0ae887c6b46f))
* resolve upstream merge and type errors blocking production build ([3d3e2cb](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/3d3e2cb08fc90eb3618365234d11096a0f844f54))
* resolve upstream merge and type errors blocking production build ([eae8f32](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/eae8f32516c638a760d9809bffdb32c352ed4ef8))
* resolve upstream merge and type errors blocking production build ([7bdc6dc](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/7bdc6dc31f367cdfbfbb62193da3f9c6b6ef38c6))
* stabilize CI unit and Playwright checks ([6643524](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/66435242c52c35d13648983d7ab76ab1ea5b7646))
* sync package-lock.json so npm ci succeeds in CI ([f20db5d](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f20db5dcd80c4c255085d4f66f42e1ef2e294578))
* unblock CI for invoice SEO PR ([8529b50](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8529b505c13b794fe9df84255159237e376cca35))
* use separate hook instances in prefetch concurrency test ([29cc1a8](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/29cc1a833ea5b11e92a3bbb1c7d3ee0516dceb94))


### Features

* add command palette (Cmd+K) and changelog modal ([4af3a8f](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/4af3a8ff9c0f2cbf17393fddf9479fa7c14cfb71)), closes [#117](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/117) [#114](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/114)
* add components ([834823b](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/834823b41df4a70820dfbcf391e3173734f2f96e))
* add environment variable validation on startup ([46ca764](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/46ca764ae740b273b4919c91a6a03d6cc077fd2c))
* add i18n (EN/ES) and transaction simulation preview ([8f8b19f](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8f8b19f0742fe29d806add72ed82809ab19517f6)), closes [#113](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/113) [#112](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/112) [#113](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/113) [#112](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/112)
* add invoice risk score gauge visualization ([658157a](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/658157a467565d3787b2c03647bcda115f191c2f))
* add invoice wizard E2E tests, WebVitals dev overlay shortcut, reduced-motion support, and Husky pre-commit hooks ([#230](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/230) [#231](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/231) [#295](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/295) [#297](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/297)) ([cc3f2b4](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/cc3f2b4ac8502f50d6e8e1c5c834156d15aa7558))
* add pt-BR locale, wallet session expiry, sanitizeInput, and env-driven resource hints ([c52ab46](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c52ab4620835dd5bfc8e08b41404efa6da84faa9)), closes [#292](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/292) [#267](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/267) [#261](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/261) [#260](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/260)
* add scripts/seed-testnet.ts for local testnet data seeding ([c6ca500](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c6ca500f35b9d959f1216b46c17f47616a9828f0)), closes [#310](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/310)
* add SEO routes, feature flags, Docker setup, and bundle size tracking ([2527a18](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/2527a1882bc8f9a026f2e9114f3e1b9c2ab0e724)), closes [#305](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/305) [#308](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/308) [#301](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/301) [#306](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/306)
* Add Snapshot Tests for All Storybook Stories ([4ec276d](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/4ec276da4b58512a58e243938942560fc2ea0ef5))
* add test coverage reporting to CI workflow ([10b0782](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/10b0782f090303a7e80cc32258cbc2982c39b368))
* add testnet contract configuration support ([0004a43](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/0004a43c5162cd92a9e8d566b5326ed2344d038b))
* add testnet funding via friendbot and faucet ([90202d9](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/90202d985a331b83ba275e499f6cfa54062a6a90))
* add wallet disconnect cleanup and confirmation ([68e04a8](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/68e04a860199d427df49728279c566103df43c02))
* add Web Vitals monitoring and portfolio composition donuts ([1367117](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/1367117ede0d9b5bef9f602498e25c754a91d809)), closes [#139](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/139) [#159](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/159)
* all issues resolved ([e87a5df](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/e87a5df2c04c0c70aa56b7afabf9d2221987698e))
* all task is resolved ([933fa64](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/933fa6462921cfcaf221ad7f5459b89059aed34f))
* **analytics:** add portfolio allocation breakdown from live positions ([d309d1d](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d309d1d73420d0ca7dd8da9be49f2632437d4099)), closes [#390](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/390)
* **api:** add Pinata proxy route with rate limiting, PDF validation, and optional VirusTotal; route IPFS uploads through API; update services ([c1d2a44](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c1d2a44fd24631d42aadf99e49b502a145146134))
* **auth:** add wallet ownership verification system ([aa13ad0](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/aa13ad0db3d85beb0ca88f6ccfa7d1bbbd46695e))
* Complete all 7 dashboard & onboarding features ([e8d06eb](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/e8d06eb93924ac0b83b4ac8cf5a4570e496b4f6e))
* CSRF protection, Navbar selector optimisation, Suspense boundaries, SVG single-pass ([17ccf46](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/17ccf460deda90a05ef468e8777f3df8504cb7f9)), closes [#265](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/265) [#259](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/259) [#258](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/258) [#256](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/256)
* **dashboard:** add skeleton loading states to investor dashboard ([4ef9747](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/4ef97478233535c0709d0dd5232b4a2a8db5cd52)), closes [#207](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/207)
* EmptyState variants, comparison wiring, settings persistence, flag icons ([01c989d](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/01c989d870155a526d18e1bebd8929a2ada6a105))
* enhance accessibility and i18n support with focus traps, validation messages, ([ca11d48](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/ca11d481598908edabcec9744a9615dd909fb4a5))
* env validation, upload signing, error boundaries, X-Request-ID ([#269](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/269) [#275](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/275) [#276](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/276) [#277](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/277)) ([bc53379](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/bc5337908806b52debe69aee3e497e5ed6d6faac))
* feedback widget and global keyboard shortcuts ([fbf4ae3](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/fbf4ae3aa44828ba249fa5842cf9b0fce9de7f6b)), closes [#115](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/115) [#116](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/116)
* **frontend:** improve investor discovery flows ([34c4fdf](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/34c4fdff19c00f133aaccbf3ffe4001286149d98))
* **hero:** add animated landing page hero and live stats ([255c5bb](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/255c5bbcede3d673c1d39d09da117dc6084703bb))
* Implement 4 frontend issues simultaneously ([5d2582f](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/5d2582f41ab00d5b231789078ed4da8206032d08)), closes [#143](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/143) [#129](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/129) [#146](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/146) [#142](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/142) [#143](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/143) [#129](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/129) [#146](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/146) [#142](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/142)
* implement issues [#192](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/192), [#194](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/194), [#195](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/195), [#202](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/202) ([e78c280](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/e78c280eb732ef8ad66c3f61ea9963996d7368ec))
* implement notification preferences settings ([#122](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/122)) ([ef4a7f5](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/ef4a7f55ea8c23842a3640eb3fc0c82d4ba95143))
* implement SME/Investor dashboards, analytics CSV & wallet flows ([9df88cd](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/9df88cdf9900bbd306a727800f03814617685ccd))
* Implement VerificationProvider wallet signature challenge ([d3c5ee4](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d3c5ee4c7f06454a61853ea1cd93a5c1e5171810))
* implement wallet modal, copy utility, funding progress bar, and marketplace search ([#45](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/45) [#47](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/47) [#29](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/29) [#49](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/49)) ([8bb7189](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8bb7189a16d7e3975b23abd97817f861db02b297))
* improve accessibility, storage resilience, and transaction history ([d03ab0e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d03ab0ebe8b8462855c5c8ba220289e92689c82e))
* integrate yield calculator, batch toolbar, filter chips, PWA install prompt ([a5d0764](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/a5d0764eb8b0b207cfcf1d73d238cefe19c7b6a2))
* investor yield claim flow ([#61](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/61)) and debounce/throttle hooks ([#68](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/68)) ([5216e7c](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/5216e7c8a323ecf61805d52fcd2a839127f6035f))
* invoice NFT metadata v1 schema + Lighthouse optimization ([c63bbba](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c63bbba2ceb69a98b4b3462354e477ba07e574d4)), closes [#121](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/121) [#125](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/125)
* **invoice:** implement step 3 wizard with file validation, IPFS uploads, and minting status ([d6d673e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d6d673e0ed8103d4c1b8300e4eb43e8c47db94d8))
* **invoice:** implement wizard step 2 financing terms form & live preview. Closes [#13](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/13) ([b635555](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/b6355554a50b737dd44e0ce224f3d8de9dee8f12))
* Kora Protocol on-chain invoice financing frontend ([7f46caf](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/7f46cafbb5995d2ff36654c4187cee2457104659))
* kora-frontend issues is done ([f25e760](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f25e760d8ba6f1f9cfefab1ee56f704b44015c0a))
* **marketplace:** add marketplace prefetch strategy for invoice detail navigation ([44ce5bd](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/44ce5bd12d6016c3ae7e3db756270a7ca6854e7e)), closes [#378](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/378)
* **marketplace:** build server-side SEO for invoice detail pages ([eb762bc](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/eb762bcc502a030d736ca78610417d8a9050ebf3)), closes [#375](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/375)
* **marketplace:** enable invoice comparison feature behind feature flag ([64d9964](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/64d9964d49095e88c292465bb2060fc2cbb93dee)), closes [#373](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/373)
* **marketplace:** implement core filters, skeleton loading, and url sync ([d795ddc](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/d795ddc2a2277970076eb480fecae386531610bd))
* **marketplace:** implement marketplace infinite scroll with indexer pagination ([8d76e3a](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8d76e3a3fca5461909d57a407629c75d7fe262af)), closes [#374](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/374)
* **marketplace:** integrate invoice detail page and mock transaction pipeline ([25f33b6](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/25f33b6bb9af49fff25024815b413858ebb987fd)), closes [#16](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/16)
* optimize wallet logos, dynamic OG tags, structured API logging, and semantic release ([8a0c41c](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8a0c41c3d34adab66576ad677152e41efe53dd6f))
* **perf:** image optimization, asset pipeline, and wallet SVG logos ([484a075](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/484a075420900a48dd87e81ec5e3f8302db46574))
* route-based code splitting, responsive marketplace mobile UX, optimistic invoice funding, and system dark mode support ([a708422](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/a708422ec9c3d12066ee32ecaf9cfe1d4f210bfb))
* search invoices in command palette by debtor, token ID, or amount ([c1e0631](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/c1e06316637e6bec653a8f873f2df57d3281c174)), closes [#213](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/213)
* set up Playwright component testing for key UI primitives ([#249](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/249)) ([8224b98](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/8224b983fba3160a3ecda04c7c4b80ed9e4d6638))
* Soroban contract event subscription + invoice comparison ([#119](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/119), [#120](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/120)) ([5e20f95](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/5e20f950954ef1504a6d7822bd85e258877254bf))
* **soroban:** replace contract event polling with streaming subscription ([e372994](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/e3729942ecf74b3d5c47572e03214dc8625b32fc)), closes [#368](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/368)
* stabilize production build and harden validations ([aef4a6e](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/aef4a6e357098be2b8cf1a604e4affa042f42cd9))
* tooltip component, print/export, and advanced analytics filters ([66dac25](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/66dac25cdcad75d2c7b05aecfa812f8f24cba661))
* transaction lifecycle, IPFS progress, invoice store, and query hooks ([f74a851](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/f74a85174e0cd93bb39892951efb221a6fb32c98))
* type-safe contract client, responsive navbar, GlassCard, and RiskBadge components ([ee9f378](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/ee9f378ad0056ad633edecda6d241ec457127f11))
* **wallet:** add testnet USDC faucet flow for investor onboarding ([b8cd7c5](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/b8cd7c5657110bc436057c752f4fd02d423dacb0)), closes [#371](https://github.com/OpenLedger-Foundation/Kora-Frontend/issues/371)
* **wallet:** implement wallet session re-establishment after page refresh ([3ac4c43](https://github.com/OpenLedger-Foundation/Kora-Frontend/commit/3ac4c4309891a2253ca25a63f34e4ab3ebc408b7))

# Changelog

All notable changes to this project will be documented in this file.

This file is generated with
[standard-version](https://github.com/conventional-changelog/standard-version)
from Conventional Commits.

## [0.1.0](https://github.com/OpenLedger-Foundation/Kora-Frontend/releases/tag/v0.1.0) (2026-05-18)

### Features

- add address book for saved Stellar addresses
- add analytics page with charts and portfolio metrics
- add changelog modal with version tracking and formatted release notes
- add command palette with invoice search, page navigation, and action commands
- add dark, light, and system theme support
- add footer with version display and changelog link
- add initial public scaffold of the Kora-Frontend repository
- add investor dashboard with position tracking and yield projections
- add invoice creation flow with IPFS document upload
- add invoice marketplace with filtering, sorting, and search
- add onboarding tour for new users
- add on-chain invoice funding and repayment via Soroban smart contracts
- add PWA support with offline page and install prompt
- add SME dashboard for managing tokenized invoices
- add transaction history with full lifecycle tracking
- add wallet integration via Stellar Wallets Kit
