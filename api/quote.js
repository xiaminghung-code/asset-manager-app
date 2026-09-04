// Vercel Serverless Function
// 伺服器對伺服器呼叫，沒有瀏覽器的CORS限制
// 改用 Yahoo Finance 公開報價介面：台股美股統一邏輯，比證交所官方API更少限流問題
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
      const json = await r.json();
      const rate = json && json.rates && json.rates.TWD;
      if (!rate) throw new Error('fx no TWD rate');
      return { price: rate };
    }

    // 台股在Yahoo Finance用「代號.TW」查詢，美股直接用代號
    const yahooSymbol = market === 'US' ? symbol : `${symbol}.TW`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; asset-manager/1.0)' } });
    if (!r.ok) throw new Error('yahoo status ' + r.status);
    const json = await r.json();
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    const price = result && result.meta && (result.meta.regularMarketPrice || result.meta.previousClose);
    if (!price) throw new Error('no price in yahoo response');
    return { price };
  }

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(600 * attempt);
      const result = await doFetch();
      res.status(200).json(result);
      return;
    } catch (e) { lastErr = e; }
  }
  res.status(502).json({ error: String(lastErr && lastErr.message || lastErr) });
}
