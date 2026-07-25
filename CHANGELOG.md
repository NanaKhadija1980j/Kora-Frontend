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
