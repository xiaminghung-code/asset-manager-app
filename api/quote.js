// Vercel Serverless Function
// 伺服器對伺服器呼叫，沒有瀏覽器的CORS限制，比前端繞代理穩定很多
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { symbol, market } = req.query;
  if (!symbol) {
    res.status(400).json({ error: 'missing symbol' });
    return;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function doFetch() {
    if (market === 'FX') {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error('fx status ' + r.status);
      return { type: 'json', body: await r.json() };
    } else if (market === 'US') {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('stooq status ' + r.status);
      return { type: 'text', body: await r.text() };
    } else {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${encodeURIComponent(symbol)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('twse status ' + r.status);
      return { type: 'json', body: await r.json() };
    }
  }

  // 伺服器端重試最多3次，中間間隔遞增，比在瀏覽器裡重試穩定很多
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(300 * attempt);
      const result = await doFetch();
      if (result.type === 'json') res.status(200).json(result.body);
      else res.status(200).send(result.body);
      return;
    } catch (e) { lastErr = e; }
  }
  res.status(502).json({ error: String(lastErr && lastErr.message || lastErr) });
}
