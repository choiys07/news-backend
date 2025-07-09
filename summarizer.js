const axios = require('axios');
const cheerio = require('cheerio');

// 기사 본문 크롤링 + 요약
async function summarizeNews(link) {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);
    let text = '';

    // 네이버 뉴스 본문 선택자 예시 (다른 사이트는 따로 처리 필요)
    $('article').each((i, el) => {
      text += $(el).text().trim();
    });

    // 단순 요약: 앞 문장 2~3개만 추출 (진짜 요약 아님)
    const summary = text.split('.').slice(0, 3).join('.') + '.';

    return summary.length > 20 ? summary : '요약할 수 없습니다';
  } catch (err) {
    console.error('요약 실패:', err);
    return '요약 중 오류 발생';
  }
}

module.exports = { summarizeNews };
