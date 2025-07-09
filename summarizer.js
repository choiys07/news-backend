const axios = require('axios');
const cheerio = require('cheerio');

// OpenAI API를 사용한 뉴스 요약 함수
async function summarizeNews(link) {
  try {
    // 1. 기사 본문 크롤링
    const response = await axios.get(link, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const $ = cheerio.load(response.data);
    let articleText = '';

    // 다양한 뉴스 사이트의 본문 선택자 시도
    const selectors = [
      'article',
      '.article-content',
      '.news-content',
      '.entry-content',
      '.post-content',
      '.content',
      '#articleBodyContents',
      '.article_body',
      '.article-body',
      '.story-body__inner',
      '.story-body',
      'div[data-module="ArticleBody"]',
      '.art_txt',
      '.read_body'
    ];

    // 각 선택자로 본문 추출 시도
    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > articleText.length) {
            articleText = text;
          }
        });
        if (articleText.length > 200) break;
      }
    }

    // 본문을 찾지 못한 경우 전체 텍스트에서 추출
    if (articleText.length < 200) {
      articleText = $('body').text().trim();
    }

    // 텍스트 정리
    articleText = articleText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    // 너무 짧은 경우 처리
    if (articleText.length < 100) {
      return '기사 본문을 충분히 가져올 수 없어 요약이 어렵습니다.';
    }

    // 너무 긴 경우 앞부분만 사용 (OpenAI 토큰 제한 고려)
    if (articleText.length > 4000) {
      articleText = articleText.substring(0, 4000);
    }

    // 2. OpenAI API로 요약 요청
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 뉴스 기사를 요약하는 전문가입니다. 주요 내용을 3-4문장으로 간결하고 명확하게 요약해주세요. 중요한 사실과 핵심 정보를 포함해야 합니다.'
          },
          {
            role: 'user',
            content: `다음 뉴스 기사를 한국어로 요약해주세요:\n\n${articleText}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const summary = openaiResponse.data.choices[0].message.content.trim();
    
    // 요약 결과 검증
    if (summary.length < 20) {
      return '요약 결과가 너무 짧습니다. 다시 시도해주세요.';
    }

    return summary;

  } catch (error) {
    console.error('뉴스 요약 오류:', error.message);
    
    // 에러 타입별 처리
    if (error.response?.status === 401) {
      return 'OpenAI API 키가 올바르지 않습니다.';
    } else if (error.response?.status === 429) {
      return 'API 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.response?.status === 500) {
      return 'OpenAI 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return '요약 요청 시간이 초과되었습니다. 다시 시도해주세요.';
    } else {
      return '요약 중 오류가 발생했습니다. 다시 시도해주세요.';
    }
  }
}

// 대체 요약 함수 (OpenAI API 실패 시)
async function fallbackSummarize(articleText) {
  try {
    // 간단한 추출식 요약
    const sentences = articleText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length === 0) {
      return '요약할 수 없습니다.';
    }

    // 첫 번째 문장과 중간 부분의 중요한 문장들 선택
    const summary = sentences.slice(0, 3).join('. ') + '.';
    
    return summary.length > 50 ? summary : '요약 내용이 부족합니다.';
  } catch (error) {
    return '요약할 수 없습니다.';
  }
}

module.exports = { summarizeNews };