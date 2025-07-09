const axios = require('axios');
const cheerio = require('cheerio');

// RSS 피드 소스 정의
const RSS_FEEDS = [
  {
    url: 'https://www.mk.co.kr/rss/30000001/',
    source: '매일경제',
    encoding: 'utf-8',
    language: 'ko'
  },
  {
    url: 'https://www.hankyung.com/feed/economy',
    source: '한국경제',
    encoding: 'utf-8',
    language: 'ko'
  },
  {
    url: 'https://rss.joins.com/joins_economy_list.xml',
    source: '중앙일보',
    encoding: 'utf-8',
    language: 'ko'
  },
  {
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    source: 'BBC Business',
    encoding: 'utf-8',
    language: 'en'
  },
  {
    url: 'http://rss.cnn.com/rss/money_latest.rss',
    source: 'CNN Business',
    encoding: 'utf-8',
    language: 'en'
  }
];

// 단일 RSS 피드 처리
async function processSingleFeed(feed, maxArticles = 10) {
  try {
    console.log(`RSS 피드 수집 시도: ${feed.source} (${feed.url})`);
    
    const response = await axios.get(feed.url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': feed.language === 'ko' ? 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      },
      responseType: 'text',
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    
    const $ = cheerio.load(response.data, { 
      xmlMode: true,
      decodeEntities: true,
      normalizeWhitespace: true
    });
    
    const articles = [];
    
    // RSS 아이템 파싱
    $('item').each((index, item) => {
      if (articles.length >= maxArticles) return false;
      
      const $item = $(item);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const pubDate = $item.find('pubDate').text().trim();
      const description = $item.find('description').text().trim();
      const category = $item.find('category').text().trim();
      
      // 제목과 링크가 있는 경우만 추가
      if (title && link && title.length > 5) {
        // HTML 태그 제거 및 텍스트 정리
        const cleanTitle = title
          .replace(/<[^>]*>/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        const cleanDescription = description
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 200);
        
        // 발행일 처리
        let publishedDate;
        if (pubDate) {
          publishedDate = new Date(pubDate).toISOString();
        } else {
          publishedDate = new Date().toISOString();
        }
        
        articles.push({
          source: feed.source,
          title: cleanTitle,
          link: link,
          pubDate: publishedDate,
          description: cleanDescription + (cleanDescription.length >= 200 ? '...' : ''),
          category: category,
          language: feed.language
        });
      }
    });
    
    console.log(`✓ ${feed.source}에서 ${articles.length}개 뉴스 수집 성공`);
    return articles;
    
  } catch (error) {
    console.error(`✗ ${feed.source} RSS 피드 오류:`, error.message);
    
    // 특정 오류에 대한 재시도 로직
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.log(`${feed.source} 재시도 중...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const retryResponse = await axios.get(feed.url, {
          timeout: 25000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          },
          maxRedirects: 3
        });
        
        const $retry = cheerio.load(retryResponse.data, { xmlMode: true });
        const retryArticles = [];
        
        $retry('item').each((index, item) => {
          if (retryArticles.length >= 5) return false;
          
          const title = $retry(item).find('title').text().trim();
          const link = $retry(item).find('link').text().trim();
          
          if (title && link && title.length > 5) {
            retryArticles.push({
              source: feed.source,
              title: title.replace(/<[^>]*>/g, '').trim(),
              link: link,
              pubDate: new Date().toISOString(),
              description: '',
              category: '',
              language: feed.language
            });
          }
        });
        
        console.log(`✓ ${feed.source} 재시도 성공: ${retryArticles.length}개`);
        return retryArticles;
        
      } catch (retryError) {
        console.error(`✗ ${feed.source} 재시도 실패:`, retryError.message);
        return [];
      }
    }
    
    return [];
  }
}

// 모든 RSS 피드에서 뉴스 수집
async function getNewsFromRSS() {
  console.log('=== RSS 뉴스 수집 시작 ===');
  const startTime = Date.now();
  
  try {
    const allArticles = [];
    
    // 병렬 처리로 모든 피드 동시 수집
    const feedPromises = RSS_FEEDS.map(feed => 
      processSingleFeed(feed, 8).then(articles => ({
        source: feed.source,
        articles: articles
      }))
    );
    
    // 모든 피드 결과 대기
    const results = await Promise.allSettled(feedPromises);
    
    // 결과 처리
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { source, articles } = result.value;
        allArticles.push(...articles);
        console.log(`${source}: ${articles.length}개 기사 수집`);
      } else {
        console.error('피드 처리 실패:', result.reason);
      }
    });
    
    // 중복 제거 (제목 기준)
    const uniqueArticles = [];
    const seenTitles = new Set();
    
    for (const article of allArticles) {
      const titleKey = article.title.toLowerCase().replace(/\s+/g, '');
      if (!seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        uniqueArticles.push(article);
      }
    }
    
    // 최신순 정렬
    uniqueArticles.sort((a, b) => {
      const dateA = new Date(a.pubDate);
      const dateB = new Date(b.pubDate);
      return dateB - dateA;
    });
    
    // 최대 30개로 제한
    const finalArticles = uniqueArticles.slice(0, 30);
    
    const endTime = Date.now();
    console.log(`✓ 총 ${finalArticles.length}개 고유 뉴스 수집 완료 (${endTime - startTime}ms)`);
    console.log('=== RSS 뉴스 수집 완료 ===');
    
    return finalArticles;
    
  } catch (error) {
    console.error('RSS 뉴스 수집 중 오류:', error);
    return [];
  }
}

// 개별 피드 테스트
async function testSingleFeed(feedIndex) {
  if (feedIndex < 0 || feedIndex >= RSS_FEEDS.length) {
    console.error('잘못된 피드 인덱스');
    return;
  }
  
  const feed = RSS_FEEDS[feedIndex];
  console.log(`=== ${feed.source} 단일 피드 테스트 ===`);
  
  const articles = await processSingleFeed(feed, 5);
  
  if (articles.length > 0) {
    console.log(`성공: ${articles.length}개 기사`);
    articles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   링크: ${article.link}`);
      console.log(`   날짜: ${new Date(article.pubDate).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('실패: 기사를 가져올 수 없음');
  }
}

// 모든 피드 상태 확인
async function healthCheck() {
  console.log('=== RSS 피드 상태 확인 ===');
  
  const results = {};
  
  for (let i = 0; i < RSS_FEEDS.length; i++) {
    const feed = RSS_FEEDS[i];
    
    try {
      const startTime = Date.now();
      const articles = await processSingleFeed(feed, 3);
      const endTime = Date.now();
      
      results[feed.source] = {
        status: articles.length > 0 ? '✓ 정상' : '⚠️ 빈 결과',
        count: articles.length,
        responseTime: `${endTime - startTime}ms`,
        url: feed.url
      };
      
      console.log(`${feed.source}: ${results[feed.source].status} (${articles.length}개, ${results[feed.source].responseTime})`);
      
    } catch (error) {
      results[feed.source] = {
        status: '✗ 오류',
        count: 0,
        error: error.message,
        url: feed.url
      };
      console.log(`${feed.source}: ✗ 오류 - ${error.message}`);
    }
    
    // 각 피드 테스트 사이 간격
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('=== 상태 확인 완료 ===');
  return results;
}

// 메인 뉴스 수집 함수
async function getAllEconomicNews() {
  console.log('=== 경제 뉴스 수집 시작 ===');
  
  const news = await getNewsFromRSS();
  
  if (news.length === 0) {
    console.log('⚠️ 뉴스를 가져올 수 없습니다. 피드 상태를 확인해주세요.');
    return [];
  }
  
  console.log('=== 경제 뉴스 수집 완료 ===');
  return news;
}

module.exports = {
  getAllEconomicNews,
  getNewsFromRSS,
  healthCheck,
  testSingleFeed,
  RSS_FEEDS
};