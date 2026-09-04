// Vercel Serverless Function
// 伺服器對伺服器呼叫，沒有瀏覽器的CORS限制，比前端繞代理穩定很多
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { symbol, market } = req.query;
  if (!symbol) {
    res.status(400).json({ error: 'missing symbol' });
    return;
  }

  try {
    if (market === 'FX') {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error('fx status ' + r.status);
      const json = await r.json();
      res.status(200).json(json);
    } else if (market === 'US') {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('stooq status ' + r.status);
      const text = await r.text();
      res.status(200).send(text);
    } else {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${encodeURIComponent(symbol)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('twse status ' + r.status);
      const json = await r.json();
      res.status(200).json(json);
    }
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
