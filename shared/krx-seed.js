// ── 국내 상장 ETF 시드 목록 ──
//
// 용도: 공공데이터포털 키가 없거나 API 가 응답하지 않을 때 앱이 그대로 동작하도록
// 하는 최소 목록이다. 시세는 담지 않으며(null), 조건검색·분류·연결은 모두 작동한다.
// 키가 설정되면 /api/etfs 가 전종목 실시간 데이터로 이것을 대체한다.
//
// 필드: [종목코드, 종목명, 기초지수명]

const RAW = [
  // 국내 시장지수
  ['069500', 'KODEX 200', '코스피 200'],
  ['102110', 'TIGER 200', '코스피 200'],
  ['148020', 'RISE 200', '코스피 200'],
  ['278540', 'KODEX MSCI Korea TR', 'MSCI Korea TR'],
  ['229200', 'KODEX 코스닥150', '코스닥 150'],
  ['233740', 'KODEX 코스닥150레버리지', '코스닥 150'],
  ['122630', 'KODEX 레버리지', '코스피 200'],
  ['252670', 'KODEX 200선물인버스2X', '코스피 200 선물'],
  ['114800', 'KODEX 인버스', '코스피 200 선물'],
  ['292150', 'TIGER TOP10', 'FnGuide TOP10'],
  ['251340', 'KODEX 코스닥150선물인버스', '코스닥 150 선물'],

  // 미국 지수
  ['360750', 'TIGER 미국S&P500', 'S&P 500'],
  ['379800', 'KODEX 미국S&P500', 'S&P 500'],
  ['379780', 'RISE 미국S&P500', 'S&P 500'],
  ['360200', 'ACE 미국S&P500', 'S&P 500'],
  ['133690', 'TIGER 미국나스닥100', '나스닥 100'],
  ['379810', 'KODEX 미국나스닥100', '나스닥 100'],
  ['368590', 'RISE 미국나스닥100', '나스닥 100'],
  ['367380', 'ACE 미국나스닥100', '나스닥 100'],
  ['245340', 'TIGER 미국다우존스30', '다우존스 산업평균'],

  // 배당·커버드콜
  ['458730', 'TIGER 미국배당다우존스', 'Dow Jones U.S. Dividend 100'],
  ['446720', 'SOL 미국배당다우존스', 'Dow Jones U.S. Dividend 100'],
  ['402970', 'TIGER 미국배당+7%프리미엄다우존스', 'Dow Jones U.S. Dividend 100 커버드콜'],
  ['441640', 'KODEX 미국배당프리미엄액티브', '미국 배당 커버드콜'],
  ['472160', 'KODEX 미국배당다우존스', 'Dow Jones U.S. Dividend 100'],
  ['279530', 'KODEX 고배당', 'FnGuide 고배당'],
  ['161510', 'PLUS 고배당주', 'FnGuide 고배당주'],
  ['210780', 'TIGER 코스피고배당', '코스피 고배당 50'],

  // 반도체·AI·테크
  ['091160', 'KODEX 반도체', 'KRX 반도체'],
  ['091230', 'TIGER 반도체', 'KRX 반도체'],
  ['390390', 'KODEX 미국반도체MV', 'MVIS US Listed Semiconductor'],
  ['381180', 'TIGER 미국필라델피아반도체나스닥', '필라델피아 반도체 SOX'],
  ['446770', 'ACE 글로벌반도체TOP4 Plus SOLACTIVE', 'Solactive 글로벌 반도체'],
  ['456600', 'KODEX 미국AI테크TOP10', '미국 AI 테크 TOP10'],
  ['465580', 'ACE 미국빅테크TOP7 Plus', '미국 빅테크 TOP7'],
  ['314250', 'KODEX 미국FANG플러스', 'NYSE FANG+'],
  ['396500', 'TIGER 글로벌클라우드컴퓨팅INDXX', 'Indxx 글로벌 클라우드'],

  // 2차전지·전기차·자동차
  ['305720', 'KODEX 2차전지산업', 'FnGuide 2차전지 산업'],
  ['305540', 'TIGER 2차전지테마', 'WISE 2차전지 테마'],
  ['364980', 'TIGER KRX2차전지K-뉴딜', 'KRX 2차전지 K-뉴딜'],
  ['371460', 'TIGER 차이나전기차SOLACTIVE', 'Solactive 중국 전기차'],
  ['445910', 'TIGER 글로벌자율주행&전기차SOLACTIVE', 'Solactive 자율주행 전기차'],

  // 바이오·헬스케어
  ['244580', 'KODEX 바이오', 'FnGuide 바이오'],
  ['253280', 'KODEX 헬스케어', 'KRX 헬스케어'],
  ['227540', 'TIGER 200헬스케어', '코스피 200 헬스케어'],

  // 방산·원자력·로봇·신재생
  ['449450', 'PLUS K방산', 'FnGuide K방산'],
  ['463250', 'ACE 글로벌인공지능산업MV', 'MVIS 글로벌 인공지능'],
  ['442320', 'KODEX 미국클린에너지나스닥', '나스닥 클린에너지'],
  ['434730', 'TIGER 글로벌자원생산기업', '글로벌 원자재 생산'],

  // 금융·산업
  ['091170', 'KODEX 은행', 'KRX 은행'],
  ['139270', 'TIGER 200 금융', '코스피 200 금융'],
  ['117680', 'KODEX 철강', 'KRX 철강'],
  ['139230', 'TIGER 200 중공업', '코스피 200 중공업'],
  ['266370', 'KODEX 2차전지산업레버리지', 'FnGuide 2차전지 산업'],

  // 채권
  ['148070', 'KOSEF 국고채10년', 'KIS 국고채 10년'],
  ['385560', 'RISE KIS국고채30년Enhanced', 'KIS 국고채 30년'],
  ['439870', 'TIGER 국고채30년스트립액티브', 'KIS 국고채 30년 스트립'],
  ['304660', 'KODEX 미국채10년선물', '미국 국채 10년 선물'],
  ['458250', 'TIGER 미국30년국채프리미엄액티브(H)', '미국 국채 30년 커버드콜'],
  ['453850', 'ACE 미국30년국채액티브(H)', 'Bloomberg 미국 국채 20년 이상'],
  ['476760', 'KODEX 미국30년국채타겟커버드콜', '미국 국채 30년 커버드콜'],
  ['114260', 'KODEX 국고채3년', 'KIS 국고채 3년'],

  // 단기자금·파킹
  ['357870', 'TIGER CD금리투자KIS', 'CD 91일'],
  ['459580', 'KODEX CD금리액티브', 'CD 91일'],
  ['423160', 'KODEX KOFR금리액티브', 'KOFR'],
  ['449170', 'TIGER KOFR금리액티브', 'KOFR'],

  // 원자재
  ['132030', 'KODEX 골드선물(H)', 'S&P GSCI Gold'],
  ['319640', 'TIGER 골드선물(H)', 'S&P GSCI Gold'],
  ['261220', 'KODEX WTI원유선물(H)', 'S&P GSCI Crude Oil'],
  ['130680', 'TIGER 원유선물Enhanced(H)', 'S&P GSCI Crude Oil'],
  ['144600', 'KODEX 은선물(H)', 'S&P GSCI Silver'],

  // 리츠·부동산
  ['329200', 'TIGER 리츠부동산인프라', 'FnGuide 리츠 부동산 인프라'],
  ['352560', 'KODEX 한국부동산리츠인프라', 'KRX 리츠 인프라'],
  ['182480', 'TIGER 미국MSCI리츠(합성 H)', 'MSCI US REIT'],

  // 중국·일본·인도·베트남
  ['192090', 'TIGER 차이나CSI300', 'CSI 300'],
  ['283580', 'KODEX 차이나CSI300', 'CSI 300'],
  ['238720', 'RISE 중국본토CSI300', 'CSI 300'],
  ['371160', 'TIGER 차이나항셍테크', '항셍테크'],
  ['241180', 'TIGER 일본니케이225', '니케이 225'],
  ['453810', 'KODEX 인도Nifty50', 'Nifty 50'],
  ['453870', 'TIGER 인도니프티50', 'Nifty 50'],
  ['245710', 'ACE 베트남VN30(합성)', 'VN30'],

  // 글로벌·신흥국
  ['195980', 'PLUS 신흥국MSCI(합성 H)', 'MSCI Emerging Markets'],
  ['251350', 'KODEX 선진국MSCI World', 'MSCI World'],
  ['332620', 'ACE 글로벌리츠(합성)', '글로벌 리츠'],

  // 통화
  ['138230', 'KOSEF 미국달러선물', '미국 달러선물 지수'],
  ['261250', 'KODEX 미국달러선물레버리지', '미국 달러선물 지수'],

  // 밸류업·팩터
  ['466940', 'KODEX 코리아밸류업', 'KRX 코리아 밸류업'],
  ['292190', 'TIGER 코스피', '코스피'],
  ['223190', 'PLUS 중형가치', 'FnGuide 중형 가치'],
  ['285000', 'KODEX 200 가치저변동', '코스피 200 가치 저변동성'],

  // TDF·자산배분
  ['433390', 'KODEX TDF2050액티브', 'TDF 2050 생애주기'],
  ['466940X', 'ACE 글로벌자산배분액티브', '글로벌 자산배분']
]

export const KRX_SEED = RAW
  .filter(([code]) => /^\d{6}$/.test(code)) // 잘못된 코드는 걸러낸다
  .map(([code, name, benchmark]) => ({
    code,
    isin: null,
    name,
    symbol: null,
    market: 'KRX',
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
    benchmarkClose: null
  }))
