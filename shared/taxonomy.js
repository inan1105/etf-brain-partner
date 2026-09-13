// ── ETF 브레인 파트너 · 분류 체계 (서버/클라이언트 공용) ──
// 금융위 getEtfPriceInfo 는 종목코드·종목명·기초지수명·시세만 제공하고
// 섹터/자산군/테마/전략 분류는 제공하지 않는다.
// 따라서 종목명과 기초지수명에서 규칙으로 추론한다.
// 규칙은 위에서 아래로 평가하며, 한 종목이 여러 태그를 가질 수 있다.

/** 운용사 브랜드 → 운용사명 (2024 리브랜딩 반영) */
export const BRANDS = [
  ['KODEX', '삼성자산운용'],
  ['TIGER', '미래에셋자산운용'],
  ['RISE', 'KB자산운용'],
  ['KBSTAR', 'KB자산운용'], // 2024.10 RISE 로 변경, 구명칭 병기
  ['PLUS', '한화자산운용'],
  ['ARIRANG', '한화자산운용'], // 2024.10 PLUS 로 변경
  ['ACE', '한국투자신탁운용'],
  ['KINDEX', '한국투자신탁운용'], // 구 브랜드
  ['HANARO', 'NH아문디자산운용'],
  ['KOSEF', '키움투자자산운용'],
  ['히어로즈', '키움투자자산운용'],
  ['SOL', '신한자산운용'],
  ['TIMEFOLIO', '타임폴리오자산운용'],
  ['WOORI', '우리자산운용'],
  ['WON', '우리자산운용'],
  ['1Q', '하나자산운용'],
  ['BNK', 'BNK자산운용'],
  ['FOCUS', '브이아이자산운용'],
  ['마이다스', '마이다스에셋자산운용'],
  ['에셋플러스', '에셋플러스자산운용'],
  ['파워', '교보악사자산운용'],
  ['미래에셋', '미래에셋자산운용'],
  ['삼성', '삼성자산운용'],
  ['트루프렌드', '한국투자신탁운용'],
  ['UNICORN', '현대자산운용'],
  ['현대', '현대자산운용'],
  ['대신343', '대신자산운용'],
  ['유리', '유리자산운용'],
  ['DAISHIN', '대신자산운용']
]

/** 해외 상장 ETF 운용사 (심볼 기반) */
export const US_ISSUERS = {
  SPY: 'State Street (SPDR)', VOO: 'Vanguard', IVV: 'BlackRock (iShares)',
  QQQ: 'Invesco', QQQM: 'Invesco', SCHD: 'Charles Schwab', JEPI: 'J.P. Morgan',
  JEPQ: 'J.P. Morgan', VTI: 'Vanguard', VT: 'Vanguard', VEA: 'Vanguard',
  VWO: 'Vanguard', AGG: 'BlackRock (iShares)', BND: 'Vanguard',
  TLT: 'BlackRock (iShares)', IEF: 'BlackRock (iShares)', SHY: 'BlackRock (iShares)',
  GLD: 'State Street (SPDR)', IAU: 'BlackRock (iShares)', SLV: 'BlackRock (iShares)',
  SOXX: 'BlackRock (iShares)', SMH: 'VanEck', XLK: 'State Street (SPDR)',
  XLF: 'State Street (SPDR)', XLE: 'State Street (SPDR)', XLV: 'State Street (SPDR)',
  XLI: 'State Street (SPDR)', XLY: 'State Street (SPDR)', XLP: 'State Street (SPDR)',
  XLU: 'State Street (SPDR)', XLB: 'State Street (SPDR)', XLRE: 'State Street (SPDR)',
  XLC: 'State Street (SPDR)', ARKK: 'ARK Invest', IWM: 'BlackRock (iShares)',
  DIA: 'State Street (SPDR)', EFA: 'BlackRock (iShares)', EEM: 'BlackRock (iShares)',
  VNQ: 'Vanguard', VIG: 'Vanguard', VYM: 'Vanguard', DGRO: 'BlackRock (iShares)',
  QUAL: 'BlackRock (iShares)', MTUM: 'BlackRock (iShares)', USMV: 'BlackRock (iShares)',
  TQQQ: 'ProShares', SQQQ: 'ProShares', SOXL: 'Direxion', SOXS: 'Direxion',
  TMF: 'Direxion', UPRO: 'ProShares', SPXL: 'Direxion', BITO: 'ProShares',
  IBIT: 'BlackRock (iShares)', FBTC: 'Fidelity', URA: 'Global X', NLR: 'VanEck',
  ITA: 'BlackRock (iShares)', PPA: 'Invesco', ICLN: 'BlackRock (iShares)',
  TAN: 'Invesco', LIT: 'Global X', BOTZ: 'Global X', ROBO: 'ROBO Global',
  IGV: 'BlackRock (iShares)', SKYY: 'First Trust', CIBR: 'First Trust',
  HACK: 'Amplify', MAGS: 'Roundhill', QYLD: 'Global X', RYLD: 'Global X',
  XYLD: 'Global X', DIVO: 'Amplify', SPHD: 'Invesco', NOBL: 'ProShares',
  SDY: 'State Street (SPDR)', RSP: 'Invesco', MOAT: 'VanEck', COWZ: 'Pacer'
}

