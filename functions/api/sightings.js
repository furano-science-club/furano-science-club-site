export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const data = await request.json();

    const { lat, lng, date, note } = data;

    // IPアドレスを取得(Cloudflareが自動で付与するヘッダー)
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // 入力チェック
    if (typeof lat !== "number" || typeof lng !== "number" || !date) {
      return new Response(JSON.stringify({ error: "入力内容が不正です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (date.length > 50) {
      return new Response(JSON.stringify({ error: "観測日の入力が長すぎます" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 富良野地区のおおよその範囲チェック
    const inFuranoArea =
      lat >= 42.9 && lat <= 43.7 &&
      lng >= 142.0 && lng <= 142.9;

    if (!inFuranoArea) {
      return new Response(JSON.stringify({ error: "富良野地区周辺の座標を指定してください" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (note && note.length > 300) {
      return new Response(JSON.stringify({ error: "メモは300文字以内にしてください" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // --- レート制限チェック ---
    // 直近5分以内に同じIPからの投稿がないか確認
    const recentCheck = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM sightings
       WHERE ip = ? AND created_at >= datetime('now', '-5 minutes')`
    ).bind(ip).first();

    if (recentCheck.count >= 1) {
      return new Response(JSON.stringify({ error: "投稿は5分に1回までです。少し時間をおいて再度お試しください。" }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1日に同じIPから5件まで(連投によるスパム対策)
    const dailyCheck = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM sightings
       WHERE ip = ? AND created_at >= datetime('now', '-1 day')`
    ).bind(ip).first();

    if (dailyCheck.count >= 5) {
      return new Response(JSON.stringify({ error: "本日の投稿可能数(5件)に達しました。" }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 保存
    await env.DB.prepare(
      `INSERT INTO sightings (lat, lng, observed_date, note, status, ip) VALUES (?, ?, ?, ?, 'pending', ?)`
    ).bind(lat, lng, date, note || "", ip).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
