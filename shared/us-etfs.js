// ── 해외(미국) 상장 ETF 목록 ──
//
// 금융위 getEtfPriceInfo 는 국내 상장 ETF 만 다룬다.
// 요건의 "국내외 ETF" 중 해외 *상장* 종목을 검색·연결 대상에 포함시키기 위해
// 대표 종목을 목록으로 동봉한다. 시세는 제공하지 않으며(별도 해외 시세 원천 미연동),
// 조건검색과 기술적분석·스토커 연결(심볼 전달)에는 그대로 사용된다.
//
// 필드: [심볼, 종목명, 기초지수/전략, 총보수(%)]

const RAW = [
  // ── 미국 광범위 지수
  ['SPY', 'SPDR S&P 500 ETF Trust', 'S&P 500', 0.0945],
  ['VOO', 'Vanguard S&P 500 ETF', 'S&P 500', 0.03],
  ['IVV', 'iShares Core S&P 500 ETF', 'S&P 500', 0.03],
  ['QQQ', 'Invesco QQQ Trust', '나스닥 100', 0.20],
  ['QQQM', 'Invesco NASDAQ 100 ETF', '나스닥 100', 0.15],
  ['DIA', 'SPDR Dow Jones Industrial Average ETF', '다우존스 산업평균', 0.16],
  ['IWM', 'iShares Russell 2000 ETF', '러셀 2000 중소형', 0.19],
  ['VTI', 'Vanguard Total Stock Market ETF', '미국 전체시장', 0.03],
  ['RSP', 'Invesco S&P 500 Equal Weight ETF', 'S&P 500 동일가중', 0.20],

  // ── 글로벌·해외
  ['VT', 'Vanguard Total World Stock ETF', 'MSCI ACWI 글로벌', 0.06],
  ['VEA', 'Vanguard FTSE Developed Markets ETF', '선진국 FTSE', 0.03],
  ['EFA', 'iShares MSCI EAFE ETF', 'MSCI EAFE 선진국', 0.33],
  ['VWO', 'Vanguard FTSE Emerging Markets ETF', '신흥국 FTSE', 0.07],
  ['EEM', 'iShares MSCI Emerging Markets ETF', 'MSCI EM 신흥국', 0.70],
  ['EWJ', 'iShares MSCI Japan ETF', '일본 MSCI', 0.50],
  ['EWY', 'iShares MSCI South Korea ETF', '한국 MSCI', 0.59],
  ['MCHI', 'iShares MSCI China ETF', '중국 MSCI', 0.59],
  ['INDA', 'iShares MSCI India ETF', '인도 MSCI', 0.62],

  // ── 섹터
  ['XLK', 'Technology Select Sector SPDR Fund', 'S&P 500 IT·소프트웨어 섹터', 0.09],
  ['XLF', 'Financial Select Sector SPDR Fund', 'S&P 500 금융·은행 섹터', 0.09],
  ['XLE', 'Energy Select Sector SPDR Fund', 'S&P 500 에너지 섹터', 0.09],
  ['XLV', 'Health Care Select Sector SPDR Fund', 'S&P 500 헬스케어 섹터', 0.09],
  ['XLI', 'Industrial Select Sector SPDR Fund', 'S&P 500 산업재·기계 섹터', 0.09],
  ['XLY', 'Consumer Discretionary Select Sector SPDR', 'S&P 500 소비재 섹터', 0.09],
  ['XLP', 'Consumer Staples Select Sector SPDR', 'S&P 500 필수소비재 섹터', 0.09],
  ['XLU', 'Utilities Select Sector SPDR Fund', 'S&P 500 유틸리티·전력 섹터', 0.09],
  ['XLB', 'Materials Select Sector SPDR Fund', 'S&P 500 화학·소재 섹터', 0.09],
  ['XLRE', 'Real Estate Select Sector SPDR Fund', 'S&P 500 리츠·부동산 섹터', 0.09],
  ['XLC', 'Communication Services Select Sector SPDR', 'S&P 500 통신·미디어 섹터', 0.09],

  // ── 반도체·AI·테크
  ['SOXX', 'iShares Semiconductor ETF', '필라델피아 반도체 SOX', 0.35],
  ['SMH', 'VanEck Semiconductor ETF', '반도체 25선', 0.35],
  ['IGV', 'iShares Expanded Tech-Software ETF', 'IT 소프트웨어', 0.41],
  ['SKYY', 'First Trust Cloud Computing ETF', '클라우드 컴퓨팅', 0.60],
  ['CIBR', 'First Trust NASDAQ Cybersecurity ETF', '사이버보안', 0.59],
  ['HACK', 'Amplify Cybersecurity ETF', '사이버보안', 0.60],
  ['BOTZ', 'Global X Robotics & AI ETF', '로봇·인공지능 AI', 0.68],
  ['ROBO', 'ROBO Global Robotics & Automation ETF', '로봇 자동화', 0.95],
  ['ARKK', 'ARK Innovation ETF', '파괴적 혁신 액티브', 0.75],
  ['MAGS', 'Roundhill Magnificent Seven ETF', '매그니피센트7 빅테크', 0.29],

  // ── 배당·인컴·커버드콜
  ['SCHD', 'Schwab US Dividend Equity ETF', 'Dow Jones U.S. Dividend 100 고배당', 0.06],
  ['VIG', 'Vanguard Dividend Appreciation ETF', '배당성장', 0.05],
  ['VYM', 'Vanguard High Dividend Yield ETF', '고배당', 0.06],
  ['DGRO', 'iShares Core Dividend Growth ETF', '배당성장', 0.08],
  ['NOBL', 'ProShares S&P 500 Dividend Aristocrats', '배당귀족 Aristocrat', 0.35],
  ['SDY', 'SPDR S&P Dividend ETF', '고배당 배당성장', 0.35],
  ['SPHD', 'Invesco S&P 500 High Dividend Low Volatility', '고배당 저변동성', 0.30],
  ['JEPI', 'JPMorgan Equity Premium Income ETF', '월배당 커버드콜 인컴 액티브', 0.35],
  ['JEPQ', 'JPMorgan Nasdaq Equity Premium Income ETF', '월배당 커버드콜 나스닥 인컴', 0.35],
  ['QYLD', 'Global X NASDAQ 100 Covered Call ETF', '월배당 커버드콜 나스닥 100', 0.61],
  ['XYLD', 'Global X S&P 500 Covered Call ETF', '월배당 커버드콜 S&P 500', 0.60],
  ['RYLD', 'Global X Russell 2000 Covered Call ETF', '월배당 커버드콜 러셀 2000', 0.60],
  ['DIVO', 'Amplify CWP Enhanced Dividend Income ETF', '월배당 커버드콜 배당 액티브', 0.56],

  // ── 채권
  ['AGG', 'iShares Core U.S. Aggregate Bond ETF', '미국 종합채권', 0.03],
  ['BND', 'Vanguard Total Bond Market ETF', '미국 종합채권', 0.03],
  ['TLT', 'iShares 20+ Year Treasury Bond ETF', '미국 국채 20년 이상 장기채', 0.15],
  ['IEF', 'iShares 7-10 Year Treasury Bond ETF', '미국 국채 7-10년', 0.15],
  ['SHY', 'iShares 1-3 Year Treasury Bond ETF', '미국 국채 1-3년 단기', 0.15],
  ['TIP', 'iShares TIPS Bond ETF', '물가연동국채 TIPS 인플레이션', 0.18],
  ['LQD', 'iShares iBoxx Investment Grade Corporate Bond', '투자등급 회사채', 0.14],
  ['HYG', 'iShares iBoxx High Yield Corporate Bond', '하이일드 회사채', 0.49],
  ['SGOV', 'iShares 0-3 Month Treasury Bond ETF', '초단기 국채 파킹', 0.09],

  // ── 원자재·대체·부동산
  ['GLD', 'SPDR Gold Shares', '금현물 Gold', 0.40],
  ['IAU', 'iShares Gold Trust', '금현물 Gold', 0.25],
  ['SLV', 'iShares Silver Trust', '은현물 Silver', 0.50],
  ['USO', 'United States Oil Fund', 'WTI 원유', 0.60],
  ['DBC', 'Invesco DB Commodity Index Tracking Fund', '원자재 Commodity 인플레이션', 0.85],
  ['VNQ', 'Vanguard Real Estate ETF', '미국 리츠 REIT 부동산', 0.13],
  ['IBIT', 'iShares Bitcoin Trust ETF', '비트코인 Bitcoin 가상자산', 0.25],
  ['FBTC', 'Fidelity Wise Origin Bitcoin Fund', '비트코인 Bitcoin 가상자산', 0.25],

  // ── 에너지전환·방산·원자력
  ['ICLN', 'iShares Global Clean Energy ETF', '클린에너지 신재생', 0.41],
  ['TAN', 'Invesco Solar ETF', '태양광 Solar 신재생', 0.67],
  ['LIT', 'Global X Lithium & Battery Tech ETF', '리튬 2차전지 배터리', 0.75],
  ['URA', 'Global X Uranium ETF', '우라늄 원자력 Nuclear', 0.69],
  ['NLR', 'VanEck Uranium and Nuclear ETF', '원자력 Nuclear 우라늄', 0.61],
  ['ITA', 'iShares U.S. Aerospace & Defense ETF', '방산 Defense 우주 Aerospace', 0.40],
  ['PPA', 'Invesco Aerospace & Defense ETF', '방산 Defense 우주 Aerospace', 0.57],

  // ── 팩터
  ['QUAL', 'iShares MSCI USA Quality Factor ETF', '퀄리티 Quality 팩터', 0.15],
  ['MTUM', 'iShares MSCI USA Momentum Factor ETF', '모멘텀 Momentum 팩터', 0.15],
  ['USMV', 'iShares MSCI USA Min Vol Factor ETF', '저변동성 Low Vol 팩터', 0.15],
  ['MOAT', 'VanEck Morningstar Wide Moat ETF', '가치 Value 경제적해자', 0.46],
  ['COWZ', 'Pacer US Cash Cows 100 ETF', '가치 Value 잉여현금흐름', 0.49],

  // ── 레버리지·인버스
  ['TQQQ', 'ProShares UltraPro QQQ', '나스닥 100 레버리지 3X', 0.84],
  ['SQQQ', 'ProShares UltraPro Short QQQ', '나스닥 100 인버스 3X', 0.95],
  ['SOXL', 'Direxion Daily Semiconductor Bull 3X', '필라델피아 반도체 레버리지 3X', 0.75],
  ['SOXS', 'Direxion Daily Semiconductor Bear 3X', '필라델피아 반도체 인버스 3X', 1.00],
  ['UPRO', 'ProShares UltraPro S&P500', 'S&P 500 레버리지 3X', 0.91],
  ['SPXL', 'Direxion Daily S&P 500 Bull 3X', 'S&P 500 레버리지 3X', 0.91],
  ['TMF', 'Direxion Daily 20+ Year Treasury Bull 3X', '미국 장기국채 레버리지 3X', 1.06]
]

/** 내부 표준 스키마로 변환 */
export const US_ETFS = RAW.map(([symbol, name, benchmark, fee]) => ({
  code: symbol,
  isin: null,
  name,
  symbol,
  market: 'US',
  basDt: null,
  close: null,
  change: null,
  changeRate: null,
  open: null,
  high: null,
  low: null,
  volume: null,
  value: null,
  nav: null,
  netAssets: null,
  marketCap: null,
  shares: null,
  benchmarkRaw: benchmark,
  benchmarkClose: null,
  expenseRatio: fee
}))
