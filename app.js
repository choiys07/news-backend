require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const cron = require('node-cron');
const { getAllEconomicNews } = require('./newsCrawler/crawler'); // 올바른 경로

// Express 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 설정 - 배포 환경에 맞게 수정
app.use(cors({
  origin: [
    'https://teal-bubblegum-b7a03d.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: '실시간 경제 뉴스 API 서버',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 헬스체크 라우트
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 뉴스 라우터
const newsRouter = require('./routes/news');
app.use('/api/news', newsRouter);

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ 
    error: '페이지를 찾을 수 없습니다',
    path: req.path 
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).json({ 
    error: '서버 내부 오류',
    message: err.message 
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  console.log(`배포 서버: https://news-backend-w0xf.onrender.com`);
});

// 10분마다 뉴스 크롤링 (캐시 목적)
cron.schedule('*/10 * * * *', async () => {
  try {
    console.log('정기 뉴스 크롤링 시작...');
    const news = await getAllEconomicNews();
    console.log(`10분마다 뉴스 크롤링 완료: ${news.length}개`);
  } catch (error) {
    console.error('정기 크롤링 오류:', error);
  }
});