const express = require('express');
const router = express.Router();
const { getAllEconomicNews } = require('../newsCrawler/crawler.js');
const { summarizeNews } = require('../summarizer');

// 뉴스 리스트
router.get('/economic', async (req, res) => {
  try {
    const news = await getAllEconomicNews();
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: '뉴스 크롤링 실패' });
  }
});

// 뉴스 요약 요청 (프론트에서 링크로 요청)
router.get('/summary', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url 쿼리 누락' });

  try {
    const summary = await summarizeNews(url);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: '요약 실패' });
  }
});

module.exports = router;