// ────────────────────────────────────────────────────────────
// 규칙 정의
// pattern: 종목명 + 기초지수명 을 합친 문자열에 대해 검사
// ────────────────────────────────────────────────────────────

const rule = (tag, pattern, opts = {}) => ({ tag, re: new RegExp(pattern, 'i'), ...opts })

/** 자산군 — 상호배타에 가깝게 운영, 첫 매칭 우선 */
export const ASSET_RULES = [
  rule('머니마켓', 'CD금리|\\bKOFR\\b|\\bSOFR\\b|머니마켓|\\bMMF\\b|초단기|양도성예금|파킹'),
  rule('채권', '국고채|국채|회사채|크레딧|통안|금융채|채권|본드|Bond|Treasury|\\bTIPS\\b|하이일드|\\bIG\\b|투자등급'),
  rule('원자재', '금현물|골드|Gold|은현물|Silver|원유|WTI|Brent|구리|Copper|천연가스|Gas|농산물|팔라듐|백금|플래티넘|원자재|Commodity'),
  rule('통화', '달러|엔화|유로|위안|Currency|외환|\\bFX\\b'),
  rule('부동산', '리츠|REIT|부동산|Real Estate|Property'),
  rule('가상자산', '비트코인|이더리움|Bitcoin|Ethereum|가상자산|디지털자산|Crypto|Blockchain|블록체인'),
  rule('멀티에셋', '자산배분|멀티에셋|TDF|타겟데이트|밸런스|혼합|EMP|올웨더|All Weather'),
  rule('주식', '.') // 기본값
]

/** 지역 / 국가 */
export const REGION_RULES = [
  rule('미국', '미국|\\bU\\.?S\\.?A?\\b|S&P|나스닥|NASDAQ|다우|Dow|러셀|Russell|필라델피아|\\bSOX\\b|월가|뉴욕'),
  rule('중국', '중국|차이나|China|CSI|항셍|Hang Seng|홍콩|심천|상해|본토|H주'),
  rule('일본', '일본|Japan|니케이|Nikkei|TOPIX|엔화'),
  rule('인도', '인도|India|Nifty|센섹스'),
  rule('베트남', '베트남|Vietnam|VN30'),
  rule('유럽', '유럽|Europe|EURO|STOXX|독일|DAX|영국|FTSE 100|프랑스|CAC'),
  rule('신흥국', '신흥국|이머징|Emerging|\\bEM\\b'),
  rule('글로벌', '글로벌|Global|선진국|World|MSCI ACWI|ACWI|해외'),
  rule('대만', '대만|Taiwan|TAIEX'),
  rule('한국', '.') // 기본값
]

