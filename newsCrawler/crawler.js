const axios = require('axios');
const cheerio = require('cheerio');

// 1. RSS 피드 사용 (더 안정적)
async function getNewsFromRSS() {
  try {
    const feeds = [
      'https://feeds.feedburner.com/ajunews_economy', // 아주경제
      'https://www.mk.co.kr/rss/30100041/', // 매일경제
      'https://rss.hankyung.com/new/news_main.xml' // 한국경제
    ];
    
    const articles = [];
    
    for (const feedUrl of feeds) {
      try {
        const response = await axios.get(feedUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
          }
        });
        
        const $ = cheerio.load(response.data, { xmlMode: true });
        
        $('item').each((i, item) => {
          const title = $(item).find('title').text().trim();
          const link = $(item).find('link').text().trim();
          const pubDate = $(item).find('pubDate').text().trim();
          
          if (title && link && articles.length < 20) {
            articles.push({
              source: feedUrl.includes('ajunews') ? 'AjuNews' : 
                     feedUrl.includes('mk.co.kr') ? 'MK' : 'Hankyung',
              title,
              link,
              pubDate
            });
          }
        });
      } catch (error) {
        console.error(`RSS 피드 오류 (${feedUrl}):`, error.message);
      }
    }
    
    return articles;
  } catch (error) {
    console.error('RSS 뉴스 수집 오류:', error);
    return [];
  }
}

// 2. 공개 뉴스 API 사용
async function getNewsFromAPI() {
  try {
    // NewsAPI 무료 버전 사용 (키 필요)
    const API_KEY = process.env.NEWS_API_KEY;
    if (!API_KEY) {
      console.log('News API 키가 없습니다');
      return [];
    }
    
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country: 'kr',
        category: 'business',
        apiKey: API_KEY,
        pageSize: 10
      },
      timeout: 15000
    });
    
    return response.data.articles.map(article => ({
      source: article.source.name,
      title: article.title,
      link: article.url,
      pubDate: article.publishedAt
    }));
    
  } catch (error) {
    console.error('News API 오류:', error.message);
    return [];
  }
}

// 3. 더 간단한 크롤링 (한국 사이트 중심)
async function getKoreanEconomicNews() {
  const sources = [
    {
      name: 'YTN',
      url: 'https://www.ytn.co.kr/news/list.php?mcd=0102',
      titleSelector: '.news_list .news_title a',
      linkSelector: '.news_list .news_title a'
    },
    {
      name: 'SBS',
      url: 'https://news.sbs.co.kr/news/newsList.do?ctgId=0800',
      titleSelector: '.w_news_list .text a',
      linkSelector: '.w_news_list .text a'
    }
  ];
  
  const articles = [];
  
  for (const source of sources) {
    try {
      const response = await axios.get(source.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      $(source.titleSelector).each((i, el) => {
        if (articles.length >= 15) return false;
        
        const title = $(el).text().trim();
        let link = $(el).attr('href');
        
        if (title && link) {
          if (!link.startsWith('http')) {
            const baseUrl = new URL(source.url).origin;
            link = baseUrl + link;
          }
          
          articles.push({
            source: source.name,
            title,
            link
          });
        }
      });
      
    } catch (error) {
      console.error(`${source.name} 크롤링 오류:`, error.message);
    }
  }
  
  return articles;
}

// 4. 백업용 정적 뉴스 데이터
function getStaticNews() {
  return [
    {
      source: 'Economic News',
      title: '코스피, 외국인 매수세에 상승 마감',
      link: 'https://example.com/news1'
    },
    {
      source: 'Business Today',
      title: '반도체 업계, 하반기 회복 전망',
      link: 'https://example.com/news2'
    },
    {
      source: 'Market Watch',
      title: '달러 강세 지속, 원화 약세 우려',
      link: 'https://example.com/news3'
    },
    {
      source: 'Tech News',
      title: 'AI 기술 발전으로 IT 기업 주가 상승',
      link: 'https://example.com/news4'
    },
    {
      source: 'Global Economy',
      title: '미 연준 기준금리 동결 결정',
      link: 'https://example.com/news5'
    }
  ];
}

// 5. 종합 뉴스 수집 함수
async function getAllEconomicNews() {
  console.log('뉴스 수집 시작...');
  
  try {
    // 여러 방법을 병렬로 시도
    const [rssNews, apiNews, koreanNews] = await Promise.allSettled([
      getNewsFromRSS(),
      getNewsFromAPI(),
      getKoreanEconomicNews()
    ]);
    
    const allNews = [];
    
    // RSS 뉴스 추가
    if (rssNews.status === 'fulfilled' && rssNews.value.length > 0) {
      allNews.push(...rssNews.value);
      console.log(`RSS 뉴스 ${rssNews.value.length}개 수집`);
    }
    
    // API 뉴스 추가
    if (apiNews.status === 'fulfilled' && apiNews.value.length > 0) {
      allNews.push(...apiNews.value);
      console.log(`API 뉴스 ${apiNews.value.length}개 수집`);
    }
    
    // 한국 사이트 뉴스 추가
    if (koreanNews.status === 'fulfilled' && koreanNews.value.length > 0) {
      allNews.push(...koreanNews.value);
      console.log(`한국 사이트 뉴스 ${koreanNews.value.length}개 수집`);
    }
    
    // 뉴스가 없으면 정적 데이터 사용
    if (allNews.length === 0) {
      console.log('실제 뉴스 수집 실패, 정적 데이터 사용');
      return getStaticNews();
    }
    
    // 중복 제거 및 최대 20개로 제한
    const uniqueNews = allNews.filter((news, index, self) => 
      index === self.findIndex(n => n.title === news.title)
    ).slice(0, 20);
    
    console.log(`총 ${uniqueNews.length}개 뉴스 수집 완료`);
    return uniqueNews;
    
  } catch (error) {
    console.error('뉴스 수집 실패:', error);
    return getStaticNews();
  }
}

module.exports = {
  getAllEconomicNews
};