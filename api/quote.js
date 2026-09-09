// Vercel Serverless Function
// 伺服器對伺服器呼叫，沒有瀏覽器的CORS限制
// 改用 Yahoo Finance 公開報價介面：台股美股統一邏輯，比證交所官方API更少限流問題
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { symbol, market, range } = req.query;
  if (!symbol) {
    res.status(400).json({ error: 'missing symbol' });
    return;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function fetchYahoo(fullSymbol) {
    const rangeParam = range === 'full' ? '&range=1y&interval=1d' : '';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fullSymbol)}?${rangeParam.replace(/^&/, '')}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; asset-manager/1.0)' } });
    if (!r.ok) throw new Error('yahoo status ' + r.status);
    const json = await r.json();
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    if (!result) throw new Error('no result in yahoo response');
    if (range === 'full') {
      const timestamps = result.timestamp || [];
      const closes = (result.indicators && result.indicators.quote
                    && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
      const series = timestamps.map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] })).filter(p => p.close != null);
      if (series.length === 0) throw new Error('empty history series');
      return { series };
    }
    const price = result.meta && (result.meta.regularMarketPrice || result.meta.previousClose);
    if (!price) throw new Error('no price in yahoo response');
    return { price };
  }

  async function doFetch() {
    if (market === 'FX') {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error('fx status ' + r.status);
      const json = await r.json();
      const rate = json && json.rates && json.rates.TWD;
      if (!rate) throw new Error('fx no TWD rate');
      return { price: rate };
    }

    // 台股在Yahoo Finance查詢：上市用「代號.TW」，上櫃用「代號.TWO」，兩種都自動試
    if (market !== 'US') {
      const suffixes = ['.TW', '.TWO'];
      let lastYahooErr;
      for (const suffix of suffixes) {
        try { return await fetchYahoo(symbol + suffix); } catch (e) { lastYahooErr = e; }
      }
      throw lastYahooErr;
    }

    // 美股直接用代號查詢
    return await fetchYahoo(symbol);
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