/** 섹터 (복수 태그 허용) */
export const SECTOR_RULES = [
  rule('반도체', '반도체|Semiconductor|\\bSOX[LS]?\\b|메모리|파운드리|\\bHBM\\b|소부장'),
  rule('IT·소프트웨어', '소프트웨어|Software|\\bIT\\b|클라우드|Cloud|\\bSaaS\\b|사이버보안|보안|Security'),
  rule('인터넷·플랫폼', '인터넷|플랫폼|Internet|Platform|이커머스|e-?commerce'),
  rule('2차전지', '2차전지|이차전지|배터리|Battery|리튬|Lithium|양극재|음극재|전해질'),
  rule('자동차', '자동차|\\bAuto\\b|Automobile|Automotive|모빌리티|Mobility|전기차|\\bEV\\b|자율주행'),
  rule('바이오·헬스케어', '바이오|헬스케어|Bio|Health|제약|의료|Pharma|Medical|신약'),
  rule('금융·은행', '은행|Bank|금융|Financial|지주'),
  rule('증권·보험', '증권|Broker|보험|Insurance'),
  rule('화학·소재', '화학|Chemical|소재|Material|정유'),
  rule('철강·비철', '철강|Steel|비철|금속'),
  rule('조선·기계', '조선|Shipbuilding|기계|Machinery|중공업'),
  rule('건설·인프라', '건설|Construction|인프라|Infra|건자재'),
  rule('유틸리티·전력', '유틸리티|Utilit|전력|Power|전선|송배전|그리드|Grid'),
  rule('에너지', '에너지|Energy|원유|가스|석유|정제'),
  rule('소비재', '소비재|Consumer|유통|리테일|음식료|화장품|Cosmetic|의류'),
  rule('미디어·엔터', '미디어|Media|엔터|Entertain|콘텐츠|Content|K-?POP|음악'),
  rule('게임', '게임|Game|Gaming|e스포츠'),
  rule('통신', '통신|Telecom|\\b[56]G\\b'),
  rule('방산·우주', '방산|방위|Defense|우주|항공우주|Aerospace|Space'),
  rule('로봇·자동화', '로봇|Robot|자동화|Automation|스마트팩토리'),
  rule('원자력', '원자력|원전|Nuclear|우라늄|Uranium|SMR'),
  rule('리츠·부동산', '리츠|REIT|부동산|Real Estate'),
  rule('농업·식품', '농업|농산물|Agri|식품|Food')
]

/** 테마 (복수 태그 허용, FAQ 프리셋과 직접 연결) */
export const THEME_RULES = [
  rule('AI·인공지능', '\\bAI\\b|인공지능|Artificial|머신러닝|딥러닝|\\bGPU\\b|데이터센터|Data ?Center'),
  rule('반도체', '반도체|Semiconductor|\\bSOX[LS]?\\b|\\bHBM\\b|파운드리|메모리'),
  rule('빅테크', '빅테크|BigTech|FANG|Magnificent|매그니피센트|\\bM7\\b|테크TOP'),
  rule('2차전지·전기차', '2차전지|이차전지|배터리|전기차|\\bEV\\b|리튬'),
  rule('배당', '배당|Dividend|인컴|Income|Yield'),
  rule('월배당', '월배당|Monthly|프리미엄.*인컴|인컴.*프리미엄'),
  rule('고배당', '고배당|High Dividend|High Yield|배당귀족|Aristocrat|배당다우'),
  rule('커버드콜', '커버드콜|Covered ?Call|타겟커버드|프리미엄'),
  // 금리 인하 국면에서 가격 민감도가 큰 장기 듀레이션 자산으로 한정한다.
  // '성장·리츠·바이오'처럼 간접적으로 수혜를 본다고 흔히 말하는 범주까지 넣으면
  // 배당성장 ETF 같은 무관한 종목이 대량으로 끌려 들어와 조건이 무의미해진다.
  rule('금리인하수혜', '국고채 ?(10|20|30) ?년|장기채|30년 ?국채|Treasury ?(10|20|30)|20\\+ ?Year|듀레이션|스트립'),
  rule('인플레이션헤지', '물가|TIPS|인플레|Inflation|금현물|골드|Gold|원자재|Commodity|실물'),
  rule('원자력·SMR', '원자력|원전|Nuclear|SMR|우라늄'),
  rule('방산·우주', '방산|방위|Defense|우주|Aerospace|Space'),
  rule('로봇', '로봇|Robot|자동화'),
  rule('신재생·클린에너지', '신재생|태양광|Solar|풍력|Wind|친환경|클린|Clean|수소|Hydrogen|탄소|Carbon'),
  rule('ESG', 'ESG|지속가능|Sustainab|사회책임|거버넌스'),
  rule('밸류업', '밸류업|Value-?up|기업가치|주주환원|자사주'),
  rule('메타버스·XR', '메타버스|Metaverse|\\bXR\\b|\\bVR\\b|\\bAR\\b'),
  rule('자율주행', '자율주행|Autonomous|라이다|LiDAR'),
  rule('저변동성', '저변동|Low Vol|Minimum Vol|LowVol'),
  rule('퀄리티', '퀄리티|Quality|우량'),
  rule('모멘텀', '모멘텀|Momentum'),
  rule('가치', '가치|Value|저PBR|저PER'),
  rule('성장', '성장|Growth'),
  rule('TDF·연금', 'TDF|타겟데이트|생애주기|연금'),
  rule('중소형', '중소형|스몰캡|Small ?Cap|Russell ?2000|코스닥'),
  rule('대형주', '대형|Large ?Cap|TOP ?10|TOP ?15|우량')
]

