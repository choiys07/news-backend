const axios = require('axios');
const cheerio = require('cheerio');

// 한국: 네이버 경제 뉴스
async function getNaverEconomicNews() {
  try {
    const url = 'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=101';
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];

    $('div.cluster_body ul.cluster_list li.cluster_item').each((i, el) => {
      const title = $(el).find('a.cluster_text_headline').text().trim();
      const link = $(el).find('a.cluster_text_headline').attr('href');
      if (title && link) {
        articles.push({
          source: 'Naver',
          title,
          link: `https://news.naver.com${link}`,
        });
      }
    });

    console.log(`네이버 뉴스 ${articles.length}개 크롤링 완료`);
    return articles;
  } catch (error) {
    console.error('네이버 뉴스 크롤링 오류:', error.message);
    return [];
  }
}

// 해외: BBC Business
async function getBBCBusinessNews() {
  try {
    const url = 'https://www.bbc.com/news/business';
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];

    $('a.gs-c-promo-heading').each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr('href');
      if (title && link && !link.startsWith('#')) {
        articles.push({
          source: 'BBC',
          title,
          link: link.startsWith('http') ? link : `https://www.bbc.com${link}`,
        });
      }
    });

    console.log(`BBC 뉴스 ${articles.length}개 크롤링 완료`);
    return articles.slice(0, 10); // 너무 많으면 잘라냄
  } catch (error) {
    console.error('BBC 뉴스 크롤링 오류:', error.message);
    return [];
  }
}

// 해외: CNN Business
async function getCNNBusinessNews() {
  try {
    const url = 'https://edition.cnn.com/business';
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];

    $('h3.cd__headline a').each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr('href');
      if (title && link) {
        articles.push({
          source: 'CNN',
          title,
          link: link.startsWith('http') ? link : `https://edition.cnn.com${link}`,
        });
      }
    });

    console.log(`CNN 뉴스 ${articles.length}개 크롤링 완료`);
    return articles.slice(0, 10);
  } catch (error) {
    console.error('CNN 뉴스 크롤링 오류:', error.message);
    return [];
  }
}

async function getAllEconomicNews() {
  try {
    console.log('전체 경제 뉴스 크롤링 시작...');
    
    const [naver, bbc, cnn] = await Promise.allSettled([
      getNaverEconomicNews(),
      getBBCBusinessNews(),
      getCNNBusinessNews(),
    ]);

    const allNews = [];
    
    if (naver.status === 'fulfilled') {
      allNews.push(...naver.value.slice(0, 10));
    }
    if (bbc.status === 'fulfilled') {
      allNews.push(...bbc.value);
    }
    if (cnn.status === 'fulfilled') {
      allNews.push(...cnn.value);
    }

    console.log(`전체 뉴스 크롤링 완료: ${allNews.length}개`);
    return allNews;
  } catch (error) {
    console.error('전체 뉴스 크롤링 오류:', error);
    return [];
  }
}

module.exports = {
  getAllEconomicNews,
};