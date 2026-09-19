// Vercel 서버리스 함수: 브라우저 → 이 함수 → 카카오 로컬 API
// 카카오 REST API 키는 여기(서버)에만 있고, 브라우저 코드에는 절대 노출되지 않음.
//
// 사용법 (프론트엔드에서):
//   fetch(`/api/search?query=${encodeURIComponent('인천 구월동 맛집')}`)
//
// 환경변수 설정 필요: Vercel 프로젝트 설정 > Environment Variables 에
//   KAKAO_REST_API_KEY = 발급받은 REST API 키
// 를 추가해야 동작함 (코드에 직접 키를 적지 마세요).

export default async function handler(req, res) {
  // CORS 허용 (필요하면 특정 도메인으로 좁혀도 됨)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_KEY) {
    res.status(500).json({ error: '서버에 KAKAO_REST_API_KEY 환경변수가 설정되어 있지 않아요.' });
    return;
  }

  const { query, x, y, radius, category_group_code, page, size } = req.query;

  if (!query) {
    res.status(400).json({ error: 'query 파라미터가 필요해요. 예: ?query=인천 구월동 맛집' });
    return;
  }

  // 카카오 로컬 API - 키워드로 장소 검색
  const params = new URLSearchParams({
    query: String(query),
    category_group_code: category_group_code || 'FD6', // FD6 = 음식점
    page: page || '1',
    size: size || '15',
  });
  if (x) params.set('x', String(x));
  if (y) params.set('y', String(y));
  if (radius) params.set('radius', String(radius));

  try {
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } }
    );

    if (!kakaoRes.ok) {
      const errBody = await kakaoRes.text();
      res.status(kakaoRes.status).json({ error: '카카오 API 호출 실패', detail: errBody });
      return;
    }

    const data = await kakaoRes.json();

    const restaurants = (data.documents || []).map((place) => ({
      name: place.place_name,
      category: place.category_name,
      address: place.road_address_name || place.address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      phone: place.phone || null,
      placeUrl: place.place_url,
      distance: place.distance ? Number(place.distance) : null,
    }));

    res.status(200).json({
      count: restaurants.length,
      isEnd: data.meta ? data.meta.is_end : true,
      restaurants,
    });
  } catch (err) {
    res.status(500).json({ error: '서버 오류', detail: String(err) });
  }
}