/** 전략·구조 속성 */
export const STRATEGY_RULES = [
  rule('레버리지', '레버리지|Leverage|\\b[23] ?X\\b'),
  rule('인버스', '인버스|Inverse|Short|곱버스|베어|Bear'),
  rule('액티브', '액티브|Active'),
  rule('커버드콜', '커버드콜|Covered ?Call'),
  rule('환헤지', '\\(H\\)|환헤지|Hedged'),
  rule('TR(토탈리턴)', 'TR\\b|토탈리턴|Total ?Return'),
  rule('합성', '합성|Synth')
]

/** 대표 참조지수 정규화 — 기초지수명 문자열을 표준 라벨로 */
export const BENCHMARK_RULES = [
  rule('S&P 500', 'S&P ?500|\\bSPX\\b'),
  rule('나스닥 100', '나스닥 ?100|NASDAQ ?100|\\bNDX\\b'),
  rule('다우존스 산업평균', '다우|Dow Jones Industrial|DJIA'),
  rule('필라델피아 반도체(SOX)', '필라델피아|PHLX|\\bSOX\\b'),
  rule('러셀 2000', '러셀 ?2000|Russell ?2000'),
  rule('KOSPI 200', '코스피 ?200|KOSPI ?200'),
  rule('KOSPI', '코스피|KOSPI'),
  rule('KOSDAQ 150', '코스닥 ?150|KOSDAQ ?150'),
  rule('KOSDAQ', '코스닥|KOSDAQ'),
  rule('KRX 300', 'KRX ?300'),
  rule('MSCI Korea', 'MSCI ?Korea'),
  rule('MSCI ACWI', 'ACWI'),
  rule('MSCI EM', 'MSCI ?(EM|Emerging)'),
  rule('MSCI EAFE', 'EAFE'),
  rule('CSI 300', 'CSI ?300'),
  rule('항셍테크', '항셍 ?테크|Hang Seng ?TECH'),
  rule('항셍', '항셍|Hang Seng'),
  rule('니케이 225', '니케이|Nikkei'),
  rule('TOPIX', 'TOPIX'),
  rule('Nifty 50', 'Nifty ?50'),
  rule('EURO STOXX 50', 'STOXX ?50'),
  rule('FTSE 100', 'FTSE ?100'),
  rule('KIS 국고채', '국고채|\\bKIS\\b'),
  rule('KOFR', 'KOFR'),
  rule('CD 91일', 'CD ?\\(?91')
]

// ────────────────────────────────────────────────────────────
// 매처
// ────────────────────────────────────────────────────────────

