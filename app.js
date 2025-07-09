require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const cron = require('node-cron');
const { getAllEconomicNews } = require('./newsCrawler/crawler');

// 메모리 캐시 설정
let newsCache = {
  data: [],
  lastUpdated: null,
  isUpdating: false
};

const CACHE_DURATION = 10 * 60 * 1000; // 10분

// Express 미들웨어 설정
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 설정 (캐시 헤더 전에 설정)
app.use(cors({
  origin:'https://apilivenews.netlify.app/',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'If-None-Match'],
  exposedHeaders: ['Cache-Control', 'ETag', 'Last-Modified']
}));

// 전역 보안 헤더 및 캐시 설정 미들웨어
app.use((req, res, next) => {
  // 보안 헤더 설정
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content-Type 설정 (중요!)
  if (req.path.includes('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  
  // 정적 리소스 캐시
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  next();
});

// 뉴스 캐시 업데이트 함수
async function updateNewsCache() {
  if (newsCache.isUpdating) {
    console.log('이미 캐시 업데이트 중...');
    return newsCache.data;
  }

  const now = Date.now();
  
  // 캐시가 유효한지 확인
  if (newsCache.lastUpdated && (now - newsCache.lastUpdated) < CACHE_DURATION) {
    console.log('캐시 유효, 기존 데이터 반환');
    return newsCache.data;
  }

  try {
    console.log('뉴스 캐시 업데이트 시작...');
    newsCache.isUpdating = true;
    
    const news = await getAllEconomicNews();
    
    newsCache.data = news;
    newsCache.lastUpdated = now;
    newsCache.isUpdating = false;
    
    console.log(`뉴스 캐시 업데이트 완료: ${news.length}개`);
    return news;
    
  } catch (error) {
    console.error('뉴스 캐시 업데이트 오류:', error);
    newsCache.isUpdating = false;
    
    // 오류 시 기존 캐시 반환 (있다면)
    return newsCache.data.length > 0 ? newsCache.data : [];
  }
}

// 기본 라우트
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  res.json({ 
    message: '실시간 경제 뉴스 API 서버',
    status: 'running',
    timestamp: new Date().toISOString(),
    cache: {
      lastUpdated: newsCache.lastUpdated,
      newsCount: newsCache.data.length,
      isUpdating: newsCache.isUpdating
    }
  });
});

// 헬스체크 라우트
app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      lastUpdated: newsCache.lastUpdated,
      newsCount: newsCache.data.length
    }
  });
});

// 뉴스 API 라우트 - 수정된 버전
app.get('/api/news/economic', async (req, res) => {
  try {
    const news = await updateNewsCache();
    
    // 캐시 헤더 설정
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // ETag 생성
    const etag = `"${newsCache.lastUpdated || Date.now()}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date(newsCache.lastUpdated || Date.now()).toUTCString());
    
    // 조건부 요청 처리
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    // 응답 형식 수정 - 배열로 직접 반환
    res.json(news);
    
  } catch (error) {
    console.error('뉴스 API 오류:', error);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ 
      error: '뉴스 로딩 실패',
      message: error.message 
    });
  }
});

// 뉴스 요약 API
app.get('/api/news/summary', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: 'url 쿼리 파라미터가 필요합니다' });
  }

  try {
    // 요약은 더 긴 캐시 (1시간)
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    const { summarizeNews } = require('./summarizer');
    const summary = await summarizeNews(url);
    
    res.json({ 
      summary,
      url,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('요약 API 오류:', error);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ error: '요약 실패' });
  }
});

// 캐시 상태 확인 API
app.get('/api/cache/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    cache: {
      lastUpdated: newsCache.lastUpdated,
      newsCount: newsCache.data.length,
      isUpdating: newsCache.isUpdating,
      cacheAge: newsCache.lastUpdated ? Date.now() - newsCache.lastUpdated : null,
      cacheValid: newsCache.lastUpdated ? (Date.now() - newsCache.lastUpdated) < CACHE_DURATION : false
    }
  });
});

// 수동 캐시 새로고침 API
app.post('/api/cache/refresh', async (req, res) => {
  try {
    newsCache.lastUpdated = null; // 캐시 무효화
    const news = await updateNewsCache();
    
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      message: '캐시 새로고침 완료',
      newsCount: news.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ error: '캐시 새로고침 실패' });
  }
});

// 404 핸들러
app.use((req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(404).json({ 
    error: '페이지를 찾을 수 없습니다',
    path: req.path 
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(500).json({ 
    error: '서버 내부 오류',
    message: process.env.NODE_ENV === 'development' ? err.message : '서버 오류가 발생했습니다'
  });
});

const PORT = process.env.PORT || 3000;

// 서버 시작시 초기 캐시 로드
async function initializeServer() {
  try {
    console.log('서버 초기화 중...');
    await updateNewsCache();
    console.log('초기 캐시 로드 완료');
    
    app.listen(PORT, () => {
      console.log(`서버 실행 중: http://localhost:${PORT}`);
      console.log(`배포 서버: https://live-news-arjv.onrender.com`);
      console.log(`캐시 상태: ${newsCache.data.length}개 뉴스 캐시됨`);
    });
    
  } catch (error) {
    console.error('서버 초기화 오류:', error);
    
    // 초기 로드 실패해도 서버는 시작
    app.listen(PORT, () => {
      console.log(`서버 실행 중 (캐시 로드 실패): http://localhost:${PORT}`);
    });
  }
}

// 10분마다 뉴스 캐시 업데이트
cron.schedule('*/10 * * * *', async () => {
  console.log('정기 뉴스 캐시 업데이트 시작...');
  await updateNewsCache();
});

// 1시간마다 메모리 사용량 체크
cron.schedule('0 * * * *', () => {
  const memUsage = process.memoryUsage();
  console.log('메모리 사용량:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
  });
});

// 서버 시작
initializeServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 받음, 서버 종료 중...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT 신호 받음, 서버 종료 중...');
  process.exit(0);
});