const axios = require('axios');
const cheerio = require('cheerio');

// 한국: 네이버 경제 뉴스
async function getNaverEconomicNews() {
  const url = 'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=101';
  const response = await axios.get(url);
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

  return articles;
}

// 해외: BBC Business
async function getBBCBusinessNews() {
  const url = 'https://www.bbc.com/news/business';
  const response = await axios.get(url);
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

  return articles.slice(0, 10); // 너무 많으면 잘라냄
}

// 해외: CNN Business
async function getCNNBusinessNews() {
  const url = 'https://edition.cnn.com/business';
  const response = await axios.get(url);
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

  return articles.slice(0, 10);
}

async function getAllEconomicNews() {
  const [naver, bbc, cnn] = await Promise.all([
    getNaverEconomicNews(),
    getBBCBusinessNews(),
    getCNNBusinessNews(),
  ]);
  return [...naver.slice(0, 10), ...bbc, ...cnn];
}

module.exports = {
  getAllEconomicNews,
};