/** 규칙 목록에서 처음 매칭되는 태그 하나 */
function firstTag (rules, text, fallback = null) {
  for (const r of rules) if (r.re.test(text)) return r.tag
  return fallback
}

/** 규칙 목록에서 매칭되는 모든 태그 */
function allTags (rules, text) {
  const out = []
  for (const r of rules) if (r.re.test(text) && !out.includes(r.tag)) out.push(r.tag)
  return out
}

/** 운용사 추정 */
export function detectIssuer (name, symbol) {
  if (symbol && US_ISSUERS[symbol.toUpperCase()]) return US_ISSUERS[symbol.toUpperCase()]
  const upper = String(name || '').toUpperCase()
  for (const [brand, issuer] of BRANDS) {
    if (upper.startsWith(brand.toUpperCase())) return issuer
  }
  for (const [brand, issuer] of BRANDS) {
    if (upper.includes(brand.toUpperCase())) return issuer
  }
  return null
}

/** 브랜드(시리즈)명 추정 — KODEX / TIGER / SPDR 등 */
export function detectBrand (name, symbol) {
  const upper = String(name || '').toUpperCase()
  for (const [brand] of BRANDS) if (upper.startsWith(brand.toUpperCase())) return brand
  if (symbol) return null
  return null
}

/**
 * ETF 한 건을 분류한다.
 * @param {{name:string, benchmark?:string, symbol?:string, market?:string}} src
 * @returns 분류 태그 묶음
 */
export function classify (src) {
  const name = String(src.name || '')
  const bench = String(src.benchmark || '')
  const text = `${name} ${bench}`

  const strategy = allTags(STRATEGY_RULES, text)
  // 레버리지·인버스는 배수 표기(2X, -1X)로도 잡는다
  if (/\\b\d+ ?X\\b/i.test(name) && !strategy.includes('레버리지')) strategy.push('레버리지')

  const asset = firstTag(ASSET_RULES, text, '주식')

  // 지역은 종목명을 우선 판단한다. 기초지수명에는 산출기관(S&P, FTSE 등)이 섞여
  // 있어 원자재·통화처럼 국가 귀속이 없는 자산을 오분류하기 때문이다.
  const GLOBAL_ASSETS = ['원자재', '통화', '가상자산']
  let region
  if (src.market === 'US') region = '미국'
  else if (GLOBAL_ASSETS.includes(asset)) region = firstTag(REGION_RULES, name, '글로벌')
  else region = firstTag(REGION_RULES, name, null) || firstTag(REGION_RULES, bench, '한국')
  const sectors = allTags(SECTOR_RULES, text)
  const themes = allTags(THEME_RULES, text)
  const benchmark = firstTag(BENCHMARK_RULES, bench || name, bench || null)

  // 국내/해외 구분: 상장시장 기준이 아니라 "투자 대상 지역" 기준도 함께 제공
  const listing = src.market === 'US' ? '해외상장' : '국내상장'
  const exposure = region === '한국' ? '국내' : '해외'

  // 연금계좌(IRP/DC) 편입 가능 여부 — 레버리지·인버스 상품은 불가
  const pensionEligible =
    listing === '국내상장' &&
    !strategy.includes('레버리지') &&
    !strategy.includes('인버스')

  return {
    issuer: detectIssuer(name, src.symbol),
    brand: detectBrand(name, src.symbol),
    listing,
    exposure,
    region,
    asset,
    sectors,
    themes,
    strategy,
    benchmark,
    pensionEligible
  }
}

/** 필터 UI가 쓸 전체 선택지 목록 */
export const FACETS = {
  exposure: ['국내', '해외'],
  listing: ['국내상장', '해외상장'],
  region: REGION_RULES.map(r => r.tag),
  asset: ASSET_RULES.map(r => r.tag).filter(t => t !== '주식').concat('주식').sort(),
  sectors: SECTOR_RULES.map(r => r.tag),
  themes: THEME_RULES.map(r => r.tag),
  strategy: STRATEGY_RULES.map(r => r.tag)
}
